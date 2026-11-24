// Guia "Contato" (layout do BuildChat): cartão do contato, Etiquetas (pastas)
// e as seções do Advox — lead e funil, próxima atividade, anotações e jurídico.
import { useCallback, useEffect, useState } from 'react';
import {
  Briefcase, CalendarDays, ExternalLink, Loader2, Link2, NotebookPen, Phone, Plus, Scale, Search, Sparkles, Tag, UserPlus, X,
} from 'lucide-react';
import { cn, dataHoraCurta, formatarTelefone, semAcento, CORES_CATEGORIA } from '@/lib/utils';
import {
  APP_URL, ETAPAS, MOTIVOS_PERDA, OPERADORAS, TIPOS_ATIVIDADE,
  buscarLeads, colocarNaPasta, criarAtividade, criarLead, criarNota, criarPasta, diasParaFidelidade, fmtBRL,
  indicarAoJuridico, moverLead, notasDoLead, parseBRL, proximaAtividade, salvarInteresses, tirarDaPasta, vincularTelefone,
  type Lead, type Nota, type Tarefa,
} from '@/content/api';
import type { Contato } from '@/content/wa';
import { useDados } from './dados';
import { inputCls } from './Conta';
import { Campo } from './Mensagens';
import { toast } from './toast';

/** Bloco da guia: faixa de cabeçalho com ícone num chip colorido e contador. */
export function GuiaSecao({
  titulo, Icon, cor, contador, acao, children,
}: {
  titulo: string; Icon: typeof Tag; cor: string; contador?: number; acao?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-border bg-surface">
      <header className="flex items-center gap-2 border-b border-border px-2.5 py-2" style={{ background: `color-mix(in oklab, ${cor} 10%, var(--surface-2))` }}>
        <span className="grid h-6 w-6 flex-shrink-0 place-items-center rounded-md" style={{ background: `color-mix(in oklab, ${cor} 22%, transparent)`, color: cor }}>
          <Icon size={13} />
        </span>
        <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: cor }}>{titulo}</span>
        {contador !== undefined && contador > 0 && (
          <span className="ml-auto grid h-[18px] min-w-[18px] place-items-center rounded-md px-1 text-[10.5px] font-bold text-white" style={{ background: cor }}>{contador}</span>
        )}
        {acao && <span className={cn(contador !== undefined && contador > 0 ? 'ml-1' : 'ml-auto')}>{acao}</span>}
      </header>
      <div className="p-2.5">{children}</div>
    </section>
  );
}

const btnPrimario = 'inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-brand py-1.5 text-[12.5px] font-semibold text-white transition hover:opacity-90 disabled:opacity-50';
const btnSecundario = 'rounded-md border border-border-strong px-3 py-1.5 text-[12.5px] font-medium text-text-2 transition hover:bg-surface-2';
const btnTracejado = 'w-full rounded-md border border-dashed border-border-strong py-1.5 text-[12px] font-semibold text-text-2 transition hover:border-brand hover:text-brand';
const areaCls = 'w-full resize-none rounded-md border border-border-strong bg-surface px-2.5 py-1.5 text-[12px] outline-none focus:border-brand';

