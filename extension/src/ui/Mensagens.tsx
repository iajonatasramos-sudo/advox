// Mensagens rápidas (porte do painel do BuildChat): busca, "+", filtros
// segmentados e categorias coloridas que abrem ao clicar. Clicar na mensagem
// (ou no avião) ENVIA na conversa aberta; o lápis edita. Tudo no servidor.
import { useMemo, useRef, useState } from 'react';
import { ChevronDown, FileText, Loader2, Pencil, Plus, Search, Send, Shapes, Sparkles, Trash2, Users } from 'lucide-react';
import { cn, CORES_CATEGORIA } from '@/lib/utils';
import {
  aplicarVariaveis, excluirCategoria, excluirMensagem, marcarUso, salvarCategoria, salvarMensagem,
  type Categoria, type MensagemRapida,
} from '@/content/api';
import { enviarTexto } from '@/content/wa';
import { useDados } from './dados';
import { inputCls } from './Conta';
import { toast } from './toast';

type Filtro = 'tudo' | 'avulsas' | 'usadas' | 'revenda';
const FILTROS: [Filtro, string][] = [['tudo', 'Tudo'], ['avulsas', 'Avulsas'], ['usadas', 'Usadas'], ['revenda', 'Equipe']];
type Grupo = { chave: string; nome: string; cor: string; categoria: Categoria | null; itens: MensagemRapida[] };

export const VARIAVEIS = [
  { chave: '{{nome}}', rotulo: 'Nome do cliente' },
  { chave: '{{empresa}}', rotulo: 'Empresa' },
  { chave: '{{operadora}}', rotulo: 'Operadora' },
  { chave: '{{eu}}', rotulo: 'Meu nome' },
];

const MODELOS = [
  { titulo: 'Primeiro contato', atalho: 'oi', texto: 'Olá {{nome}}, tudo bem? Aqui é {{eu}}. Vi que a {{empresa}} usa a {{operadora}} e tenho uma proposta que pode reduzir sua conta. Posso te mostrar?' },
  { titulo: 'Multa de fidelidade', atalho: 'multa', texto: '{{nome}}, se a {{operadora}} está cobrando multa para você sair, temos um escritório parceiro que analisa o contrato. Em muitos casos a multa é indevida. Quer que eu verifique?' },
  { titulo: 'Retorno combinado', atalho: 'retorno', texto: 'Oi {{nome}}, conforme combinamos, estou retornando sobre a proposta para a {{empresa}}. Conseguiu avaliar?' },
  { titulo: 'Pedir documentos', atalho: 'docs', texto: '{{nome}}, para seguir preciso de: contrato atual com a {{operadora}}, última fatura e cartão CNPJ. Pode me enviar por aqui mesmo?' },
];

