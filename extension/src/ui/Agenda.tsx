// Minha Agenda dentro do WhatsApp (layout da Agenda do BuildChat), com as
// mesmas três guias do app: Agenda (dia / semana / mês), Notas e Etiquetas.
// Os dados são os do Advox (tarefas e anotacoes), então o que se marca aqui
// aparece na hora no app e vice-versa.
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, Copy, Loader2, NotebookPen, Plus, Search, Tag, Trash2,
} from 'lucide-react';
import { cn, emPx, semAcento, ALTURA_TOPBAR } from '@/lib/utils';
import { abaAgenda, modalAgenda } from '@/lib/store';
import {
  COR_TIPO, TIPOS_ATIVIDADE, apagarAnotacao, apagarAtividade, buscarLeads, concluirAtividade, listarAgenda,
  listarAnotacoes, rotuloTipo, salvarAnotacao, salvarAtividade, type Anotacao, type Atividade,
} from '@/content/api';
import { useDados } from './dados';
import { useSinal } from './sinal';
import { toast } from './toast';

type Visao = 'dia' | 'semana' | 'mes';
const DIAS_CURTOS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const HORA_INICIO = 6;
const HORA_FIM = 22;
const ALTURA_HORA = 44;
const DURACAO_MIN = 30; // atividade não tem fim: ocupa meia hora na grade

// ── datas ──
const inicioDoDia = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const somarDias = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const somarMeses = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth() + n, 1);
const mesmoDia = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const ehHoje = (d: Date) => mesmoDia(d, new Date());
const inicioDaSemana = (d: Date) => somarDias(inicioDoDia(d), -d.getDay());
const diasDaSemana = (d: Date) => Array.from({ length: 7 }, (_, i) => somarDias(inicioDaSemana(d), i));
const diasDoMes = (d: Date) => {
  const ini = inicioDaSemana(new Date(d.getFullYear(), d.getMonth(), 1));
  return Array.from({ length: 42 }, (_, i) => somarDias(ini, i));
};
const hhmm = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
const temHora = (iso: string) => { const d = new Date(iso); return d.getHours() !== 0 || d.getMinutes() !== 0; };
const paraCampoLocal = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};
function periodo(visao: Visao, foco: Date) {
  if (visao === 'dia') return { de: inicioDoDia(foco), ate: somarDias(inicioDoDia(foco), 1) };
  if (visao === 'semana') return { de: inicioDaSemana(foco), ate: somarDias(inicioDaSemana(foco), 7) };
  const dias = diasDoMes(foco);
  return { de: dias[0], ate: somarDias(dias[41], 1) };
}
function rotuloDoPeriodo(visao: Visao, foco: Date) {
  if (visao === 'dia') return foco.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
  if (visao === 'mes') return foco.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  const [a, b] = [inicioDaSemana(foco), somarDias(inicioDaSemana(foco), 6)];
  return `${a.getDate()} ${a.toLocaleDateString('pt-BR', { month: 'short' })} – ${b.getDate()} ${b.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })}`;
}
function proximaHoraCheia() {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  return d;
}
const estaAtrasada = (a: Atividade) => !a.completed && !!a.quando && new Date(a.quando).getTime() < Date.now();

type Rascunho = Partial<Atividade> & { quando: string | null };

// ─────────────────────────────── Modal ───────────────────────────────
export function AgendaModal() {
  const aba = useSinal(abaAgenda);
  const fechar = () => modalAgenda.set(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Esc só fecha a agenda quando não há um editor aberto por cima.
      if (e.key === 'Escape' && !document.querySelector('[data-advox-editor]')) { e.stopPropagation(); fechar(); }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, []);

  return (
    <div className="bc-anim-fade pointer-events-auto fixed inset-x-0 bottom-0 z-[62] flex flex-col bg-bg" style={{ top: emPx(ALTURA_TOPBAR) }}>
      <div className="flex flex-shrink-0 items-center gap-3 border-b border-border bg-surface px-3 py-2">
        <span className="inline-flex items-center gap-1.5 text-[13px] font-bold text-text">
          <CalendarDays size={16} className="text-brand" /> Minha agenda
        </span>
        <span className="bc-seg flex flex-shrink-0 items-center">
          <button type="button" data-ativo={aba === 'agenda' ? 1 : 0} onClick={() => abaAgenda.set('agenda')}><CalendarDays size={13} className="mr-1 inline" />Agenda</button>
          <button type="button" data-ativo={aba === 'notas' ? 1 : 0} onClick={() => abaAgenda.set('notas')}><NotebookPen size={13} className="mr-1 inline" />Notas</button>
          <button type="button" data-ativo={aba === 'etiquetas' ? 1 : 0} onClick={() => abaAgenda.set('etiquetas')}><Tag size={13} className="mr-1 inline" />Etiquetas</button>
        </span>
        <button type="button" onClick={fechar} className="ml-auto flex-shrink-0 rounded-md border border-border-strong px-2.5 py-1 text-[12px] font-semibold text-text-2 transition hover:bg-surface-2">Fechar</button>
      </div>
      {aba === 'notas' ? <NotasView /> : <AtividadesView etiquetas={aba === 'etiquetas'} />}
    </div>
  );
}