export function ContatoView() {
  const { contato, lead, recarregarLead } = useDados();

  if (!contato) {
    return <div className="flex flex-1 items-center justify-center p-6 text-center text-[12px] text-muted">Abra uma conversa para ver os dados do contato.</div>;
  }

  return (
    <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
      <div className="bc-elev flex items-center gap-3 rounded-lg border border-border bg-surface p-3">
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14px] font-bold">{lead?.contato || contato.nome || 'Contato'}</div>
          <div className="flex items-center gap-1 text-[11px] text-muted">
            <Phone size={11} />
            {contato.ehGrupo ? 'Grupo' : formatarTelefone(contato.telefone) ?? 'Telefone não identificado'}
          </div>
        </div>
        {lead && (
          <span className="flex-shrink-0 rounded-md bg-brand/10 px-1.5 py-0.5 text-[10px] font-bold uppercase text-brand">{lead.operadora}</span>
        )}
      </div>

      <Etiquetas contato={contato} />

      {!contato.ehGrupo && <Interesses />}

      {contato.ehGrupo ? (
        <p className="rounded-lg border border-border bg-surface-2 p-2.5 text-[12px] text-muted">Grupos podem ir para pastas, mas não viram lead no Advox.</p>
      ) : !contato.telefone ? (
        <p className="rounded-lg border border-border bg-surface-2 p-2.5 text-[12px] text-muted">Não foi possível ler o telefone desta conversa. Atualize a página do WhatsApp e tente de novo.</p>
      ) : lead === undefined ? (
        <div className="flex items-center justify-center gap-2 py-6 text-[12px] text-muted"><Loader2 size={14} className="animate-spin" /> Procurando no Advox…</div>
      ) : lead ? (
        <LeadSecoes lead={lead} contato={contato} onMudou={recarregarLead} />
      ) : (
        <SemLead contato={contato} onCriado={recarregarLead} />
      )}
    </div>
  );
}

// ───────────── Etiquetas (pastas da conversa) ─────────────

