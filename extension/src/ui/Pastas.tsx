// Lista da(s) pasta(s) do filtro por cima da lista nativa (#pane-side) e o
// modal "Minhas pastas". A lista do WhatsApp é virtualizada: filtrá-la
// quebraria a rolagem, então mostramos a nossa (técnica do BuildChat).
import { useCallback, useEffect, useState } from 'react';
import { Folder, Loader2, MessageSquare, Pencil, Trash2, X } from 'lucide-react';
import { cn, emPx, formatarHora, formatarTelefone, iniciais, semAcento, soDigitos, CORES_CATEGORIA } from '@/lib/utils';
import { modalPastas, pastasAtivas } from '@/lib/store';
import { criarPasta, editarPasta, excluirPasta, type Pasta } from '@/content/api';
import { abrirChat, bridgeDisponivel, fotosDosContatos, listarChats, type ChatResumo } from '@/content/wa';
import { useDados } from './dados';
import { toast } from './toast';

/** `ids`: uma ou mais pastas; com várias, só entram as conversas que estão em TODAS. */
export function PastaPanel({ ids }: { ids: string[] }) {
  const { pastas, conversas } = useDados();
  const filtro = ids.map((id) => pastas.find((p) => p.id === id)).filter((p): p is Pasta => !!p);
  const [chats, setChats] = useState<ChatResumo[] | null>(null);
  const [fotos, setFotos] = useState<Record<string, string | null>>({});
  const [rect, setRect] = useState<{ left: number; top: number; width: number; height: number } | null>(null);

  const medir = useCallback(() => {
    const pane = document.querySelector('#pane-side');
    if (!pane) return;
    const r = pane.getBoundingClientRect();
    setRect({ left: emPx(r.left), top: emPx(r.top), width: emPx(r.width), height: emPx(r.height) });
  }, []);

  useEffect(() => {
    medir();
    window.addEventListener('resize', medir);
    const t = window.setInterval(medir, 1500); // o layout do WhatsApp muda sem eventos
    return () => { window.removeEventListener('resize', medir); window.clearInterval(t); };
  }, [medir]);

  const chave = ids.join(',') + '|' + conversas.length;
  useEffect(() => {
    let vivo = true;
    (async () => {
      const todos = await listarChats();
      if (!vivo) return;
      const membrosDe = (id: string) => conversas.filter((c) => c.pasta_id === id);
      const naPasta = (c: ChatResumo, id: string) => membrosDe(id).some((m) =>
        m.chat_id === c.chatId || (soDigitos(m.telefone).length >= 8 && soDigitos(m.telefone) === soDigitos(c.telefone)));
      const achados = todos.filter((c) => ids.every((id) => naPasta(c, id)))
        .sort((a, b) => (b.ultimaTs ?? 0) - (a.ultimaTs ?? 0));
      // Conversa da pasta que o WhatsApp ainda não carregou aparece pelo que foi salvo (só com 1 pasta).
      const faltando = ids.length === 1
        ? membrosDe(ids[0])
          .filter((m) => !achados.some((c) => c.chatId === m.chat_id || (m.telefone && soDigitos(c.telefone) === soDigitos(m.telefone))))
          .map((m) => ({ chatId: m.chat_id, nome: m.nome ?? m.chat_id, telefone: m.telefone, ehGrupo: m.chat_id.endsWith('@g.us'), naoLidas: 0, ultimaTs: null }))
        : [];
      const lista = [...achados, ...faltando];
      setChats(lista);
      fotosDosContatos(lista.map((c) => c.chatId)).then((f) => vivo && setFotos((a) => ({ ...a, ...f })));
    })();
    return () => { vivo = false; };
  }, [chave]);

  const corPrincipal = filtro[0]?.cor ?? 'var(--brand)';
  if (!rect) return null;

  return (
    <div
      className="bc-anim-fade pointer-events-auto fixed z-[45] flex flex-col overflow-hidden border-r border-border bg-surface"
      style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height }}
    >
      <div className="flex flex-shrink-0 items-center gap-2 border-b border-border bg-surface-2 px-3 py-2">
        <span className="flex flex-shrink-0 items-center -space-x-1">
          {filtro.map((p) => <span key={p.id} className="h-2.5 w-2.5 rounded-full ring-1 ring-surface-2" style={{ background: p.cor }} />)}
        </span>
        <span className="min-w-0 flex-1 truncate text-[13px] font-bold" title={filtro.map((p) => p.nome).join(' + ')}>
          {filtro.length ? filtro.map((p) => p.nome).join(' + ') : 'Pasta'}
        </span>
        <span className="text-[11px] text-muted">{chats?.length ?? '…'} conversa(s)</span>
        <button type="button" onClick={() => pastasAtivas.set([])} className="grid h-7 w-7 place-items-center rounded-md text-muted transition hover:bg-surface" title="Fechar filtro">
          <X size={15} />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {chats === null ? (
          <div className="flex items-center justify-center gap-2 py-10 text-[12px] text-muted">
            <Loader2 size={14} className="animate-spin" /> Carregando…
          </div>
        ) : chats.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12 text-center text-[12px] text-muted">
            <MessageSquare size={20} />
            {bridgeDisponivel() ? (
              <>
                {ids.length > 1 ? 'Nenhuma conversa está em todas essas pastas ao mesmo tempo.' : 'Nenhuma conversa nesta pasta.'}
                <span className="max-w-[240px] text-[11px]">Coloque conversas na pasta pela guia Contato ou pelo ícone de pasta no cabeçalho da conversa.</span>
              </>
            ) : (
              <>
                Módulo WPP ainda não conectou.
                <span className="max-w-[240px] text-[11px]">Aguarde a bolinha verde no pé da barra lateral e clique na pasta de novo.</span>
              </>
            )}
          </div>
        ) : (
          chats.map((c) => (
            <button
              key={c.chatId}
              type="button"
              onClick={() => abrirChat(c.chatId)}
              className="flex w-full items-center gap-3 border-b border-border px-3 py-2.5 text-left transition last:border-b-0 hover:bg-surface-2"
            >
              {fotos[c.chatId] ? (
                <img src={fotos[c.chatId]!} alt="" className="h-10 w-10 flex-shrink-0 rounded-full object-cover" onError={() => setFotos((f) => ({ ...f, [c.chatId]: null }))} />
              ) : (
                <span className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-full text-[13px] font-bold text-white" style={{ background: corPrincipal }}>
                  {iniciais(c.nome)}
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13.5px] font-semibold">{c.nome || formatarTelefone(c.telefone)}</span>
                <span className="block truncate text-[11px] text-muted">{c.ehGrupo ? 'Grupo' : formatarTelefone(c.telefone) ?? ''}</span>
              </span>
              <span className="flex flex-shrink-0 flex-col items-end gap-1">
                <span className={cn('text-[10.5px]', c.naoLidas > 0 ? 'font-bold text-success' : 'text-muted')}>{formatarHora(c.ultimaTs)}</span>
                {c.naoLidas > 0 && (
                  <span className="grid h-4 min-w-4 place-items-center rounded-full bg-success px-1 text-[9.5px] font-bold text-white">{c.naoLidas}</span>
                )}
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

/** Modal "Minhas pastas": criar, renomear, trocar a cor e apagar. */
export function PastasModal() {
  const { pastas, contagem } = useDados();
  const [nome, setNome] = useState('');
  const [cor, setCor] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [editando, setEditando] = useState<string | null>(null);
  const [nomeEd, setNomeEd] = useState('');
  const fechar = () => modalPastas.set(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); fechar(); } };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, []);

  const corSugerida = CORES_CATEGORIA[pastas.length % CORES_CATEGORIA.length];
  const corEscolhida = cor ?? corSugerida;
  const repetida = pastas.some((p) => semAcento(p.nome) === semAcento(nome.trim()));

  async function criar() {
    const limpo = nome.trim();
    if (!limpo || repetida || salvando) return;
    setSalvando(true);
    const r = await criarPasta(limpo, corEscolhida, pastas.length);
    setSalvando(false);
    if (r.erro) { toast.error(r.erro); return; }
    setNome(''); setCor(null);
    toast.success(`Pasta "${limpo}" criada.`);
  }

  async function apagar(p: Pasta) {
    if (!window.confirm(`Apagar a pasta "${p.nome}"? As conversas continuam no WhatsApp, só saem da pasta.`)) return;
    const er = await excluirPasta(p.id);
    if (er) toast.error(er); else toast.success('Pasta apagada.');
  }

  return (
    <div className="pointer-events-auto fixed inset-0 z-[66] flex items-center justify-center bg-text/40 p-4" onClick={fechar}>
      <div className="bc-anim-pop flex max-h-[75vh] w-full max-w-md flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex flex-shrink-0 items-center justify-between border-b border-border px-4 py-3">
          <h3 className="inline-flex items-center gap-2 text-[15px] font-bold"><Folder size={16} className="text-brand" /> Minhas pastas</h3>
          <button type="button" onClick={fechar} className="flex-shrink-0 rounded-md border border-border-strong px-2.5 py-1 text-[12px] font-semibold text-text-2 transition hover:bg-surface-2">Fechar</button>
        </div>

        <div className="flex-shrink-0 border-b border-border bg-surface-2 px-4 py-3">
          <div className="flex gap-1.5">
            <input
              autoFocus
              value={nome}
              maxLength={40}
              onChange={(e) => setNome(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && criar()}
              placeholder="Nome da nova pasta…"
              className="h-8 min-w-0 flex-1 rounded-md border border-border-strong bg-surface px-2.5 text-[12.5px] outline-none focus:border-brand"
            />
            <button type="button" onClick={criar} disabled={!nome.trim() || repetida || salvando} className="rounded-md bg-brand px-3 text-[12px] font-semibold text-white transition hover:opacity-90 disabled:opacity-50">
              Criar
            </button>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {CORES_CATEGORIA.map((c) => (
              <button key={c} type="button" onClick={() => setCor(c)} title="Cor da pasta"
                className={cn('h-5 w-5 rounded-full transition', corEscolhida === c ? 'ring-2 ring-brand ring-offset-1' : 'opacity-80 hover:opacity-100')}
                style={{ background: c }} />
            ))}
          </div>
          <p className="mt-1.5 text-[11px] text-muted">
            {repetida && nome.trim() ? 'Já existe uma pasta com esse nome.' : 'As pastas são suas e ficam salvas no Advox — valem em qualquer computador.'}
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
          {pastas.length === 0 ? (
            <p className="py-6 text-center text-[12px] text-muted">Nenhuma pasta ainda.</p>
          ) : pastas.map((p) => (
            <div key={p.id} className="rounded-md px-2 py-1.5 hover:bg-surface-2">
              {editando === p.id ? (
                <div className="space-y-2 py-1">
                  <div className="flex gap-1.5">
                    <input autoFocus value={nomeEd} maxLength={40} onChange={(e) => setNomeEd(e.target.value)}
                      onKeyDown={async (e) => {
                        if (e.key === 'Escape') setEditando(null);
                        if (e.key === 'Enter' && nomeEd.trim()) { const er = await editarPasta(p.id, { nome: nomeEd.trim() }); if (er) toast.error(er); else setEditando(null); }
                      }}
                      className="h-8 min-w-0 flex-1 rounded-md border border-border-strong bg-surface px-2.5 text-[12.5px] outline-none focus:border-brand" />
                    <button type="button" disabled={!nomeEd.trim()} onClick={async () => { const er = await editarPasta(p.id, { nome: nomeEd.trim() }); if (er) toast.error(er); else setEditando(null); }}
                      className="rounded-md bg-brand px-3 text-[12px] font-semibold text-white disabled:opacity-50">Salvar</button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {CORES_CATEGORIA.map((c) => (
                      <button key={c} type="button" onClick={() => editarPasta(p.id, { cor: c })}
                        className={cn('h-5 w-5 rounded-full transition', p.cor === c ? 'ring-2 ring-brand ring-offset-1' : 'opacity-80 hover:opacity-100')}
                        style={{ background: c }} />
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 flex-shrink-0 rounded-full" style={{ background: p.cor }} />
                  <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold">{p.nome}</span>
                  {contagem[p.id] ? <span className="rounded-full px-1.5 text-[10px] font-bold text-white" style={{ background: p.cor }}>{contagem[p.id]}</span> : null}
                  <button type="button" onClick={() => { setEditando(p.id); setNomeEd(p.nome); }} title="Renomear / trocar a cor"
                    className="grid h-6 w-6 flex-shrink-0 place-items-center rounded-md text-muted transition hover:bg-surface hover:text-text">
                    <Pencil size={12} />
                  </button>
                  <button type="button" onClick={() => apagar(p)} title="Apagar esta pasta"
                    className="grid h-6 w-6 flex-shrink-0 place-items-center rounded-md text-muted transition hover:bg-red-bg hover:text-danger">
                    <Trash2 size={13} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
