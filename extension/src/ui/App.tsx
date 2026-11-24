// Shell da extensão (layout do BuildChat): barra do topo e barra do cabeçalho
// da conversa (via portal nos shadow roots delas), barra lateral à direita,
// gaveta com as guias Contato / Mensagens, lista da pasta, modais e o "/".
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Session } from '@supabase/supabase-js';
import { BookUser, CalendarDays, ExternalLink, User, X, Zap } from 'lucide-react';
import { cn, emPx, ALTURA_TOPBAR, LARGURA_TRILHO } from '@/lib/utils';
import { abaAgenda, abaGaveta, gavetaAberta, logado, modalAgenda, modalConta, modalPastas, pastasAtivas } from '@/lib/store';
import { APP_URL, abrirPainel, meuPerfil, nomeDaRevenda, sb, sessaoAtual, type Pasta, type Perfil } from '@/content/api';
import { bridgeDisponivel } from '@/content/wa';
import { DadosProvider, useDados } from './dados';
import { TopBar } from './TopBar';
import { HeaderBar, HeaderMenuOverlay } from './Header';
import { PastaPanel, PastasModal } from './Pastas';
import { MensagensView } from './Mensagens';
import { ContatoView } from './Contato';
import { AtalhoPicker } from './Atalho';
import { AgendaModal } from './Agenda';
import { LoginModal, Logo } from './Conta';
import { Toaster } from './toast';
import { useSinal } from './sinal';

const PAPEIS_OK = ['rep', 'coord', 'gerente', 'proprietario', 'admin'];

export function App({ topbar, header }: { topbar: HTMLElement; header: { get: () => HTMLElement | null; subscribe: (fn: (v: HTMLElement | null) => void) => () => void } }) {
  const [sessao, setSessao] = useState<Session | null | undefined>(undefined);
  const [perfil, setPerfil] = useState<Perfil | null | undefined>(undefined);
  const [revenda, setRevenda] = useState<string | null>(null);
  const conta = useSinal(modalConta);

  useEffect(() => {
    sessaoAtual().then(setSessao);
    const { data } = sb.auth.onAuthStateChange((_e, s) => setSessao(s));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (sessao === undefined) return;
    if (!sessao?.user) { setPerfil(null); return; }
    meuPerfil(sessao.user.id).then(setPerfil);
  }, [sessao?.user?.id, sessao === undefined]);

  useEffect(() => {
    setRevenda(null);
    if (perfil?.revenda_id) nomeDaRevenda(perfil.revenda_id).then(setRevenda);
  }, [perfil?.revenda_id]);

  const pronto = !!perfil && perfil.status === 'ativo' && PAPEIS_OK.includes(perfil.papel);
  useEffect(() => {
    logado.set(pronto);
    if (!pronto) { gavetaAberta.set(false); pastasAtivas.set([]); }
  }, [pronto]);

  const aviso = perfil && !pronto
    ? perfil.status !== 'ativo' ? 'Sua conta ainda não está ativa no Advox. Peça a aprovação ao coordenador.' : 'A extensão é para a equipe comercial (consultores, coordenadores, gerentes e proprietários).'
    : null;

  if (sessao === undefined || (sessao && perfil === undefined)) return null;

  if (!pronto) {
    return (
      <>
        {createPortal(<TopBar perfil={null} revenda={null} pastas={[]} contagem={{}} />, topbar)}
        {(conta || aviso) && <LoginModal aviso={aviso} />}
        <Toaster />
      </>
    );
  }

  return (
    <DadosProvider perfil={perfil!}>
      <Logado perfil={perfil!} revenda={revenda} topbar={topbar} header={header} />
    </DadosProvider>
  );
}

function Logado({ perfil, revenda, topbar, header }: { perfil: Perfil; revenda: string | null; topbar: HTMLElement; header: Parameters<typeof App>[0]['header'] }) {
  const { pastas, contagem } = useDados();
  const aberto = useSinal(gavetaAberta);
  const ativas = useSinal(pastasAtivas);
  const pastasModal = useSinal(modalPastas);
  const agenda = useSinal(modalAgenda);
  const headerEl = useSinal(header);

  // Pasta apagada some do filtro.
  useEffect(() => {
    const validas = ativas.filter((id) => pastas.some((p: Pasta) => p.id === id));
    if (validas.length !== ativas.length && pastas.length) pastasAtivas.set(validas);
  }, [pastas]);

  return (
    <>
      {createPortal(<TopBar perfil={perfil} revenda={revenda} pastas={pastas} contagem={contagem} />, topbar)}
      {headerEl && createPortal(<HeaderBar />, headerEl)}

      {!aberto && <TrilhoLateral />}
      {aberto && <Gaveta />}

      {ativas.length > 0 && <PastaPanel ids={ativas} />}
      {pastasModal && <PastasModal />}
      {agenda && <AgendaModal />}
      <HeaderMenuOverlay />
      <AtalhoPicker />
      <Toaster />
    </>
  );
}