function Etiquetas({ contato }: { contato: Contato }) {
  const { pastas, pastasDaConversa, recarregar } = useDados();
  const marcadas = pastasDaConversa(contato.chatId, contato.telefone);
  const [add, setAdd] = useState(false);
  const [busca, setBusca] = useState('');
  const [ocupado, setOcupado] = useState(false);

  const termo = semAcento(busca.trim());
  const disponiveis = pastas.filter((p) => !marcadas.includes(p.id));
  const sugestoes = termo ? disponiveis.filter((p) => semAcento(p.nome).includes(termo)) : disponiveis;
  const jaExiste = pastas.some((p) => semAcento(p.nome) === termo);

  async function alternar(id: string) {
    const er = marcadas.includes(id) ? await tirarDaPasta(id, contato.chatId) : await colocarNaPasta(id, contato);
    if (er) toast.error(er);
    recarregar();
  }

  async function criarEAplicar() {
    const nome = busca.trim();
    if (!nome) return;
    setOcupado(true);
    const r = await criarPasta(nome, CORES_CATEGORIA[pastas.length % CORES_CATEGORIA.length], pastas.length);
    if (r.id) await colocarNaPasta(r.id, contato);
    setOcupado(false);
    if (r.erro) toast.error(r.erro); else { setBusca(''); toast.success(`Pasta "${nome}" criada.`); }
    recarregar();
  }

  return (
    <GuiaSecao titulo="Etiquetas" Icon={Tag} cor="var(--brand)" contador={marcadas.length}>
      <div className="flex flex-wrap items-center gap-1.5">
        {pastas.filter((p) => marcadas.includes(p.id)).map((p) => (
          <button key={p.id} type="button" onClick={() => alternar(p.id)} title="Tirar desta pasta"
            className="group inline-flex items-center gap-1 rounded-md border px-2.5 py-0.5 text-[11.5px] font-semibold text-white transition"
            style={{ background: p.cor, borderColor: p.cor }}>
            {p.nome}
            <X size={11} className="opacity-0 transition group-hover:opacity-100" />
          </button>
        ))}
        {marcadas.length === 0 && !add && <span className="text-[12px] text-muted">Nenhuma etiqueta neste contato.</span>}
        <button type="button" onClick={() => setAdd((v) => !v)} title="Colocar numa pasta"
          className={cn('grid h-6 w-6 place-items-center rounded-md border border-dashed border-border-strong text-muted transition hover:border-brand hover:text-brand', add && 'border-brand text-brand')}>
          <Plus size={13} />
        </button>
      </div>

      {add && (
        <div className="mt-2 border-t border-border pt-2">
          <div className="relative mb-2">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
            <input autoFocus value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar ou criar pasta…"
              onKeyDown={(e) => {
                if (e.key === 'Escape') { setAdd(false); setBusca(''); }
                if (e.key === 'Enter') {
                  if (sugestoes.length === 1) alternar(sugestoes[0].id);
                  else if (sugestoes.length === 0 && termo && !jaExiste) criarEAplicar();
                }
              }}
              className="h-8 w-full rounded-md border border-border-strong bg-surface pl-8 pr-2 text-[12px] outline-none focus:border-brand" />
          </div>
          <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
            {sugestoes.map((p) => (
              <button key={p.id} type="button" onClick={() => alternar(p.id)}
                className="rounded-md border bg-surface px-2.5 py-0.5 text-[11.5px] font-semibold transition hover:text-white"
                style={{ borderColor: p.cor, color: p.cor }}
                onMouseEnter={(e) => { e.currentTarget.style.background = p.cor; e.currentTarget.style.color = '#fff'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = ''; e.currentTarget.style.color = p.cor; }}>
                {p.nome}
              </button>
            ))}
            {sugestoes.length === 0 && !termo && <span className="text-[12px] text-muted">{pastas.length ? 'O contato já está em todas as pastas.' : 'Digite para criar a primeira pasta.'}</span>}
          </div>
          {termo && !jaExiste && (
            <button type="button" onClick={criarEAplicar} disabled={ocupado}
              className="mt-2 inline-flex w-full items-center gap-1.5 rounded-md border border-dashed border-brand/60 px-2.5 py-1.5 text-[12px] font-semibold text-brand transition hover:bg-brand/10 disabled:opacity-50">
              {ocupado ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Criar pasta “{busca.trim()}”
            </button>
          )}
        </div>
      )}
    </GuiaSecao>
  );
}

// ───────────── Interesses (vai para o painel AdvoxChat → Contatos) ─────────────

function Interesses() {
  const { contatoWa } = useDados();
  const [texto, setTexto] = useState(contatoWa?.interesses ?? '');
  const [salvo, setSalvo] = useState(contatoWa?.interesses ?? '');
  useEffect(() => { setTexto(contatoWa?.interesses ?? ''); setSalvo(contatoWa?.interesses ?? ''); }, [contatoWa?.id]);

  async function salvar() {
    if (!contatoWa || texto === salvo) return;
    const er = await salvarInteresses(contatoWa.id, texto);
    if (er) toast.error(er); else { setSalvo(texto); toast.success('Interesses salvos.'); }
  }

  return (
    <GuiaSecao titulo="Interesses" Icon={Sparkles} cor="var(--amber)">
      <textarea value={texto} onChange={(e) => setTexto(e.target.value)} onBlur={salvar} rows={3} disabled={!contatoWa}
        placeholder="Ex.: 12 linhas Vivo, quer portabilidade — proposta enviada em 12/08" className={areaCls} />
      {contatoWa && (
        <p className="mt-1 text-[10.5px] text-muted">
          Último contato: {new Date(contatoWa.ultimo_contato).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
        </p>
      )}
    </GuiaSecao>
  );
}

// ───────────── Sem lead: criar ou vincular ─────────────

function SemLead({ contato, onCriado }: { contato: Contato; onCriado: () => void }) {
  const { perfil } = useDados();
  const [modo, setModo] = useState<'criar' | 'vincular'>('criar');
  const [empresa, setEmpresa] = useState('');
  const [nome, setNome] = useState(contato.nome);
  const [operadora, setOperadora] = useState('Vivo');
  const [valor, setValor] = useState('');
  const [fim, setFim] = useState('');
  const [busca, setBusca] = useState('');
  const [resultados, setResultados] = useState<Lead[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => { setNome(contato.nome); }, [contato.chatId]);
  useEffect(() => {
    if (modo !== 'vincular') return;
    const t = window.setTimeout(() => buscarLeads(busca).then(setResultados), 300);
    return () => window.clearTimeout(t);
  }, [busca, modo]);

  return (
    <GuiaSecao titulo="Lead no Advox" Icon={UserPlus} cor="var(--amber)">
      <p className="mb-2 text-[12px] text-muted">Este WhatsApp ainda não está no Advox.</p>
      <div className="bc-seg mb-2.5 w-full">
        <button type="button" data-ativo={modo === 'criar' ? 1 : 0} onClick={() => setModo('criar')} className="flex-1">Criar lead</button>
        <button type="button" data-ativo={modo === 'vincular' ? 1 : 0} onClick={() => setModo('vincular')} className="flex-1">Vincular existente</button>
      </div>
      {modo === 'criar' ? (
        <form className="space-y-2" onSubmit={async (e) => {
          e.preventDefault(); setBusy(true);
          const r = await criarLead(perfil, { empresa: empresa.trim() || nome.trim(), contato: nome.trim(), telefone: contato.telefone!, operadora, valor: parseBRL(valor), fim_fidelidade: fim || null });
          setBusy(false);
          if (r.erro) toast.error(r.erro); else { toast.success('Lead criado no Advox.'); onCriado(); }
        }}>
          <Campo label="Empresa"><input value={empresa} onChange={(e) => setEmpresa(e.target.value)} placeholder="Nome da empresa" className={inputCls} /></Campo>
          <Campo label="Contato"><input value={nome} onChange={(e) => setNome(e.target.value)} className={inputCls} /></Campo>
          <div className="grid grid-cols-2 gap-2">
            <Campo label="Operadora">
              <select value={operadora} onChange={(e) => setOperadora(e.target.value)} className={inputCls}>{OPERADORAS.map((o) => <option key={o}>{o}</option>)}</select>
            </Campo>
            <Campo label="Valor (R$)"><input value={valor} onChange={(e) => setValor(e.target.value)} placeholder="5.000" className={inputCls} /></Campo>
          </div>
          <Campo label="Fim da fidelidade"><input type="date" value={fim} onChange={(e) => setFim(e.target.value)} className={inputCls} /></Campo>
          <button disabled={busy || !nome.trim()} className={btnPrimario}>
            {busy ? <Loader2 size={13} className="animate-spin" /> : <UserPlus size={13} />} Criar lead com este WhatsApp
          </button>
        </form>
      ) : (
        <div className="space-y-1.5">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
            <input autoFocus value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por empresa ou contato…"
              className="h-8 w-full rounded-md border border-border-strong bg-surface pl-8 pr-2 text-[12px] outline-none focus:border-brand" />
          </div>
          {resultados.map((l) => (
            <button key={l.id} type="button" disabled={busy}
              onClick={async () => {
                setBusy(true); const er = await vincularTelefone(l.id, contato.telefone!); setBusy(false);
                if (er) toast.error(er); else { toast.success('WhatsApp vinculado ao lead.'); onCriado(); }
              }}
              className="flex w-full items-center gap-2 rounded-md border border-border bg-surface-2 p-2 text-left transition hover:border-brand">
              <Link2 size={13} className="flex-shrink-0 text-brand" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12px] font-semibold">{l.empresa}</span>
                <span className="block truncate text-[10.5px] text-muted">{l.contato}{l.telefone ? ` · ${formatarTelefone(l.telefone)}` : ' · sem WhatsApp'}</span>
              </span>
            </button>
          ))}
          {busca.trim().length >= 2 && resultados.length === 0 && <p className="text-[12px] text-muted">Nenhum lead encontrado.</p>}
        </div>
      )}
    </GuiaSecao>
  );
}

// ───────────── Com lead: funil, atividade, anotações, jurídico ─────────────

function LeadSecoes({ lead, contato, onMudou }: { lead: Lead; contato: Contato; onMudou: () => void }) {
  const { perfil } = useDados();
  const [notas, setNotas] = useState<Nota[] | null>(null);
  const [proxima, setProxima] = useState<Tarefa | null | undefined>(undefined);
  const [texto, setTexto] = useState('');
  const [salvandoNota, setSalvandoNota] = useState(false);
  const [perdendo, setPerdendo] = useState(false);
  const [agendando, setAgendando] = useState(false);
  const [indicando, setIndicando] = useState(false);

  const recarregar = useCallback(() => {
    notasDoLead(lead.id).then(setNotas);
    proximaAtividade(lead.id).then(setProxima);
  }, [lead.id]);
  useEffect(() => { recarregar(); setPerdendo(false); setAgendando(false); setIndicando(false); }, [recarregar]);

  const dias = diasParaFidelidade(lead.fim_fidelidade);
  const aberto = !['fechado', 'perdido'].includes(lead.status);
  const atrasada = !!proxima?.quando && new Date(proxima.quando) < new Date();

  async function mover(status: string, motivo?: string) {
    const er = await moverLead(lead.id, status, motivo);
    if (er) toast.error(er); else toast.success(`Lead movido para ${ETAPAS.find((e) => e.id === status)?.label}.`);
    setPerdendo(false);
    onMudou();
  }

  async function salvarNota() {
    if (!texto.trim()) return;
    setSalvandoNota(true);
    const er = await criarNota(perfil, lead.id, texto.trim());
    setSalvandoNota(false);
    if (er) toast.error(er); else { setTexto(''); toast.success('Anotação salva no histórico do lead.'); recarregar(); }
  }

  return (
    <>
      <GuiaSecao titulo="Lead no Advox" Icon={Briefcase} cor="var(--brand)"
        acao={<a href={APP_URL} target="_blank" rel="noopener noreferrer" title="Abrir no Advox" className="grid h-6 w-6 place-items-center rounded-md text-muted transition hover:bg-surface hover:text-brand"><ExternalLink size={13} /></a>}>
        <div className="mb-2">
          <div className="truncate text-[13px] font-bold">{lead.empresa}</div>
          <div className="truncate text-[11px] text-muted">{lead.contato}{lead.cidade ? ` · ${lead.cidade}${lead.uf ? '/' + lead.uf : ''}` : ''}</div>
        </div>
        <div className="mb-2.5 flex flex-wrap gap-1.5">
          <span className="rounded-md bg-surface-3 px-1.5 py-0.5 text-[10.5px] font-bold text-text-2">{fmtBRL(Number(lead.valor || 0))}</span>
          {aberto && dias !== null && dias <= 60 && (
            <span className={cn('rounded-md px-1.5 py-0.5 text-[10.5px] font-bold', dias < 0 ? 'bg-green-bg text-success' : 'bg-amber-bg text-warning')}>
              {dias < 0 ? 'Fidelidade vencida' : dias === 0 ? 'Fidelidade vence hoje' : `Fidelidade em ${dias}d`}
            </span>
          )}
          {lead.advox_caso_id && <span className="rounded-md bg-red-bg px-1.5 py-0.5 text-[10.5px] font-bold text-danger">Caso {lead.advox_caso_id.slice(0, 8)}</span>}
        </div>
        <Campo label="Etapa do funil">
          <select value={perdendo ? 'perdido' : lead.status} className={inputCls}
            onChange={(e) => { const s = e.target.value; if (s === 'perdido') setPerdendo(true); else mover(s); }}>
            {ETAPAS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </Campo>
        {perdendo && (
          <div className="mt-2 rounded-md border border-border bg-surface-2 p-2">
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">Por que foi perdido?</div>
            <div className="flex flex-wrap gap-1.5">
              {MOTIVOS_PERDA.map((m) => (
                <button key={m} type="button" onClick={() => mover('perdido', m)}
                  className="rounded-md border border-border-strong bg-surface px-2 py-0.5 text-[11px] font-medium text-text-2 transition hover:border-danger hover:text-danger">{m}</button>
              ))}
            </div>
            <button type="button" onClick={() => setPerdendo(false)} className="mt-1.5 text-[11.5px] font-semibold text-muted hover:underline">Cancelar</button>
          </div>
        )}
        {lead.status === 'perdido' && lead.motivo_perda && <p className="mt-1.5 text-[11px] text-muted">Motivo da perda: {lead.motivo_perda}</p>}
      </GuiaSecao>

      <GuiaSecao titulo="Próxima atividade" Icon={CalendarDays} cor="var(--brand)" contador={proxima ? 1 : 0}>
        {agendando ? (
          <Agendar leadId={lead.id} onFim={(ok) => { setAgendando(false); if (ok) recarregar(); }} />
        ) : (
          <>
            <button type="button" onClick={() => setAgendando(true)} className={cn(btnTracejado, 'mb-2')}>+ Agendar atividade</button>
            {proxima === undefined ? (
              <span className="text-[12px] text-muted">Carregando…</span>
            ) : proxima ? (
              <div className="flex items-start gap-2 rounded-md border border-border bg-surface-2 p-2">
                <span className="mt-1 h-2 w-2 flex-shrink-0 rounded-full" style={{ background: atrasada ? 'var(--red)' : 'var(--brand)' }} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12px] font-semibold">
                    {TIPOS_ATIVIDADE.find((t) => t.id === proxima.tipo)?.label ?? ''} · {proxima.descricao}
                  </span>
                  <span className={cn('block text-[10.5px]', atrasada ? 'font-semibold text-danger' : 'text-muted')}>
                    {proxima.quando ? dataHoraCurta(proxima.quando) : 'sem data'}{atrasada ? ' · atrasada' : ''}
                  </span>
                </span>
              </div>
            ) : (
              <span className="text-[12px] text-muted">Nada agendado com este cliente.</span>
            )}
          </>
        )}
      </GuiaSecao>

      <GuiaSecao titulo="Anotações" Icon={NotebookPen} cor="var(--green)" contador={notas?.length ?? 0}>
        <div className="flex items-start gap-1.5">
          <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={2} placeholder="O que foi conversado?" className={areaCls}
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) salvarNota(); }} />
          <button type="button" onClick={salvarNota} disabled={salvandoNota || !texto.trim()} title="Salvar no histórico do lead"
            className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-md bg-brand text-white transition hover:opacity-90 disabled:opacity-50">
            {salvandoNota ? <Loader2 size={14} className="animate-spin" /> : <Plus size={15} />}
          </button>
        </div>
        {notas && notas.length > 0 ? (
          <ul className="mt-2 space-y-1.5">
            {notas.map((n) => (
              <li key={n.id} className="rounded-md border border-border bg-surface-2 p-2">
                <div className="whitespace-pre-wrap break-words text-[12px] text-text-2">{n.texto}</div>
                <div className="mt-1 text-[10px] text-muted">{dataHoraCurta(n.created_at)} · {n.tipo}</div>
              </li>
            ))}
          </ul>
        ) : notas && <p className="mt-1.5 text-[12px] text-muted">Nenhuma anotação ainda.</p>}
      </GuiaSecao>

      {!lead.advox_caso_id && (
        <GuiaSecao titulo="Jurídico" Icon={Scale} cor="var(--red)">
          {indicando ? (
            <Indicar lead={{ ...lead, telefone: lead.telefone ?? contato.telefone }} onFim={(ok) => { setIndicando(false); if (ok) onMudou(); }} />
          ) : (
            <>
              <p className="mb-2 text-[12px] text-muted">Cliente preso em contrato abusivo ou multa? Indique para o escritório parceiro.</p>
              <button type="button" onClick={() => setIndicando(true)}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-danger py-1.5 text-[12.5px] font-semibold text-white transition hover:opacity-90">
                <Scale size={13} /> Indicar ao jurídico
              </button>
            </>
          )}
        </GuiaSecao>
      )}
    </>
  );
}