export function MensagensView() {
  const { mensagens, categorias, carregado, perfil, vars, contato } = useDados();
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('tudo');
  const [abertas, setAbertas] = useState<Set<string>>(new Set());
  const [dlgMsg, setDlgMsg] = useState<MensagemRapida | 'nova' | null>(null);
  const [dlgCat, setDlgCat] = useState<Categoria | 'nova' | null>(null);
  const [semeando, setSemeando] = useState(false);
  const [enviando, setEnviando] = useState<string | null>(null);

  const toggle = (k: string) => setAbertas((p) => { const n = new Set(p); n.has(k) ? n.delete(k) : n.add(k); return n; });

  const grupos = useMemo<Grupo[]>(() => {
    const q = busca.trim().toLowerCase();
    const resps = mensagens.filter((m) => !q || m.titulo.toLowerCase().includes(q) || (m.atalho ?? '').includes(q) || m.texto.toLowerCase().includes(q));
    if (filtro === 'usadas') {
      return [{ chave: 'usadas', nome: 'MAIS USADAS', cor: '#ec4899', categoria: null, itens: [...resps].filter((m) => m.usos > 0).sort((a, b) => b.usos - a.usos).slice(0, 10) }];
    }
    if (filtro === 'avulsas') {
      return [{ chave: 'sem', nome: 'SEM CATEGORIA', cor: '#6366f1', categoria: null, itens: resps.filter((m) => !m.categoria_id) }];
    }
    if (filtro === 'revenda') {
      return [{ chave: 'revenda', nome: 'DA EQUIPE (REVENDA)', cor: '#14b8a6', categoria: null, itens: resps.filter((m) => !!m.revenda_id) }];
    }
    const conhecidas = new Set(categorias.map((c) => c.id));
    const out: Grupo[] = categorias.map((c) => ({
      chave: c.id, nome: c.nome.toUpperCase(), cor: c.cor, categoria: c, itens: resps.filter((m) => m.categoria_id === c.id),
    }));
    const sem = resps.filter((m) => !m.categoria_id || !conhecidas.has(m.categoria_id));
    if (sem.length) out.push({ chave: 'sem', nome: 'SEM CATEGORIA', cor: '#6366f1', categoria: null, itens: sem });
    // Com busca, mostra só os grupos com resultado e já abertos.
    return q ? out.filter((g) => g.itens.length > 0) : out.filter((g) => g.itens.length > 0 || g.categoria);
  }, [mensagens, categorias, busca, filtro]);

  async function usar(m: MensagemRapida) {
    if (!contato) { toast.error('Abra uma conversa para enviar.'); return; }
    setEnviando(m.id);
    const ok = await enviarTexto(aplicarVariaveis(m.texto, vars));
    setEnviando(null);
    if (!ok) { toast.error('Não consegui enviar. Atualize a página do WhatsApp.'); return; }
    marcarUso(m.id);
  }

  async function semear() {
    setSemeando(true);
    const cat = await salvarCategoria({ nome: 'Telecom', cor: '#3b82f6', revenda_id: null, ordem: categorias.length });
    for (const m of MODELOS) {
      // Atalho já usado por outra mensagem fica em branco para não falhar.
      const usado = mensagens.some((x) => x.atalho === m.atalho);
      await salvarMensagem({ ...m, atalho: usado ? null : m.atalho, revenda_id: null, categoria_id: cat.id ?? null });
    }
    setSemeando(false);
    setAbertas(new Set(cat.id ? [cat.id] : []));
    toast.success('Modelos adicionados na categoria Telecom.');
  }

  const vazio = carregado && mensagens.length === 0 && categorias.length === 0;

  return (
    <>
      <div className="flex items-center gap-2 px-3 pb-2 pt-3">
        <div className="relative flex-1">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Pesquisar resposta rápida"
            className="h-9 w-full rounded-md border border-border bg-surface-2 pl-8 pr-2 text-[13px] outline-none transition focus:border-brand focus:bg-surface focus:ring-2 focus:ring-brand/20" />
        </div>
        <button type="button" onClick={() => setDlgMsg('nova')} title="Nova resposta rápida"
          className="bc-elev grid h-9 w-9 flex-shrink-0 place-items-center rounded-md bg-brand text-white transition hover:brightness-110">
          <Plus size={16} />
        </button>
      </div>

      <div className="px-3 pb-2.5">
        <div className="bc-seg w-full">
          {FILTROS.map(([v, r]) => (
            <button key={v} type="button" data-ativo={filtro === v ? 1 : 0} onClick={() => setFiltro(v)} className="flex-1">{r}</button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-3 pb-4">
        {!carregado ? (
          <div className="flex items-center justify-center gap-2 py-10 text-[12px] text-muted"><Loader2 size={14} className="animate-spin" /> Carregando…</div>
        ) : vazio ? (
          <div className="py-8 text-center">
            <p className="text-[12px] text-muted">Nenhuma resposta rápida ainda.</p>
            <div className="mt-3 flex flex-col items-center gap-2">
              <button type="button" onClick={semear} disabled={semeando}
                className="inline-flex items-center gap-1.5 rounded-md bg-brand px-3 py-1.5 text-[12px] font-semibold text-white transition hover:opacity-90 disabled:opacity-50">
                {semeando ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />} Adicionar modelos de telecom
              </button>
              <button type="button" onClick={() => setDlgMsg('nova')} className="text-[12px] font-semibold text-brand hover:underline">Criar a primeira</button>
            </div>
          </div>
        ) : grupos.length === 0 || grupos.every((g) => g.itens.length === 0 && !g.categoria) ? (
          <p className="py-10 text-center text-[12px] text-muted">Nada encontrado.</p>
        ) : (
          <>
            {grupos.map((g) => (
              <GrupoCard key={g.chave} g={g} aberta={abertas.has(g.chave) || !!busca.trim() || filtro !== 'tudo'} onToggle={() => toggle(g.chave)}
                podeEditarCat={!!g.categoria && g.categoria.dono_id === perfil.id}
                onEditarCat={() => g.categoria && setDlgCat(g.categoria)}
                minhaId={perfil.id} enviando={enviando} onUsar={usar} onEditar={(m) => setDlgMsg(m)} />
            ))}
            {filtro === 'tudo' && !busca.trim() && (
              <button type="button" onClick={() => setDlgCat('nova')}
                className="w-full rounded-lg border border-dashed border-border-strong py-2 text-[12px] font-semibold text-muted transition hover:border-brand hover:text-brand">
                + Nova categoria
              </button>
            )}
          </>
        )}
      </div>

      {dlgMsg && (
        <MensagemDialog mensagem={dlgMsg === 'nova' ? null : dlgMsg} onCriarCategoria={() => setDlgCat('nova')} onClose={() => setDlgMsg(null)} />
      )}
      {dlgCat && <CategoriaDialog categoria={dlgCat === 'nova' ? null : dlgCat} onClose={() => setDlgCat(null)} />}
    </>
  );
}

function GrupoCard({
  g, aberta, onToggle, podeEditarCat, onEditarCat, minhaId, enviando, onUsar, onEditar,
}: {
  g: Grupo; aberta: boolean; onToggle: () => void; podeEditarCat: boolean; onEditarCat: () => void;
  minhaId: string; enviando: string | null; onUsar: (m: MensagemRapida) => void; onEditar: (m: MensagemRapida) => void;
}) {
  return (
    <div style={{ ['--cat' as string]: g.cor } as React.CSSProperties} className="bc-cat-box bc-elev-hover overflow-hidden rounded-lg border">
      <div className="bc-cat-head flex items-center gap-2 px-3 py-2 text-text">
        <button type="button" onClick={onToggle} className="flex min-w-0 flex-1 items-center gap-2 text-left">
          <Shapes size={14} style={{ color: 'var(--cat)' }} />
          <span className="min-w-0 flex-1 truncate text-[11.5px] font-bold tracking-tight">{g.nome}</span>
          {g.categoria?.revenda_id && <Users size={12} className="flex-shrink-0 opacity-70" />}
          <span className="grid h-[18px] min-w-[18px] place-items-center rounded-md px-1 text-[10.5px] font-bold text-white" style={{ background: g.cor }}>
            {g.itens.length}
          </span>
        </button>
        {podeEditarCat && (
          <button type="button" onClick={onEditarCat} title="Editar categoria" className="opacity-70 hover:opacity-100"><Pencil size={13} /></button>
        )}
        <button type="button" onClick={onToggle}><ChevronDown size={15} className={cn('transition', !aberta && '-rotate-90')} /></button>
      </div>
      {aberta && (
        <div>
          {g.itens.length === 0 && <div className="bc-cat-item px-3 py-2.5 text-[12px] text-muted">Nenhuma mensagem nesta categoria.</div>}
          {g.itens.map((m) => (
            <div key={m.id} className="bc-cat-item group flex items-center gap-1.5 px-3 py-2.5 transition">
              <span className="bc-cat-chip grid h-7 w-7 flex-shrink-0 place-items-center rounded-md" title="Texto">
                <FileText size={14} />
              </span>
              <button type="button" onClick={() => onUsar(m)} title={m.texto} className="min-w-0 flex-1 truncate text-left text-[13px] font-medium text-text">
                {m.titulo}
                {m.atalho && <span className="ml-1.5 font-mono text-[10px] font-normal text-muted">/{m.atalho}</span>}
                {m.usos > 0 && <span className="ml-1.5 text-[10px] font-normal text-muted">· {m.usos}</span>}
              </button>
              {m.dono_id === minhaId && (
                <button type="button" onClick={() => onEditar(m)} title="Editar" className="grid h-7 w-7 place-items-center rounded-md text-muted transition hover:bg-surface-2">
                  <Pencil size={14} />
                </button>
              )}
              <button type="button" onClick={() => onUsar(m)} title="Enviar para a conversa" disabled={enviando === m.id}
                className="grid h-7 w-7 place-items-center rounded-md text-brand transition hover:bg-brand hover:text-white">
                {enviando === m.id ? <Loader2 size={14} className="animate-spin" /> : <Send size={15} />}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ───────────────────────── Diálogos ─────────────────────────

export function Modal({ titulo, onClose, children }: { titulo: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="pointer-events-auto fixed inset-0 z-[60] flex items-center justify-center bg-text/40 p-4" onClick={onClose}>
      <div className="bc-anim-pop flex max-h-[72vh] w-full max-w-md flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex flex-shrink-0 items-center justify-between border-b border-border px-4 py-3">
          <h3 className="text-[14px] font-bold">{titulo}</h3>
          <button type="button" onClick={onClose} className="flex-shrink-0 rounded-md border border-border-strong px-2.5 py-1 text-[12px] font-semibold text-text-2 transition hover:bg-surface-2">Fechar</button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  );
}

export function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</span>
      {children}
    </label>
  );
}

function MensagemDialog({ mensagem, onCriarCategoria, onClose }: { mensagem: MensagemRapida | null; onCriarCategoria: () => void; onClose: () => void }) {
  const { categorias, perfil } = useDados();
  const [titulo, setTitulo] = useState(mensagem?.titulo ?? '');
  const [atalho, setAtalho] = useState(mensagem?.atalho ?? '');
  const [categoriaId, setCategoriaId] = useState(mensagem?.categoria_id ?? '');
  const [texto, setTexto] = useState(mensagem?.texto ?? '');
  const [equipe, setEquipe] = useState(!!mensagem?.revenda_id);
  const [salvando, setSalvando] = useState(false);
  const coord = ['coord', 'gerente', 'proprietario'].includes(perfil.papel) && !!perfil.revenda_id;
  const areaRef = useRef<HTMLTextAreaElement | null>(null);

  function inserirVar(v: string) {
    const area = areaRef.current;
    if (!area) { setTexto((t) => t + v); return; }
    const { selectionStart: a, selectionEnd: b } = area;
    setTexto((t) => t.slice(0, a) + v + t.slice(b));
  }

  async function salvar() {
    if (!titulo.trim() || !texto.trim()) { toast.error('Preencha o título e o texto.'); return; }
    setSalvando(true);
    const er = await salvarMensagem({
      id: mensagem?.id, titulo, atalho: atalho || null, texto,
      revenda_id: coord && equipe ? perfil.revenda_id : null, categoria_id: categoriaId || null,
    });
    setSalvando(false);
    if (er) { toast.error(er); return; }
    toast.success(mensagem ? 'Mensagem atualizada.' : 'Mensagem criada.');
    onClose();
  }

  async function excluir() {
    if (!mensagem || !window.confirm(`Excluir a mensagem "${mensagem.titulo}"?`)) return;
    const er = await excluirMensagem(mensagem.id);
    if (er) toast.error(er); else { toast.success('Mensagem excluída.'); onClose(); }
  }

  return (
    <Modal titulo={mensagem ? 'Editar resposta rápida' : 'Nova resposta rápida'} onClose={onClose}>
      <div className="space-y-3">
        <Campo label="Título">
          <input autoFocus value={titulo} maxLength={60} onChange={(e) => setTitulo(e.target.value)} className={inputCls} placeholder="Ex.: Primeiro contato" />
        </Campo>
        <div className="grid grid-cols-2 gap-2">
          <Campo label="Atalho (/)">
            <input value={atalho} maxLength={20} onChange={(e) => setAtalho(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))} className={inputCls} placeholder="oi" />
          </Campo>
          <Campo label="Categoria">
            <select value={categoriaId} onChange={(e) => { if (e.target.value === '__nova') onCriarCategoria(); else setCategoriaId(e.target.value); }} className={inputCls}>
              <option value="">Sem categoria</option>
              {categorias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              <option value="__nova">+ Nova categoria…</option>
            </select>
          </Campo>
        </div>
        <Campo label="Texto">
          <textarea ref={areaRef} value={texto} maxLength={4000} onChange={(e) => setTexto(e.target.value)} rows={6}
            className="w-full resize-y rounded-md border border-border-strong bg-surface px-2.5 py-2 text-[13px] outline-none focus:border-brand"
            placeholder="Olá {{nome}}, tudo bem?" />
        </Campo>
        <div className="flex flex-wrap gap-1.5">
          {VARIAVEIS.map((v) => (
            <button key={v.chave} type="button" onClick={() => inserirVar(v.chave)} title={v.rotulo}
              className="rounded-md border border-brand/40 bg-brand/10 px-2 py-0.5 font-mono text-[11px] font-semibold text-brand transition hover:bg-brand hover:text-white">
              {v.chave}
            </button>
          ))}
        </div>
        {coord && (
          <label className="flex cursor-pointer items-start gap-2 rounded-md border border-border bg-surface-2 p-2.5 text-[12px] text-text-2">
            <input type="checkbox" checked={equipe} onChange={(e) => setEquipe(e.target.checked)} className="mt-0.5" />
            Compartilhar com a revenda — todos os representantes veem e usam (só você edita).
          </label>
        )}
        <div className="flex items-center justify-between pt-1">
          {mensagem ? (
            <button type="button" onClick={excluir} className="inline-flex items-center gap-1.5 text-[12px] font-medium text-danger hover:underline"><Trash2 size={14} /> Excluir</button>
          ) : <span />}
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="rounded-md border border-border-strong px-3 py-1.5 text-[13px] font-medium text-text-2 hover:bg-surface-2">Cancelar</button>
            <button type="button" onClick={salvar} disabled={salvando} className="inline-flex items-center gap-1.5 rounded-md bg-brand px-3 py-1.5 text-[13px] font-semibold text-white hover:opacity-90 disabled:opacity-50">
              {salvando && <Loader2 size={14} className="animate-spin" />} Salvar
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function CategoriaDialog({ categoria, onClose }: { categoria: Categoria | null; onClose: () => void }) {
  const { categorias, perfil } = useDados();
  const [nome, setNome] = useState(categoria?.nome ?? '');
  const [cor, setCor] = useState(categoria?.cor ?? CORES_CATEGORIA[categorias.length % CORES_CATEGORIA.length]);
  const [equipe, setEquipe] = useState(!!categoria?.revenda_id);
  const [salvando, setSalvando] = useState(false);
  const coord = ['coord', 'gerente', 'proprietario'].includes(perfil.papel) && !!perfil.revenda_id;

  async function salvar() {
    if (!nome.trim()) { toast.error('Dê um nome à categoria.'); return; }
    setSalvando(true);
    const r = await salvarCategoria({ id: categoria?.id, nome, cor, revenda_id: coord && equipe ? perfil.revenda_id : null, ordem: categoria ? undefined : categorias.length });
    setSalvando(false);
    if (r.erro) { toast.error(r.erro); return; }
    toast.success(categoria ? 'Categoria atualizada.' : 'Categoria criada.');
    onClose();
  }

  async function excluir() {
    if (!categoria || !window.confirm(`Excluir a categoria "${categoria.nome}"? As mensagens ficam sem categoria.`)) return;
    const er = await excluirCategoria(categoria.id);
    if (er) toast.error(er); else { toast.success('Categoria removida (mensagens ficaram sem categoria).'); onClose(); }
  }

  return (
    <Modal titulo={categoria ? 'Editar categoria' : 'Nova categoria'} onClose={onClose}>
      <div className="space-y-3">
        <Campo label="Nome">
          <input autoFocus value={nome} maxLength={40} onChange={(e) => setNome(e.target.value)} className={inputCls} placeholder="Ex.: Saudação" />
        </Campo>
        <Campo label="Cor">
          <div className="flex flex-wrap items-center gap-2">
            <input type="color" value={cor} onChange={(e) => setCor(e.target.value)} title="Escolher cor"
              className="h-8 w-10 cursor-pointer rounded-md border border-border-strong bg-surface p-0.5" />
            {CORES_CATEGORIA.map((c) => (
              <button key={c} type="button" onClick={() => setCor(c)} style={{ background: c }}
                className={cn('h-6 w-6 rounded-full ring-2 transition', cor.toLowerCase() === c ? 'ring-text' : 'ring-transparent')} />
            ))}
          </div>
        </Campo>
        {coord && (
          <label className="flex cursor-pointer items-start gap-2 rounded-md border border-border bg-surface-2 p-2.5 text-[12px] text-text-2">
            <input type="checkbox" checked={equipe} onChange={(e) => setEquipe(e.target.checked)} className="mt-0.5" />
            Categoria da revenda — aparece para todo o time.
          </label>
        )}
        <div className="flex items-center justify-between pt-1">
          {categoria ? (
            <button type="button" onClick={excluir} className="inline-flex items-center gap-1.5 text-[12px] font-medium text-danger hover:underline"><Trash2 size={14} /> Excluir</button>
          ) : <span />}
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="rounded-md border border-border-strong px-3 py-1.5 text-[13px] font-medium text-text-2 hover:bg-surface-2">Cancelar</button>
            <button type="button" onClick={salvar} disabled={salvando} className="inline-flex items-center gap-1.5 rounded-md bg-brand px-3 py-1.5 text-[13px] font-semibold text-white hover:opacity-90 disabled:opacity-50">
              {salvando && <Loader2 size={14} className="animate-spin" />} Salvar
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
