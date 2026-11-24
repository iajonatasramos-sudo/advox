// Barra de funções no cabeçalho da conversa (como no BuildChat): pastas da
// conversa (com badge), filtro por pasta e o atalho para o Contato/lead.
// Os menus abrem no overlay principal (posição fixa, sem clipping do header).
import { useMemo, useState } from 'react';
import { Briefcase, Check, FolderInput, Loader2, Plus, Search, Tag } from 'lucide-react';
import { cn, emPx, semAcento, ZOOM, CORES_CATEGORIA } from '@/lib/utils';
import { abaGaveta, alternarPastaAtiva, gavetaAberta, menuHeader, pastasAtivas, type MenuHeader } from '@/lib/store';
import { colocarNaPasta, criarPasta, tirarDaPasta } from '@/content/api';
import { useDados } from './dados';
import { useSinal } from './sinal';
import { toast } from './toast';

const LARGURA_MENU = 320;

function abrir(tipo: NonNullable<MenuHeader>['tipo'], e: React.MouseEvent) {
  const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
  const x = Math.min(r.left, window.innerWidth - LARGURA_MENU * ZOOM - 8);
  const atual = menuHeader.get();
  menuHeader.set(atual?.tipo === tipo ? null : { tipo, x, y: r.bottom + 6 });
}