function Agendar({ leadId, onFim }: { leadId: string; onFim: (ok: boolean) => void }) {
  const { perfil } = useDados();
  const [tipo, setTipo] = useState('ligacao');
  const [desc, setDesc] = useState('');
  const [quando, setQuando] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {TIPOS_ATIVIDADE.map((t) => (
          <button key={t.id} type="button" onClick={() => setTipo(t.id)}
            className={cn('rounded-md border px-2 py-0.5 text-[11px] font-semibold transition', tipo === t.id ? 'border-brand bg-brand text-white' : 'border-border-strong text-text-2 hover:border-brand')}>
            {t.label}
          </button>
        ))}
      </div>
      <input autoFocus value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Ex.: retornar com a proposta" className={inputCls} />
      <input type="datetime-local" value={quando} onChange={(e) => setQuando(e.target.value)} className={inputCls} />
      <div className="flex gap-2">
        <button type="button" onClick={() => onFim(false)} className={btnSecundario}>Cancelar</button>
        <button type="button" disabled={busy || !desc.trim()} className={btnPrimario}
          onClick={async () => {
            setBusy(true); const er = await criarAtividade(perfil, leadId, { descricao: desc.trim(), tipo, quando: quando || null }); setBusy(false);
            if (er) toast.error(er); else { toast.success('Atividade agendada.'); onFim(true); }
          }}>
          {busy && <Loader2 size={13} className="animate-spin" />} Agendar
        </button>
      </div>
    </div>
  );
}

