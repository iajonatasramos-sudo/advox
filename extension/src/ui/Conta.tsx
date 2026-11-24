// Botão da conta na barra do topo (como no BuildChat) + modal de entrar.
import { useEffect, useState } from 'react';
import { BookUser, ExternalLink, Loader2, LogIn, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { modalConta } from '@/lib/store';
import { APP_URL, abrirPainel, entrar, sair, type Perfil } from '@/content/api';
import { minhaFoto } from '@/content/wa';
import { toast } from './toast';

const PAPEL: Record<string, string> = { rep: 'Consultor', coord: 'Coordenador', gerente: 'Gerente', proprietario: 'Proprietário', admin: 'Administrador', advogado: 'Advogado' };

export function Logo({ tamanho = 24 }: { tamanho?: number }) {
  return (
    <img
      src={chrome.runtime.getURL(tamanho > 24 ? 'icons/icon128.png' : 'icons/icon48.png')}
      alt="Advox"
      draggable={false}
      className="flex-shrink-0 object-contain"
      style={{ width: tamanho, height: tamanho }}
    />
  );
}

export function ContaBotao({ perfil, revenda }: { perfil: Perfil | null; revenda: string | null }) {
  const [menu, setMenu] = useState(false);
  const [foto, setFoto] = useState<string | null>(null);
  const [fotoQuebrada, setFotoQuebrada] = useState(false);

  useEffect(() => {
    if (perfil) minhaFoto().then(setFoto);
  }, [perfil?.id]);

  if (!perfil) {
    return (
      <button
        type="button"
        onClick={() => modalConta.set(true)}
        className="flex-shrink-0 rounded-md border border-brand px-2.5 py-0.5 text-[11.5px] font-bold text-brand transition hover:bg-brand hover:text-white"
      >
        Entrar
      </button>
    );
  }

  return (
    <div className="relative flex-shrink-0">
      <button
        type="button"
        onClick={() => setMenu((m) => !m)}
        title={`${perfil.nome}${revenda ? ` — ${revenda}` : ''}`}
        className="flex items-center gap-1.5 rounded-md px-2 py-0.5 transition hover:bg-surface-2"
      >
        {foto && !fotoQuebrada ? (
          <img src={foto} alt="" onError={() => setFotoQuebrada(true)} className="h-[22px] w-[22px] flex-shrink-0 rounded-full object-cover" />
        ) : (
          <span className="grid h-5 w-5 place-items-center rounded-full bg-brand text-[10px] font-bold text-white">
            {perfil.nome.slice(0, 1).toUpperCase()}
          </span>
        )}
        <span className="max-w-[140px] truncate text-[11.5px] font-semibold">{perfil.nome}</span>
        <span className={cn('rounded-md px-1.5 text-[9.5px] font-bold', perfil.status === 'ativo' ? 'bg-success/15 text-success' : 'bg-danger/15 text-danger')}>
          {revenda ?? PAPEL[perfil.papel] ?? perfil.papel}
        </span>
      </button>

      {menu && (
        <div
          className="bc-anim-pop absolute right-0 top-full z-[70] mt-1 w-56 overflow-hidden rounded-md border border-border bg-surface shadow-lg"
          onMouseLeave={() => setMenu(false)}
        >
          <div className="border-b border-border px-3 py-2">
            <div className="truncate text-[12.5px] font-bold">{perfil.nome}</div>
            <div className="mt-1 text-[10.5px] text-muted">
              {PAPEL[perfil.papel] ?? perfil.papel}{revenda ? ` · ${revenda}` : ''}
            </div>
          </div>
          <button
            type="button"
            onClick={() => { setMenu(false); abrirPainel('contatos'); }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] font-semibold text-text-2 transition hover:bg-surface-2"
          >
            <BookUser size={13} /> Painel AdvoxChat
          </button>
          <a
            href={APP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] font-semibold text-text-2 transition hover:bg-surface-2"
          >
            <ExternalLink size={13} /> Abrir o Advox
          </a>
          <button
            type="button"
            onClick={async () => {
              setMenu(false);
              await sair();
              toast.success('Você saiu da conta.');
            }}
            className="flex w-full items-center gap-2 border-t border-border px-3 py-2 text-left text-[12px] font-semibold text-danger transition hover:bg-red-bg"
          >
            <LogOut size={13} /> Sair
          </button>
        </div>
      )}
    </div>
  );
}

export function LoginModal({ aviso }: { aviso?: string | null }) {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fechar = () => modalConta.set(false);

  return (
    <div className="pointer-events-auto fixed inset-0 z-[66] flex items-center justify-center bg-text/40 p-4" onClick={fechar}>
      <form
        className="bc-anim-pop flex w-full max-w-sm flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-lg"
        onClick={(e) => e.stopPropagation()}
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          const er = await entrar(email, senha);
          setBusy(false);
          if (er) setErro(er);
          else { fechar(); toast.success('Conectado ao Advox.'); }
        }}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h3 className="flex min-w-0 flex-col gap-1 text-[13px] font-bold text-text-2">
            <img src={chrome.runtime.getURL('icons/advox-logo.png')} alt="Advox Telecom" draggable={false} className="h-7 w-auto self-start object-contain" />
            Entrar no AdvoxChat
          </h3>
          <button type="button" onClick={fechar} className="flex-shrink-0 rounded-md border border-border-strong px-2.5 py-1 text-[12px] font-semibold text-text-2 transition hover:bg-surface-2">Fechar</button>
        </div>
        <div className="space-y-3 p-4">
          <p className="text-[12px] text-muted">Use o mesmo e-mail e senha do app do Advox.</p>
          {aviso && <p className="rounded-md bg-amber-bg px-2.5 py-1.5 text-[12px] text-text-2">{aviso}</p>}
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted">E-mail</span>
            <input autoFocus type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" placeholder="seu@email.com" className={inputCls} />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted">Senha</span>
            <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="current-password" className={inputCls} />
          </label>
          {erro && <p className="text-[12px] font-medium text-danger">{erro}</p>}
          <button
            disabled={busy || !email || !senha}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-brand py-2 text-[13px] font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <LogIn size={14} />} Entrar
          </button>
        </div>
      </form>
    </div>
  );
}

export const inputCls =
  'h-9 w-full rounded-md border border-border-strong bg-surface px-2.5 text-[13px] outline-none focus:border-brand';