// ───────────────────── Agenda e Etiquetas (tarefas) ─────────────────────
function AtividadesView({ etiquetas }: { etiquetas: boolean }) {
  const { perfil, lead } = useDados();
  const ehCoord = perfil.papel === 'coord' || perfil.papel === 'admin';
  const [escopo, setEscopo] = useState<'eu' | 'time'>('eu');
  const [itens, setItens] = useState<Atividade[] | null>(null);
  const [editando, setEditando] = useState<Rascunho | null>(null);
  const [visao, setVisao] = useState<Visao>('semana');
  const [foco, setFoco] = useState(new Date());
  const [tipo, setTipo] = useState<string | null>(null);
  const [soAtrasadas, setSoAtrasadas] = useState(false);
  const [busca, setBusca] = useState('');

  const carregar = useCallback(async () => setItens(await listarAgenda(perfil, escopo)), [perfil.id, escopo]);
  useEffect(() => { carregar(); }, [carregar]);
  // Voltou para a aba do WhatsApp: pode ter mudado algo no app.
  useEffect(() => {
    const onVis = () => { if (document.visibilityState === 'visible') carregar(); };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [carregar]);

  const filtrar = useCallback((a: Atividade) => {
    const termo = semAcento(busca.trim());
    if (tipo && a.tipo !== tipo) return false;
    if (soAtrasadas && !estaAtrasada(a)) return false;
    if (termo && !semAcento(`${a.descricao} ${a.lead?.empresa ?? ''} ${a.lead?.contato ?? ''}`).includes(termo)) return false;
    return true;
  }, [busca, tipo, soAtrasadas]);

  const { de, ate } = periodo(visao, foco);
  const doPeriodo = useMemo(() => (itens ?? []).filter((a) => {
    if (!a.quando) return false;
    const i = new Date(a.quando);
    return i >= de && i < ate && filtrar(a);
  }), [itens, de.getTime(), ate.getTime(), filtrar]);
  const atrasadas = (itens ?? []).filter(estaAtrasada).length;

  const andar = (passo: number) => setFoco((f) => (visao === 'dia' ? somarDias(f, passo) : visao === 'semana' ? somarDias(f, passo * 7) : somarMeses(f, passo)));
  // Nova atividade já vem ligada ao lead da conversa aberta, se houver.
  const novo = (quando: Date | null) => setEditando({
    quando: quando ? quando.toISOString() : null, descricao: '', tipo: tipo ?? 'ligacao',
    lead_id: lead?.id ?? null, lead: lead ? { id: lead.id, empresa: lead.empresa, contato: lead.contato } : null,
  });

  const fitaFiltros = (
    <div className="flex flex-shrink-0 flex-wrap items-center gap-1.5 border-b border-border bg-surface-2 px-3 py-1.5">
      <span className="relative">
        <Search size={12} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-muted" />
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar atividade ou cliente…"
          className="h-7 w-48 rounded-md border border-border-strong bg-surface pl-6 pr-2 text-[11.5px] outline-none focus:border-brand" />
      </span>
      <Etiqueta ativa={tipo === null} onClick={() => setTipo(null)}>Todas</Etiqueta>
      {TIPOS_ATIVIDADE.map((t) => (
        <Etiqueta key={t.id} cor={COR_TIPO[t.id]} ativa={tipo === t.id} onClick={() => setTipo(tipo === t.id ? null : t.id)}>{t.label}</Etiqueta>
      ))}
      <button type="button" onClick={() => setSoAtrasadas((v) => !v)} title="Pendentes cujo horário já passou"
        className={cn('inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-bold transition',
          soAtrasadas ? 'border-danger bg-danger text-white' : 'border-border-strong text-text-2 hover:border-danger hover:text-danger')}>
        Atrasadas{atrasadas > 0 && <span className={cn('rounded-full px-1 text-[9.5px]', soAtrasadas ? 'bg-black/25' : 'bg-danger text-white')}>{atrasadas}</span>}
      </button>
      {ehCoord && (
        <span className="bc-seg ml-auto flex flex-shrink-0 items-center">
          <button type="button" data-ativo={escopo === 'eu' ? 1 : 0} onClick={() => setEscopo('eu')}>Minha</button>
          <button type="button" data-ativo={escopo === 'time' ? 1 : 0} onClick={() => setEscopo('time')}>Time</button>
        </span>
      )}
    </div>
  );

  return (
    <>
      {!etiquetas && (
        <div className="flex flex-shrink-0 flex-wrap items-center gap-2 border-b border-border bg-surface px-3 py-2">
          <button type="button" onClick={() => setFoco(new Date())} className="rounded-md border border-border-strong px-2.5 py-1 text-[11.5px] font-semibold text-text-2 transition hover:bg-surface-2">Hoje</button>
          <span className="flex items-center gap-0.5">
            <button type="button" onClick={() => andar(-1)} title="Anterior" className="grid h-7 w-7 place-items-center rounded-md text-muted hover:bg-surface-2"><ChevronLeft size={16} /></button>
            <button type="button" onClick={() => andar(1)} title="Próximo" className="grid h-7 w-7 place-items-center rounded-md text-muted hover:bg-surface-2"><ChevronRight size={16} /></button>
          </span>
          <span className="min-w-0 flex-1 truncate text-[13px] font-bold text-text first-letter:uppercase">{rotuloDoPeriodo(visao, foco)}</span>
          <span className="bc-seg flex flex-shrink-0 items-center">
            {(['dia', 'semana', 'mes'] as Visao[]).map((v) => (
              <button key={v} type="button" data-ativo={visao === v ? 1 : 0} onClick={() => setVisao(v)}>{v === 'mes' ? 'Mês' : v === 'dia' ? 'Dia' : 'Semana'}</button>
            ))}
          </span>
          <button type="button" onClick={() => novo(proximaHoraCheia())} className="inline-flex flex-shrink-0 items-center gap-1 rounded-md bg-brand px-3 py-1 text-[12px] font-semibold text-white transition hover:opacity-90">
            <Plus size={13} /> Nova atividade
          </button>
        </div>
      )}
      {fitaFiltros}

      <div className="min-h-0 flex-1 overflow-auto">
        {itens === null ? (
          <div className="flex items-center justify-center gap-2 py-16 text-[12.5px] text-muted"><Loader2 size={14} className="animate-spin" /> Carregando…</div>
        ) : etiquetas ? (
          <PorEtiqueta itens={itens.filter(filtrar)} onAbrir={(a) => setEditando(a as Rascunho)} onMudou={carregar} onNova={() => novo(proximaHoraCheia())} mostrarAutor={escopo === 'time'} />
        ) : visao === 'mes' ? (
          <GradeMes foco={foco} itens={doPeriodo} onDia={(d) => { setFoco(d); setVisao('dia'); }} onAbrir={(a) => setEditando(a as Rascunho)} />
        ) : (
          <GradeHoras dias={visao === 'dia' ? [inicioDoDia(foco)] : diasDaSemana(foco)} itens={doPeriodo} onVago={novo} onAbrir={(a) => setEditando(a as Rascunho)} />
        )}
      </div>

      {editando && <EditorAtividade valor={editando} onFechar={() => setEditando(null)} onSalvo={() => { setEditando(null); carregar(); }} />}
    </>
  );
}

function GradeHoras({ dias, itens, onVago, onAbrir }: { dias: Date[]; itens: Atividade[]; onVago: (d: Date) => void; onAbrir: (a: Atividade) => void }) {
  const horas = Array.from({ length: HORA_FIM - HORA_INICIO + 1 }, (_, i) => HORA_INICIO + i);
  return (
    <div className="min-w-[560px]">
      <div className="sticky top-0 z-[2] flex border-b border-border bg-surface">
        <span className="w-12 flex-shrink-0" />
        {dias.map((d) => (
          <span key={+d} className="flex min-w-0 flex-1 flex-col items-center py-1.5">
            <span className="text-[10.5px] uppercase text-muted">{DIAS_CURTOS[d.getDay()]}</span>
            <span className={cn('grid h-6 min-w-6 place-items-center rounded-full px-1 text-[13px] font-bold', ehHoje(d) ? 'bg-brand text-white' : 'text-text')}>{d.getDate()}</span>
          </span>
        ))}
      </div>
      <div className="flex">
        <div className="w-12 flex-shrink-0">
          {horas.map((h) => (
            <div key={h} className="relative text-right" style={{ height: ALTURA_HORA }}>
              <span className="absolute -top-1.5 right-1.5 text-[10px] text-muted">{String(h).padStart(2, '0')}h</span>
            </div>
          ))}
        </div>
        {dias.map((d) => {
          const doDia = itens.filter((a) => a.quando && mesmoDia(new Date(a.quando), d));
          const semHora = doDia.filter((a) => !temHora(a.quando!));
          const comHora = doDia.filter((a) => temHora(a.quando!));
          return (
            <div key={+d} className="relative min-w-0 flex-1 border-l border-border">
              {horas.map((h) => (
                <button key={h} type="button" title="Marcar neste horário"
                  onClick={() => { const q = new Date(d); q.setHours(h, 0, 0, 0); onVago(q); }}
                  className="block w-full border-b border-border/60 transition hover:bg-surface-2" style={{ height: ALTURA_HORA }} />
              ))}
              {/* Sem horário (só a data): fica no topo do dia. */}
              {semHora.length > 0 && (
                <div className="absolute inset-x-0.5 top-0.5 flex flex-col gap-0.5">
                  {semHora.map((a) => <Bloco key={a.id} a={a} onAbrir={onAbrir} />)}
                </div>
              )}
              {comHora.map((a) => {
                const ini = new Date(a.quando!);
                const minutos = (ini.getHours() - HORA_INICIO) * 60 + ini.getMinutes();
                return (
                  <Bloco key={a.id} a={a} onAbrir={onAbrir} estilo={{ position: 'absolute', left: 2, right: 2, top: Math.max(0, (minutos / 60) * ALTURA_HORA), height: (DURACAO_MIN / 60) * ALTURA_HORA }} />
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Bloco({ a, onAbrir, estilo }: { a: Atividade; onAbrir: (a: Atividade) => void; estilo?: React.CSSProperties }) {
  const atrasada = estaAtrasada(a);
  return (
    <button type="button" onClick={() => onAbrir(a)}
      title={`${a.quando && temHora(a.quando) ? hhmm(a.quando) + ' · ' : ''}${rotuloTipo(a.tipo)} · ${a.descricao}${a.lead ? ` — ${a.lead.empresa}` : ''}`}
      className={cn('block overflow-hidden rounded-md px-1.5 py-0.5 text-left text-white transition hover:opacity-90', atrasada && 'ring-2 ring-danger')}
      style={{ background: COR_TIPO[a.tipo] ?? COR_TIPO.tarefa, opacity: a.completed ? 0.55 : 1, textDecoration: a.completed ? 'line-through' : undefined, ...estilo }}>
      <span className="block truncate text-[10.5px] leading-[1.35]">
        {a.quando && temHora(a.quando) && <span className="font-bold">{hhmm(a.quando)} </span>}
        {a.descricao}{a.lead ? <span className="opacity-80"> · {a.lead.empresa}</span> : null}
      </span>
    </button>
  );
}

function GradeMes({ foco, itens, onDia, onAbrir }: { foco: Date; itens: Atividade[]; onDia: (d: Date) => void; onAbrir: (a: Atividade) => void }) {
  const dias = diasDoMes(foco);
  return (
    <div className="min-w-[560px] p-2">
      <div className="mb-1 grid grid-cols-7 gap-1">
        {DIAS_CURTOS.map((d) => <span key={d} className="text-center text-[10.5px] uppercase text-muted">{d}</span>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {dias.map((d) => {
          const doDia = itens.filter((a) => a.quando && mesmoDia(new Date(a.quando), d));
          const doMes = d.getMonth() === foco.getMonth();
          return (
            <div key={+d} className={cn('min-h-[76px] rounded-md border border-border p-1', doMes ? 'bg-surface' : 'bg-surface-2/40 opacity-60')}>
              <button type="button" onClick={() => onDia(d)} title="Ver este dia"
                className={cn('mb-1 grid h-5 min-w-5 place-items-center rounded-full px-1 text-[11.5px] font-bold', ehHoje(d) ? 'bg-brand text-white' : 'text-text-2 hover:bg-surface-2')}>
                {d.getDate()}
              </button>
              <div className="flex flex-col gap-0.5">
                {doDia.slice(0, 3).map((a) => <Bloco key={a.id} a={a} onAbrir={onAbrir} />)}
                {doDia.length > 3 && <button type="button" onClick={() => onDia(d)} className="px-1 text-left text-[10px] text-muted hover:text-brand">+ {doDia.length - 3}</button>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Guia Etiquetas: as atividades agrupadas pelo tipo, como no app. */
function PorEtiqueta({ itens, onAbrir, onMudou, onNova, mostrarAutor }: { itens: Atividade[]; onAbrir: (a: Atividade) => void; onMudou: () => void; onNova: () => void; mostrarAutor: boolean }) {
  const [concluidas, setConcluidas] = useState(false);
  const [fechados, setFechados] = useState<Set<string>>(new Set());
  const lista = itens.filter((t) => concluidas || !t.completed);
  const pendentes = itens.filter((t) => !t.completed).length;

  async function alternar(a: Atividade) {
    const er = await concluirAtividade(a.id, !a.completed);
    if (er) toast.error(er); else { toast.success(a.completed ? 'Reaberta.' : 'Concluída.'); onMudou(); }
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-3 px-4 py-3">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-[12.5px] text-muted"><b className="text-text">{pendentes}</b> atividades pendentes</span>
        <label className="ml-auto inline-flex cursor-pointer items-center gap-1.5 text-[12px] text-text-2">
          <input type="checkbox" checked={concluidas} onChange={(e) => setConcluidas(e.target.checked)} /> Mostrar concluídas
        </label>
        <button type="button" onClick={onNova} className="inline-flex items-center gap-1 rounded-md bg-brand px-3 py-1 text-[12px] font-semibold text-white transition hover:opacity-90"><Plus size={13} /> Nova atividade</button>
      </div>
      {TIPOS_ATIVIDADE.map((tp) => {
        const doTipo = lista.filter((t) => t.tipo === tp.id).sort((a, b) => (a.quando ?? '9').localeCompare(b.quando ?? '9'));
        if (!doTipo.length) return null;
        const fechado = fechados.has(tp.id);
        return (
          <div key={tp.id}>
            <button type="button" onClick={() => setFechados((s) => { const n = new Set(s); n.has(tp.id) ? n.delete(tp.id) : n.add(tp.id); return n; })}
              className="flex items-center gap-2 py-1 text-[13px] font-bold text-text">
              <ChevronDown size={13} className={cn('transition', fechado && '-rotate-90')} />
              <span className="h-2 w-2 rounded-full" style={{ background: COR_TIPO[tp.id] }} />{tp.label}
              <span className="text-[11px] font-medium text-muted">{doTipo.length}</span>
            </button>
            {!fechado && (
              <div className="mt-1 flex flex-col gap-1.5">
                {doTipo.map((a) => (
                  <div key={a.id} className="flex items-center gap-2.5 rounded-lg border border-border bg-surface px-3 py-2" style={{ borderLeft: `3px solid ${COR_TIPO[a.tipo] ?? COR_TIPO.tarefa}` }}>
                    <button type="button" onClick={() => alternar(a)} title={a.completed ? 'Reabrir' : 'Concluir'}
                      className={cn('grid h-[18px] w-[18px] flex-shrink-0 place-items-center rounded-full border-[1.5px] transition', a.completed ? 'border-success bg-success text-white' : 'border-border-strong hover:border-success')}>
                      {a.completed && <Check size={11} />}
                    </button>
                    <button type="button" onClick={() => onAbrir(a)} className="min-w-0 flex-1 text-left">
                      <span className={cn('block truncate text-[12.5px] font-semibold text-text', a.completed && 'line-through opacity-60')}>{a.descricao}</span>
                      <span className="block truncate text-[11px] text-muted">
                        {a.lead ? a.lead.empresa : 'Sem cliente'}{mostrarAutor && a.autor ? ` · ${a.autor.nome}` : ''}
                      </span>
                    </button>
                    <span className={cn('flex-shrink-0 text-[11px] font-semibold', estaAtrasada(a) ? 'text-danger' : 'text-muted')}>
                      {a.quando ? new Date(a.quando).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + (temHora(a.quando) ? ` ${hhmm(a.quando)}` : '') : 'sem data'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
      {lista.length === 0 && (
        <p className="py-12 text-center text-[12.5px] text-muted">Nada por aqui. As atividades da agenda, do lead e do app aparecem agrupadas por etiqueta.</p>
      )}
    </div>
  );
}

function EditorAtividade({ valor, onFechar, onSalvo }: { valor: Rascunho; onFechar: () => void; onSalvo: () => void }) {
  const { perfil } = useDados();
  const existente = !!valor.id;
  const meu = !existente || valor.autor_id === perfil.id;
  const [descricao, setDescricao] = useState(valor.descricao ?? '');
  const [tipo, setTipo] = useState(valor.tipo ?? 'ligacao');
  const [quando, setQuando] = useState(valor.quando ? paraCampoLocal(new Date(valor.quando)) : '');
  const [lead, setLead] = useState(valor.lead ?? null);
  const [buscaLead, setBuscaLead] = useState('');
  const [sugestoes, setSugestoes] = useState<{ id: string; empresa: string; contato: string | null }[]>([]);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!buscaLead.trim()) { setSugestoes([]); return; }
    const t = window.setTimeout(() => buscarLeads(buscaLead).then(setSugestoes), 250);
    return () => window.clearTimeout(t);
  }, [buscaLead]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onFechar(); } };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [onFechar]);

  async function salvar() {
    if (!descricao.trim() || salvando) return;
    setSalvando(true);
    const er = await salvarAtividade(perfil, {
      id: valor.id, descricao: descricao.trim(), tipo, quando: quando ? new Date(quando).toISOString() : null, lead_id: lead?.id ?? null,
    });
    setSalvando(false);
    if (er) { toast.error(er); return; }
    toast.success(existente ? 'Atividade atualizada.' : 'Atividade marcada.');
    onSalvo();
  }
  async function concluir() {
    const er = await concluirAtividade(valor.id!, !valor.completed);
    if (er) toast.error(er); else { toast.success(valor.completed ? 'Reaberta.' : 'Concluída.'); onSalvo(); }
  }
  async function apagar() {
    if (!window.confirm('Apagar esta atividade?')) return;
    const er = await apagarAtividade(valor.id!);
    if (er) toast.error(er); else { toast.success('Atividade apagada.'); onSalvo(); }
  }

  const campo = 'w-full rounded-md border border-border-strong bg-surface px-2.5 py-1.5 text-[12.5px] outline-none focus:border-brand';
  const rotulo = 'mb-2 block text-[11px] font-semibold uppercase tracking-wide text-muted';

  return (
    <div data-advox-editor className="pointer-events-auto fixed inset-0 z-[68] flex items-center justify-center bg-text/40 p-4" onClick={onFechar}>
      <div className="bc-anim-pop w-full max-w-sm rounded-xl border border-border bg-surface p-4 shadow-lg" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-[14px] font-bold">{existente ? 'Atividade' : 'Nova atividade'}</h3>
          <button type="button" onClick={onFechar} className="rounded-md border border-border-strong px-2.5 py-1 text-[12px] font-semibold text-text-2 transition hover:bg-surface-2">Fechar</button>
        </div>

        <div className="mb-2">
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted">Etiqueta</span>
          <div className="flex flex-wrap gap-1.5">
            {TIPOS_ATIVIDADE.map((t) => (
              <button key={t.id} type="button" disabled={!meu} onClick={() => setTipo(t.id)}
                className="rounded-md border px-2.5 py-0.5 text-[11.5px] font-bold transition disabled:opacity-50"
                style={{ borderColor: COR_TIPO[t.id], color: tipo === t.id ? '#fff' : COR_TIPO[t.id], background: tipo === t.id ? COR_TIPO[t.id] : undefined }}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <label className={rotulo}>
          Atividade
          <input autoFocus disabled={!meu} value={descricao} onChange={(e) => setDescricao(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && salvar()}
            placeholder="Ex.: Ligar para confirmar a portabilidade" className={cn(campo, 'mt-1 font-normal normal-case tracking-normal')} />
        </label>

        <label className={rotulo}>
          Quando
          <input type="datetime-local" disabled={!meu} value={quando} onChange={(e) => setQuando(e.target.value)} className={cn(campo, 'mt-1 font-normal normal-case tracking-normal')} />
        </label>

        {lead ? (
          <div className="mb-3 flex items-center gap-2 rounded-md border border-border bg-surface-2 px-2.5 py-1.5">
            <span className="min-w-0 flex-1 truncate text-[12px]"><span className="text-muted">Cliente: </span><span className="font-semibold text-text">{lead.empresa}</span></span>
            {meu && <button type="button" onClick={() => setLead(null)} title="Desvincular" className="text-[11px] text-muted transition hover:text-danger">✕</button>}
          </div>
        ) : meu && (
          <label className={cn(rotulo, 'mb-3')}>
            Cliente (opcional)
            <input value={buscaLead} onChange={(e) => setBuscaLead(e.target.value)} placeholder="Procure a empresa ou o contato…" className={cn(campo, 'mt-1 font-normal normal-case tracking-normal')} />
            {sugestoes.length > 0 && (
              <ul className="mt-1 max-h-32 overflow-y-auto rounded-md border border-border bg-surface">
                {sugestoes.map((l) => (
                  <li key={l.id}>
                    <button type="button" onClick={() => { setLead(l); setBuscaLead(''); }} className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left transition hover:bg-surface-2">
                      <span className="min-w-0 flex-1 truncate text-[12px] font-normal normal-case tracking-normal text-text">{l.empresa}</span>
                      {l.contato && <span className="flex-shrink-0 text-[10.5px] font-normal normal-case text-muted">{l.contato}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </label>
        )}

        {!meu && <p className="mb-3 rounded-md bg-surface-2 px-2.5 py-2 text-[11.5px] text-muted">Marcada por {valor.autor?.nome ?? 'outra pessoa'}. Só quem criou pode alterar.</p>}

        <div className="flex flex-wrap items-center justify-end gap-2">
          {existente && meu && (
            <>
              <button type="button" onClick={apagar} className="mr-auto inline-flex items-center gap-1 rounded-md border border-danger/50 px-2.5 py-1 text-[11.5px] font-semibold text-danger transition hover:bg-red-bg"><Trash2 size={12} /> Apagar</button>
              <button type="button" onClick={concluir} className="inline-flex items-center gap-1 rounded-md border border-success/60 px-2.5 py-1 text-[11.5px] font-semibold text-success transition hover:opacity-80">
                <Check size={12} /> {valor.completed ? 'Reabrir' : 'Feito'}
              </button>
            </>
          )}
          {meu && (
            <button type="button" onClick={salvar} disabled={!descricao.trim() || salvando} className="rounded-md bg-brand px-3 py-1 text-[12px] font-semibold text-white transition hover:opacity-90 disabled:opacity-50">
              {salvando ? 'Salvando…' : 'Salvar'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────── Notas ───────────────────────────────
function NotasView() {
  const { perfil } = useDados();
  const [notas, setNotas] = useState<Anotacao[] | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [cat, setCat] = useState<string | null>(null);
  const [editando, setEditando] = useState(false);
  const [titulo, setTitulo] = useState('');
  const [conteudo, setConteudo] = useState('');
  const [categoria, setCategoria] = useState('');
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => setNotas(await listarAnotacoes()), []);
  useEffect(() => { carregar(); }, [carregar]);

  const categorias = useMemo(() => Array.from(new Set((notas ?? []).map((n) => n.categoria).filter(Boolean) as string[])).sort(), [notas]);
  const lista = (notas ?? []).filter((n) => (!cat || n.categoria === cat) && (!busca.trim() || semAcento(`${n.titulo} ${n.conteudo} ${n.categoria ?? ''}`).includes(semAcento(busca.trim()))));
  const atual = (notas ?? []).find((n) => n.id === sel) ?? null;

  function comecar(n: Anotacao | null) {
    setSel(n?.id ?? null);
    setTitulo(n?.titulo ?? '');
    setConteudo(n?.conteudo ?? '');
    setCategoria(n?.categoria ?? '');
    setEditando(true);
  }
  async function salvar() {
    if (!titulo.trim() || salvando) return;
    setSalvando(true);
    const r = await salvarAnotacao(perfil, { id: sel ?? undefined, titulo: titulo.trim(), conteudo, categoria: categoria.trim() || null });
    setSalvando(false);
    if (r.erro) { toast.error(r.erro); return; }
    toast.success(sel ? 'Nota atualizada.' : 'Nota criada.');
    setSel(r.id ?? null);
    setEditando(false);
    carregar();
  }
  async function apagar() {
    if (!atual || !window.confirm(`Apagar a nota "${atual.titulo}"?`)) return;
    const er = await apagarAnotacao(atual.id);
    if (er) { toast.error(er); return; }
    toast.success('Nota apagada.');
    setSel(null);
    carregar();
  }
  async function copiar() {
    if (!atual) return;
    try { await navigator.clipboard.writeText(atual.conteudo); toast.success('Copiado.'); } catch { toast.error('Não consegui copiar.'); }
  }

  const campo = 'w-full rounded-md border border-border-strong bg-surface px-2.5 py-1.5 text-[12.5px] outline-none focus:border-brand';

  return (
    <div className="grid min-h-0 flex-1" style={{ gridTemplateColumns: '280px 1fr' }}>
      <aside className="flex min-h-0 flex-col gap-2 border-r border-border bg-surface p-3">
        <span className="relative">
          <Search size={12} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-muted" />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por título, categoria ou texto…" className={cn(campo, 'h-8 pl-6')} />
        </span>
        <button type="button" onClick={() => comecar(null)} className="inline-flex items-center justify-center gap-1 rounded-md bg-brand px-3 py-1.5 text-[12px] font-semibold text-white transition hover:opacity-90"><Plus size={13} /> Nova nota</button>
        {categorias.length > 0 && (
          <div className="flex flex-wrap gap-1">
            <Etiqueta ativa={cat === null} onClick={() => setCat(null)}>Tudo</Etiqueta>
            {categorias.map((c) => <Etiqueta key={c} ativa={cat === c} onClick={() => setCat(cat === c ? null : c)}>{c}</Etiqueta>)}
          </div>
        )}
        <div className="-mx-1 min-h-0 flex-1 overflow-y-auto">
          {notas === null ? (
            <div className="flex items-center gap-2 p-3 text-[12px] text-muted"><Loader2 size={13} className="animate-spin" /> Carregando…</div>
          ) : lista.length === 0 ? (
            <p className="p-3 text-[12px] text-muted">{notas.length ? 'Nenhuma nota com esse filtro.' : 'Nenhuma nota.'}</p>
          ) : lista.map((n) => (
            <button key={n.id} type="button" onClick={() => { setSel(n.id); setEditando(false); }}
              className={cn('mb-0.5 block w-full rounded-md px-2.5 py-2 text-left transition', sel === n.id ? 'bg-brand-50' : 'hover:bg-surface-2')}>
              <span className={cn('block truncate text-[12.5px] font-semibold', sel === n.id ? 'text-brand' : 'text-text')}>{n.titulo}</span>
              <span className="block truncate text-[11px] text-muted">
                {n.categoria ? `${n.categoria} · ` : ''}{new Date(n.updated_at).toLocaleDateString('pt-BR')} · {n.conteudo.slice(0, 60) || 'sem texto'}
              </span>
            </button>
          ))}
        </div>
      </aside>

      <section className="min-h-0 overflow-y-auto bg-surface px-6 py-5">
        {editando ? (
          <div className="mx-auto flex max-w-2xl flex-col gap-2.5">
            <input autoFocus value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Título da nota" maxLength={120} className={cn(campo, 'text-[15px] font-bold')} />
            <input value={categoria} onChange={(e) => setCategoria(e.target.value)} placeholder="Categoria (opcional) — ex.: Clientes, Ideias" list="advox-cats" className={campo} />
            <datalist id="advox-cats">{categorias.map((c) => <option key={c} value={c} />)}</datalist>
            <textarea value={conteudo} onChange={(e) => setConteudo(e.target.value)} rows={14} placeholder="Escreva aqui…" className={cn(campo, 'resize-y leading-relaxed')} />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setEditando(false)} className="rounded-md border border-border-strong px-3 py-1 text-[12px] font-semibold text-text-2 transition hover:bg-surface-2">Cancelar</button>
              <button type="button" onClick={salvar} disabled={!titulo.trim() || salvando} className="rounded-md bg-brand px-3 py-1 text-[12px] font-semibold text-white transition hover:opacity-90 disabled:opacity-50">{salvando ? 'Salvando…' : 'Salvar'}</button>
            </div>
          </div>
        ) : atual ? (
          <div className="mx-auto max-w-2xl">
            <div className="mb-1 flex items-start gap-2">
              <h2 className="min-w-0 flex-1 break-words text-[17px] font-bold text-text">{atual.titulo}</h2>
              <button type="button" onClick={copiar} title="Copiar o texto" className="inline-flex items-center gap-1 rounded-md border border-success/60 px-2.5 py-0.5 text-[11.5px] font-semibold text-success hover:opacity-80"><Copy size={11} /> Copiar</button>
              <button type="button" onClick={() => comecar(atual)} className="rounded-md border border-warning/60 px-2.5 py-0.5 text-[11.5px] font-semibold text-warning hover:opacity-80">Editar</button>
              <button type="button" onClick={apagar} className="rounded-md border border-danger/60 px-2.5 py-0.5 text-[11.5px] font-semibold text-danger hover:opacity-80">Apagar</button>
            </div>
            <p className="mb-4 text-[11.5px] text-muted">{atual.categoria ? `${atual.categoria} · ` : ''}atualizada em {new Date(atual.updated_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</p>
            <p className="whitespace-pre-wrap break-words text-[13px] leading-relaxed text-text-2">{atual.conteudo || <span className="text-muted">Sem texto.</span>}</p>
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <NotebookPen size={26} className="text-muted" />
            <p className="text-[13px] font-bold text-text">Suas notas</p>
            <p className="max-w-xs text-[12px] text-muted">Anotações pessoais — só você vê. São as mesmas da Minha Agenda do Advox.</p>
          </div>
        )}
      </section>
    </div>
  );
}

function Etiqueta({ children, ativa, cor, onClick }: { children: React.ReactNode; ativa: boolean; cor?: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className={cn('rounded-md border px-2 py-0.5 text-[11px] font-bold transition', !cor && (ativa ? 'border-brand bg-brand text-white' : 'border-border-strong text-text-2 hover:border-brand'))}
      style={cor ? { borderColor: cor, color: ativa ? '#fff' : cor, background: ativa ? cor : undefined } : undefined}>
      {children}
    </button>
  );
}