function Indicar({ lead, onFim }: { lead: Lead; onFim: (ok: boolean) => void }) {
  const { perfil } = useDados();
  const [tipo, setTipo] = useState('Multa rescisória');
  const [multa, setMulta] = useState('');
  const [desc, setDesc] = useState('');
  const [aceite, setAceite] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <div className="space-y-2">
      <Campo label="Tipo de bloqueio">
        <select value={tipo} onChange={(e) => setTipo(e.target.value)} className={inputCls}>
          {['Multa rescisória', 'Fidelidade vencida', 'Renovação automática', 'Outros'].map((t) => <option key={t}>{t}</option>)}
        </select>
      </Campo>
      <Campo label="Valor estimado da multa (R$)"><input value={multa} onChange={(e) => setMulta(e.target.value)} placeholder="3.200,00" className={inputCls} /></Campo>
      <Campo label="Contexto para o escritório">
        <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={3} placeholder="Linhas, quando renovou, o que a operadora cobra…" className={areaCls} />
      </Campo>
      <label className="flex cursor-pointer items-start gap-2 rounded-md border border-border bg-surface-2 p-2 text-[11.5px] text-text-2">
        <input type="checkbox" checked={aceite} onChange={(e) => setAceite(e.target.checked)} className="mt-0.5" />
        O cliente autorizou o envio dos dados ao escritório de advocacia parceiro. Honorários, se houver, são pagos pelo cliente final.
      </label>
      <div className="flex gap-2">
        <button type="button" onClick={() => onFim(false)} className={btnSecundario}>Cancelar</button>
        <button type="button" disabled={busy || !aceite}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-danger py-1.5 text-[12.5px] font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
          onClick={async () => {
            setBusy(true); const r = await indicarAoJuridico(perfil, lead, { tipo, multa: parseBRL(multa), descricao: desc }); setBusy(false);
            if (r.erro) toast.error(r.erro); else { toast.success(`Caso ${r.casoId!.slice(0, 8)} criado. Lead movido para Travado (Advox).`); onFim(true); }
          }}>
          {busy && <Loader2 size={13} className="animate-spin" />} Enviar ao jurídico
        </button>
      </div>
    </div>
  );
}