function Gaveta() {
  const aba = useSinal(abaGaveta);
  return (
    <div className="bc-anim-slide pointer-events-auto fixed bottom-0 right-0 z-[55] flex w-[282px] flex-col gap-2 bg-transparent p-2" style={{ top: emPx(ALTURA_TOPBAR) }}>
      <div className="flex min-h-0 w-[266px] flex-1 flex-col overflow-hidden rounded-lg border border-border bg-surface">
        <div className="flex items-center gap-2 border-b border-border bg-surface-2 px-3 py-2.5">
          <div className="bc-seg flex-shrink-0">
            <button type="button" data-ativo={aba === 'cliente' ? 1 : 0} onClick={() => abaGaveta.set('cliente')} title="Dados do contato"><User size={14} /></button>
            <button type="button" data-ativo={aba === 'rapidas' ? 1 : 0} onClick={() => abaGaveta.set('rapidas')} title="Mensagens rápidas"><Zap size={14} /></button>
          </div>
          <a href={APP_URL} target="_blank" rel="noopener noreferrer" title="Abrir o Advox"
            className="grid h-7 w-7 place-items-center rounded-md text-muted transition hover:bg-surface hover:text-brand">
            <ExternalLink size={14} />
          </a>
          <div className="ml-auto min-w-0 truncate text-[12px] font-bold tracking-tight">{aba === 'cliente' ? 'Contato' : 'Mensagens'}</div>
          <button type="button" onClick={() => gavetaAberta.set(false)} className="grid h-8 w-8 place-items-center rounded-md text-muted transition hover:bg-surface" title="Fechar">
            <X size={16} />
          </button>
        </div>
        {aba === 'cliente' ? <ContatoView /> : <MensagensView />}
      </div>
      <div className="flex w-[266px] items-center justify-between rounded-lg border border-border bg-surface px-3 py-1.5 shadow-sm">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-muted"><Logo tamanho={14} /> AdvoxChat</span>
        <IndicadorWpp />
      </div>
    </div>
  );
}

function TrilhoLateral() {
  const aba = useSinal(abaGaveta);
  const ir = (destino: 'cliente' | 'rapidas') => { abaGaveta.set(destino); gavetaAberta.set(true); };
  const botao = (ativo: boolean) => cn(
    'grid h-10 w-10 place-items-center rounded-lg border transition',
    ativo ? 'border-brand bg-brand text-white shadow-sm' : 'border-transparent bg-surface-2 text-muted hover:border-border-strong hover:text-text',
  );
  const cliqueLivre = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button, a')) return;
    ir('rapidas');
  };
  return (
    <div className="pointer-events-auto fixed bottom-0 right-0 z-[56] flex cursor-pointer flex-col items-center gap-2 border-l border-border bg-surface pt-3"
      style={{ top: emPx(ALTURA_TOPBAR), width: emPx(LARGURA_TRILHO) }} onClick={cliqueLivre} title="Abrir mensagens rápidas">
      <button type="button" title="Contato / lead no Advox" className={botao(aba === 'cliente')} onClick={() => ir('cliente')}><User size={17} /></button>
      <button type="button" title="Mensagens rápidas" className={botao(aba === 'rapidas')} onClick={() => ir('rapidas')}><Zap size={17} /></button>
      <button type="button" title="Minha agenda — atividades, notas e etiquetas" className={botao(false)} onClick={() => { abaAgenda.set('agenda'); modalAgenda.set(true); }}><CalendarDays size={17} /></button>
      <span className="my-1 h-px w-6 bg-border" />
      <button type="button" title="Painel AdvoxChat (contatos, mensagens, pastas) — abre já logado" className={botao(false)} onClick={() => abrirPainel('contatos')}><BookUser size={17} /></button>
      <a href={APP_URL} target="_blank" rel="noopener noreferrer" title="Abrir o Advox" className={botao(false)}><Logo tamanho={20} /></a>
      <div className="mt-auto pb-3"><IndicadorWpp vertical /></div>
    </div>
  );
}

function IndicadorWpp({ vertical = false }: { vertical?: boolean }) {
  const [ok, setOk] = useState(bridgeDisponivel());
  useEffect(() => {
    const t = window.setInterval(() => setOk(bridgeDisponivel()), 2000);
    return () => window.clearInterval(t);
  }, []);
  return (
    <span className={cn('inline-flex items-center gap-1 font-semibold text-muted', vertical ? 'flex-col gap-0.5 text-[8.5px]' : 'text-[10px]')}
      title={ok ? 'Módulo WPP conectado — envio direto ativo' : 'WPP conectando — envio pela caixa de mensagem'}>
      <span className={cn('h-2 w-2 rounded-full', ok ? 'bg-success' : 'bg-warning')} />
      {ok ? 'WPP' : 'compat.'}
    </span>
  );
}
