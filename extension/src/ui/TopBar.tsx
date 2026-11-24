// Barra do topo (layout do BuildChat): marca, chips das pastas com contador
// (filtro; várias = só quem está em todas), "+" de Minhas pastas e a conta.
// Clicar em ponto livre da barra abre as mensagens rápidas.
import { useEffect, useState } from 'react';
import { CalendarDays, Plus } from 'lucide-react';
import { cn, emPx, ALTURA_TOPBAR } from '@/lib/utils';
import { abaGaveta, alternarPastaAtiva, gavetaAberta, menuHeader, modalAgenda, modalConta, modalPastas, pastasAtivas } from '@/lib/store';
import type { Pasta, Perfil } from '@/content/api';
import { ContaBotao, Logo } from './Conta';

export function TopBar({
  perfil, revenda, pastas, contagem,
}: {
  perfil: Perfil | null; revenda: string | null; pastas: Pasta[]; contagem: Record<string, number>;
}) {
  const [ativas, setAtivas] = useState<string[]>(pastasAtivas.get());
  useEffect(() => pastasAtivas.subscribe(setAtivas), []);
  const logado = !!perfil;

  const exigirLogin = () => {
    if (!logado) modalConta.set(true);
    return logado;
  };

  /** A marca é a "home": fecha gaveta, menus e o filtro de pastas. */
  const voltarAoWhatsapp = () => {
    gavetaAberta.set(false);
    modalPastas.set(false);
    menuHeader.set(null);
    modalAgenda.set(false);
    pastasAtivas.set([]);
  };

  const abrirRapidas = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button, a, input')) return;
    if (!exigirLogin()) return;
    abaGaveta.set('rapidas');
    gavetaAberta.set(true);
  };

  return (
    <div
      className="flex cursor-pointer items-center gap-2 border-b border-border bg-surface px-3"
      style={{ height: emPx(ALTURA_TOPBAR) }}
      onClick={abrirRapidas}
      title="Abrir mensagens rápidas"
    >
      <button
        type="button"
        onClick={voltarAoWhatsapp}
        title="Voltar ao WhatsApp"
        className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-md px-1 py-0.5 text-[13px] font-bold text-text transition hover:bg-surface-2"
      >
        <Logo />
        AdvoxChat
      </button>

      {/* Minha agenda (agenda, notas e etiquetas): ao lado da marca, antes das pastas. */}
      <button
        type="button"
        onClick={() => exigirLogin() && modalAgenda.set(!modalAgenda.get())}
        title="Minha agenda — atividades, notas e etiquetas"
        className="grid h-7 w-7 flex-shrink-0 place-items-center rounded-md text-text-2 transition hover:bg-surface-2 hover:text-brand"
      >
        <CalendarDays size={16} />
      </button>

      <span className="h-5 w-px flex-shrink-0 bg-border" />

      <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto py-1 [scrollbar-width:none]">
        <Chip ativo={ativas.length === 0} onClick={() => exigirLogin() && pastasAtivas.set([])}>
          Todas
        </Chip>
        {pastas.map((p) => (
          <Chip
            key={p.id}
            cor={p.cor}
            ativo={ativas.includes(p.id)}
            onClick={() => exigirLogin() && alternarPastaAtiva(p.id)}
            titulo={ativas.includes(p.id) ? 'Tirar do filtro' : 'Filtrar por esta pasta'}
          >
            {p.nome}
            {contagem[p.id] ? <span className="rounded-full bg-black/25 px-1 text-[9px] font-bold">{contagem[p.id]}</span> : null}
          </Chip>
        ))}
      </div>

      {/* Fora da faixa que rola: o "+" fica sempre à vista. */}
      <button
        type="button"
        onClick={() => exigirLogin() && modalPastas.set(true)}
        title="Minhas pastas — criar ou apagar"
        className="grid h-7 w-7 flex-shrink-0 place-items-center rounded-md border border-dashed border-border-strong text-muted transition hover:border-brand hover:text-brand"
      >
        <Plus size={14} />
      </button>

      <ContaBotao perfil={perfil} revenda={revenda} />
    </div>
  );
}

function Chip({
  children, ativo, cor, onClick, titulo,
}: {
  children: React.ReactNode; ativo?: boolean; cor?: string; onClick?: () => void; titulo?: string;
}) {
  // Fundo sólido na cor da pasta e texto branco; a ativa ganha um anel branco.
  const estilo = cor ? { background: cor, borderColor: cor, color: '#fff' } : undefined;
  return (
    <button
      type="button"
      onClick={onClick}
      title={titulo}
      className={cn(
        'inline-flex flex-shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border px-2.5 py-0.5 text-[11.5px] font-bold text-white transition',
        !cor && 'border-brand bg-brand',
        ativo ? 'ring-2 ring-white/70' : 'opacity-85 hover:opacity-100',
      )}
      style={estilo}
    >
      {children}
    </button>
  );
}