export function HeaderBar() {
  const { contato, pastasDaConversa, lead } = useDados();
  const qtde = contato ? pastasDaConversa(contato.chatId, contato.telefone).length : 0;

  return (
    <div className="flex items-center gap-0.5 pr-1">
      <Botao titulo="Pastas desta conversa" onClick={(e) => abrir('pastas', e)}>
        <span className="relative">
          <FolderInput size={18} />
          {qtde > 0 && <Badge>{qtde}</Badge>}
        </span>
      </Botao>
      <Botao titulo="Filtrar conversas por pasta" onClick={(e) => abrir('filtros', e)}>
        <Tag size={18} />
      </Botao>
      <Botao
        titulo={lead ? `Lead no Advox: ${lead.empresa}` : 'Cliente no Advox'}
        onClick={() => { abaGaveta.set('cliente'); gavetaAberta.set(true); }}
      >
        <span className="relative">
          <Briefcase size={18} className={lead ? 'text-brand' : undefined} />
          {lead && <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-success ring-2 ring-surface" />}
        </span>
      </Botao>
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="absolute -right-2.5 -top-2 grid h-4 min-w-4 place-items-center rounded-full bg-danger px-1 text-[9.5px] font-bold leading-none text-white">
      {children}
    </span>
  );
}

function Botao({ titulo, onClick, children }: { titulo: string; onClick: (e: React.MouseEvent) => void; children: React.ReactNode }) {
  return (
    <button type="button" title={titulo} onClick={onClick}
      className="grid h-9 w-9 place-items-center rounded-md text-muted transition hover:bg-black/10 hover:text-text-2">
      {children}
    </button>
  );
}

export function HeaderMenuOverlay() {
  const menu = useSinal(menuHeader);
  if (!menu) return null;
  const fechar = () => menuHeader.set(null);
  return (
    <div className="pointer-events-auto fixed inset-0 z-[65]" onClick={fechar}>
      <div
        className="bc-anim-pop fixed flex max-h-[440px] w-[320px] flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-lg"
        style={{ left: emPx(menu.x), top: emPx(menu.y) }}
        onClick={(e) => e.stopPropagation()}
      >
        {menu.tipo === 'pastas' && <MenuPastas />}
        {menu.tipo === 'filtros' && <MenuFiltros onEscolher={fechar} />}
      </div>
    </div>
  );
}

function Cabecalho({ titulo }: { titulo: string }) {
  return <div className="flex-shrink-0 border-b border-border bg-surface-2 px-3 py-2 text-[12px] font-bold text-text-2">{titulo}</div>;
}

/** Colocar/tirar a conversa aberta das pastas (com busca e "criar pasta"). */
function MenuPastas() {
  const { contato, pastas, contagem, pastasDaConversa, recarregar } = useDados();
  const [busca, setBusca] = useState('');
  const [ocupada, setOcupada] = useState<string | null>(null);
  const ordenadas = useMemo(() => [...pastas].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')), [pastas]);
  const termo = semAcento(busca.trim());
  const filtradas = termo ? ordenadas.filter((p) => semAcento(p.nome).includes(termo)) : ordenadas;
  const existe = pastas.some((p) => semAcento(p.nome) === termo);

  if (!contato) return <div className="p-4 text-center text-[12px] text-muted">Abra uma conversa para colocar numa pasta.</div>;
  const marcadas = pastasDaConversa(contato.chatId, contato.telefone);

  async function alternar(id: string) {
    setOcupada(id);
    const er = marcadas.includes(id) ? await tirarDaPasta(id, contato!.chatId) : await colocarNaPasta(id, contato!);
    setOcupada(null);
    if (er) toast.error(er);
    recarregar();
  }

  async function criarEColocar() {
    const nome = busca.trim();
    if (!nome) return;
    setOcupada('nova');
    const r = await criarPasta(nome, CORES_CATEGORIA[pastas.length % CORES_CATEGORIA.length], pastas.length);
    if (r.id) await colocarNaPasta(r.id, contato!);
    setOcupada(null);
    if (r.erro) toast.error(r.erro); else { setBusca(''); toast.success(`Conversa colocada em "${nome}".`); }
    recarregar();
  }

  return (
    <>
      <div className="flex-shrink-0 p-2">
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
          <input autoFocus value={busca} onChange={(e) => setBusca(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && termo && !existe) criarEColocar(); }}
            placeholder="Pesquisar ou criar pasta"
            className="h-8 w-full rounded-md border border-border-strong bg-surface pl-8 pr-2 text-[12.5px] outline-none focus:border-brand" />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto pb-1">
        {filtradas.length === 0 && !termo && <div className="py-6 text-center text-[12px] text-muted">Nenhuma pasta ainda. Digite um nome acima para criar.</div>}
        {filtradas.map((p) => {
          const ativa = marcadas.includes(p.id);
          return (
            <button key={p.id} type="button" onClick={() => alternar(p.id)} disabled={!!ocupada}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left transition hover:bg-surface-2">
              <span className={cn('grid h-4 w-4 flex-shrink-0 place-items-center rounded-full border', ativa ? 'text-white' : 'bg-surface')}
                style={{ borderColor: p.cor, background: ativa ? p.cor : undefined }}>
                {ocupada === p.id ? <Loader2 size={10} className="animate-spin" /> : ativa && <Check size={11} />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="inline-block max-w-full truncate rounded-md px-2 py-0.5 align-middle text-[12px] font-bold text-white" style={{ background: p.cor }}>{p.nome}</span>
              </span>
              {contagem[p.id] ? <span className="rounded-full px-1.5 text-[10px] font-bold text-white" style={{ background: p.cor }}>{contagem[p.id]}</span> : null}
            </button>
          );
        })}
        {termo && !existe && (
          <div className="px-2 pt-1">
            <button type="button" onClick={criarEColocar} disabled={!!ocupada}
              className="inline-flex w-full items-center gap-1.5 rounded-md border border-dashed border-brand/60 px-2.5 py-1.5 text-[12px] font-semibold text-brand transition hover:bg-brand/10 disabled:opacity-50">
              {ocupada === 'nova' ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Criar pasta “{busca.trim()}”
            </button>
          </div>
        )}
      </div>
    </>
  );
}

/** Filtro global: várias marcadas = só quem está em todas. "Todas as conversas" limpa e fecha. */
function MenuFiltros({ onEscolher }: { onEscolher: () => void }) {
  const { pastas, contagem } = useDados();
  const ativas = useSinal(pastasAtivas);
  const ordenadas = useMemo(() => [...pastas].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')), [pastas]);
  return (
    <>
      <Cabecalho titulo={ativas.length > 1 ? `Filtrar conversas · ${ativas.length} pastas combinadas` : 'Filtrar conversas'} />
      <div className="min-h-0 flex-1 overflow-y-auto py-1">
        <button type="button" onClick={() => { pastasAtivas.set([]); onEscolher(); }}
          className={cn('flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12.5px] font-semibold transition hover:bg-surface-2', ativas.length === 0 && 'text-brand')}>
          Todas as conversas
        </button>
        {ordenadas.map((p) => (
          <button key={p.id} type="button" onClick={() => alternarPastaAtiva(p.id)} title="Marque mais de uma para ver só quem está em todas"
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left transition hover:bg-surface-2">
            <span className={cn('grid h-4 w-4 flex-shrink-0 place-items-center rounded border', ativas.includes(p.id) ? 'border-brand bg-brand text-white' : 'border-border-strong')}>
              {ativas.includes(p.id) && <Check size={11} />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="inline-block max-w-full truncate rounded-md px-2 py-0.5 align-middle text-[12px] font-bold text-white" style={{ background: p.cor }}>{p.nome}</span>
            </span>
            {contagem[p.id] ? <span className="rounded-full px-1.5 text-[10px] font-bold text-white" style={{ background: p.cor }}>{contagem[p.id]}</span> : null}
          </button>
        ))}
      </div>
    </>
  );
}
