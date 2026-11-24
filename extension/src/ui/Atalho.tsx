// Seletor de respostas rápidas ao digitar "/" na caixa de mensagem (BuildChat):
// ↑↓ navegam, Enter ENVIA, Tab só coloca o texto na caixa, Esc fecha.
import { useEffect, useMemo, useRef, useState } from 'react';
import { FileText, Zap } from 'lucide-react';
import { cn, emPx } from '@/lib/utils';
import { aplicarVariaveis, marcarUso, type MensagemRapida } from '@/content/api';
import { caixaDeMensagem, enviarTexto, inserirNaCaixa, limparCaixa } from '@/content/wa';
import { useDados } from './dados';
import { toast } from './toast';

export function AtalhoPicker() {
  const { mensagens, vars } = useDados();
  const [query, setQuery] = useState<string | null>(null);
  const [ativo, setAtivo] = useState(0);
  const [pos, setPos] = useState({ left: 0, bottom: 0, width: 400 });
  const abertoRef = useRef(false);

  const filtradas = useMemo(() => {
    if (query === null) return [];
    const q = query.toLowerCase();
    return mensagens
      .filter((m) => !q || (m.atalho ?? '').includes(q) || m.titulo.toLowerCase().includes(q))
      .sort((a, b) => Number((b.atalho ?? '').startsWith(q)) - Number((a.atalho ?? '').startsWith(q)))
      .slice(0, 30);
  }, [mensagens, query]);
  abertoRef.current = query !== null;

  async function enviar(m: MensagemRapida) {
    setQuery(null);
    limparCaixa();
    const ok = await enviarTexto(aplicarVariaveis(m.texto, vars));
    if (ok) marcarUso(m.id); else toast.error('Não consegui enviar. Atualize a página do WhatsApp.');
  }

  async function inserir(m: MensagemRapida) {
    setQuery(null);
    await inserirNaCaixa(aplicarVariaveis(m.texto, vars));
    marcarUso(m.id);
  }

  useEffect(() => {
    function posicionar() {
      const box = caixaDeMensagem();
      if (!box) return;
      const r = box.getBoundingClientRect();
      setPos({ left: emPx(r.left), bottom: emPx(window.innerHeight - r.top + 8), width: emPx(r.width) });
    }
    function onInput(e: Event) {
      const box = caixaDeMensagem();
      if (!box || !(e.target instanceof Node) || !(e.target === box || box.contains(e.target))) return;
      const texto = (box.textContent ?? '').trim();
      if (texto.startsWith('/')) { setQuery(texto.slice(1).trim().toLowerCase()); setAtivo(0); posicionar(); }
      else setQuery(null);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (!abertoRef.current) return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault(); e.stopPropagation();
        setAtivo((i) => { const n = filtradas.length || 1; return (i + (e.key === 'ArrowDown' ? 1 : -1) + n) % n; });
      } else if (e.key === 'Enter' && !e.shiftKey) {
        if (filtradas.length) { e.preventDefault(); e.stopPropagation(); enviar(filtradas[Math.min(ativo, filtradas.length - 1)]); }
      } else if (e.key === 'Tab') {
        if (filtradas.length) { e.preventDefault(); e.stopPropagation(); inserir(filtradas[Math.min(ativo, filtradas.length - 1)]); }
      } else if (e.key === 'Escape') {
        setQuery(null);
      }
    }
    document.addEventListener('input', onInput, true);
    document.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('resize', posicionar);
    return () => {
      document.removeEventListener('input', onInput, true);
      document.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('resize', posicionar);
    };
  }, [filtradas, ativo, vars]);

  if (query === null) return null;

  return (
    <div className="bc-anim-pop pointer-events-auto fixed z-[70] overflow-hidden rounded-lg border border-border bg-surface shadow-lg"
      style={{ left: pos.left, bottom: pos.bottom, width: Math.min(pos.width, 520) }}>
      <div className="flex items-center gap-1.5 border-b border-border bg-surface-2 px-3 py-1.5 text-[11px] font-semibold text-text-2">
        <Zap size={12} className="text-brand" /> Respostas rápidas
        <span className="ml-auto font-normal text-muted">↑↓ navegar · Enter enviar · Tab inserir</span>
      </div>
      <div className="max-h-72 overflow-y-auto">
        {filtradas.length === 0 ? (
          <div className="px-3 py-3 text-[12px] text-muted">Nenhuma resposta encontrada.</div>
        ) : filtradas.map((m, i) => (
          <button key={m.id} type="button" onMouseEnter={() => setAtivo(i)} onMouseDown={(e) => { e.preventDefault(); enviar(m); }}
            className={cn('flex w-full items-center gap-2 border-b border-border px-3 py-2 text-left transition last:border-b-0', i === ativo ? 'bg-brand/10' : 'hover:bg-surface-2')}>
            <span className="grid h-7 w-7 flex-shrink-0 place-items-center rounded-md bg-brand/10 text-brand"><FileText size={14} /></span>
            {m.atalho && <span className="flex-shrink-0 font-mono text-[11px] font-bold text-brand">/{m.atalho}</span>}
            <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium">{m.titulo}</span>
            <span className="max-w-[40%] flex-shrink-0 truncate text-[11px] text-muted">{aplicarVariaveis(m.texto, vars).slice(0, 60)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
