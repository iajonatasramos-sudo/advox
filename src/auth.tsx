import React, { createContext, useContext, useEffect, useState } from "react";
import type { Session, User as AuthUser } from "@supabase/supabase-js";
import { supabase, isSupabaseConfigured } from "./lib/supabase";
import type { Database } from "./lib/database.types";
import { Ic } from "./icons";
import { Btn, Input, Field } from "./ui";
import { getInvite, aceitarConvite, registrarAceiteTermos, type InvitePublicData } from "./lib/data-live";

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Revenda = Database["public"]["Tables"]["revendas"]["Row"];

type AuthState = {
  loading: boolean;
  session: Session | null;
  user: AuthUser | null;
  profile: Profile | null;
  profileError: string | null;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUpRep: (data: { nome: string; email: string; password: string; revenda_id: string }) => Promise<{ error?: string; needsEmailConfirm?: boolean }>;
  signInWithGoogle: () => Promise<{ error?: string }>;
  resetPassword: (email: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  reloadProfile: () => Promise<void>;
};

const AuthCtx = createContext<AuthState | null>(null);

// === Cache module-level: dedup + localStorage fallback
//     Resolve dois problemas:
//     1) React StrictMode chama loadProfile 2x → mesma promise compartilhada
//     2) Supabase às vezes demora pra responder profile → restauramos do
//        localStorage imediatamente, e atualizamos em background sem
//        bloquear UI.
let inflightProfile: { userId: string; promise: Promise<Profile | null> } | null = null;

const CACHE_KEY = "advox-profile-cache-v1";

function readCachedProfile(userId: string): Profile | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as { userId: string; profile: Profile };
    if (data.userId !== userId) return null;
    return data.profile;
  } catch { return null; }
}

function writeCachedProfile(userId: string, profile: Profile) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ userId, profile })); } catch { /* ignore quota */ }
}

function clearCachedProfile() {
  try { localStorage.removeItem(CACHE_KEY); } catch { /* ignore */ }
}

async function fetchProfileWithRetry(userId: string, attempt = 1): Promise<Profile | null> {
  if (inflightProfile?.userId === userId) return inflightProfile.promise;

  const promise = (async (): Promise<Profile | null> => {
    const TIMEOUT_MS = 15000;
    const query = supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout ${TIMEOUT_MS}ms (tentativa ${attempt})`)), TIMEOUT_MS)
    );
    try {
      const result = await Promise.race([query, timeout]) as Awaited<typeof query>;
      if (result.error) throw result.error;
      return result.data;
    } catch (e) {
      if (attempt < 3) {
        console.warn(`[Advox] fetchProfile tentativa ${attempt} falhou, retry:`, (e as Error).message);
        inflightProfile = null;
        await new Promise(r => setTimeout(r, 1000 * attempt));
        return fetchProfileWithRetry(userId, attempt + 1);
      }
      throw e;
    }
  })();

  inflightProfile = { userId, promise };
  try {
    return await promise;
  } finally {
    if (inflightProfile?.promise === promise) inflightProfile = null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  const loadProfile = async (userId: string) => {
    setProfileError(null);

    // 1) Restaura cache imediatamente — UI renderiza sem esperar rede
    const cached = readCachedProfile(userId);
    if (cached) {
      console.log("[Advox] loadProfile cache hit — renderizando imediato");
      setProfile(cached);
    }

    try {
      const data = await fetchProfileWithRetry(userId);
      console.log("[Advox] loadProfile result", { userId, data: data ? "found" : "null" });

      // Auto-criação para usuários sem profile (signup via OAuth ou edge cases)
      if (!data) {
        const u = (await supabase.auth.getUser()).data.user;
        if (u) {
          const nome = (u.user_metadata?.nome as string) || (u.user_metadata?.full_name as string) || u.email!.split("@")[0];
          const novo = {
            id: u.id, email: u.email!, nome,
            papel: "rep" as const, status: "pendente" as const,
          };
          const { error: insErr } = await supabase.from("profiles").insert(novo as never);
          if (insErr) {
            console.error("[Advox] loadProfile insert error", insErr);
            if (!cached) setProfileError(`Erro ao criar perfil: ${insErr.message}`);
            return;
          }
          // re-busca após criar
          inflightProfile = null;
          const created = await fetchProfileWithRetry(u.id);
          if (created) {
            writeCachedProfile(u.id, created);
            setProfile(created);
          }
          return;
        }
      }
      if (data) {
        writeCachedProfile(userId, data);
        setProfile(data);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[Advox] loadProfile failed (após retry)", e);
      // Se temos cache, NÃO bloqueia a UI — só loga.
      // Realtime + reload manual vão eventualmente sincronizar.
      if (cached) {
        console.warn("[Advox] usando profile do cache; rede falhou:", msg);
      } else {
        setProfileError(`Não foi possível carregar seu perfil: ${msg}`);
        setProfile(null);
      }
    }
  };

  useEffect(() => {
    let mounted = true;
    console.log("[Advox] auth init start");

    // Safety: nunca deixa o spinner travado mais de 8s
    const timeout = setTimeout(() => {
      if (mounted) {
        console.warn("[Advox] auth init timeout — forçando loading=false");
        setLoading(false);
      }
    }, 8000);

    // ÚNICO caminho de inicialização: onAuthStateChange dispara INITIAL_SESSION
    // logo no mount com a sessão em cache (se houver). Evita race com getSession().
    let lastLoadedUserId: string | null = null;
    const { data: sub } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (!mounted) return;
      console.log("[Advox] onAuthStateChange", event, { hasSession: !!newSession });
      setSession(newSession);

      if (newSession?.user?.id) {
        // Evita loadProfile duplicado para o mesmo user em eventos seguidos
        if (lastLoadedUserId !== newSession.user.id) {
          lastLoadedUserId = newSession.user.id;
          await loadProfile(newSession.user.id);
        }
      } else {
        lastLoadedUserId = null;
        setProfile(null);
      }

      clearTimeout(timeout);
      setLoading(false);
      console.log("[Advox] auth init done");
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  // Realtime: assina mudanças no próprio profile (papel, status, revenda)
  // Roda em separado pra nunca bloquear a renderização inicial.
  useEffect(() => {
    if (!session?.user?.id) return;
    const userId = session.user.id;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    try {
      channel = supabase
        .channel(`profile-${userId}`)
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${userId}` },
          (payload) => {
            const next = payload.new as Profile;
            writeCachedProfile(userId, next);
            setProfile(next);
          }
        )
        .subscribe((status, err) => {
          if (err) console.warn("[Advox] realtime profile subscribe error", err);
          else console.log("[Advox] realtime profile status:", status);
        });
    } catch (e) {
      console.warn("[Advox] realtime profile setup failed (ignorado)", e);
    }
    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [session?.user?.id]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error ? { error: humanizeAuthError(error.message) } : {};
  };

  const signUpRep = async ({ nome, email, password, revenda_id }: { nome: string; email: string; password: string; revenda_id: string }) => {
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: {
        data: { nome, papel: "rep" },
        emailRedirectTo: window.location.origin,
      },
    });
    if (error) return { error: humanizeAuthError(error.message) };

    // Cria o profile explicitamente (sem mais depender de trigger no DB)
    if (data.session?.user?.id) {
      const userId = data.session.user.id;
      const profileRow = {
        id: userId,
        email,
        nome,
        papel: "rep" as const,
        status: "pendente" as const,
        revenda_id,
      };
      const { error: insErr } = await supabase
        .from("profiles")
        .insert(profileRow as never);
      if (insErr && !insErr.message.includes("duplicate")) {
        return { error: `Cadastro criado mas falha ao gravar profile: ${insErr.message}` };
      }
      // Registra aceite dos termos (best-effort, não bloqueia se falhar)
      await registrarAceiteTermos(userId).catch(() => {});
      return {};
    }

    // Sem session = precisa confirmar email — profile será criado no primeiro login
    return { needsEmailConfirm: true };
  };

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    return error ? { error: humanizeAuthError(error.message) } : {};
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    return error ? { error: humanizeAuthError(error.message) } : {};
  };

  const signOut = async () => {
    clearCachedProfile();
    await supabase.auth.signOut();
    setProfile(null);
  };

  const reloadProfile = async () => {
    if (session?.user?.id) await loadProfile(session.user.id);
  };

  return (
    <AuthCtx.Provider value={{
      loading, session, user: session?.user ?? null, profile, profileError,
      signIn, signUpRep, signInWithGoogle, resetPassword, signOut, reloadProfile,
    }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  const v = useContext(AuthCtx);
  if (!v) throw new Error("useAuth outside AuthProvider");
  return v;
}

function humanizeAuthError(msg: string): string {
  const lower = msg.toLowerCase();
  if (lower.includes("invalid login credentials")) return "Email ou senha incorretos.";
  if (lower.includes("email not confirmed")) return "Confirme seu email antes de entrar — verifique sua caixa.";
  if (lower.includes("user already registered")) return "Este email já está cadastrado. Tente entrar.";
  if (lower.includes("password should be at least")) return "A senha precisa ter no mínimo 6 caracteres.";
  if (lower.includes("invalid email")) return "Email inválido.";
  if (lower.includes("rate limit")) return "Muitas tentativas. Tente novamente em alguns minutos.";
  return msg;
}

/* ====================================================================
 * SCREENS
 * ================================================================== */

const PAGE_BG = "linear-gradient(180deg, oklch(0.985 0.003 240), oklch(0.95 0.01 250))";

function AuthShell({ children, title, subtitle }: { children: React.ReactNode; title: string; subtitle?: string }) {
  return (
    <div style={{
      minHeight: "100vh",
      background: PAGE_BG,
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "24px 16px",
    }}>
      <div style={{
        width: "100%", maxWidth: 420,
        background: "var(--surface)",
        border: "1px solid var(--line-2)",
        borderRadius: 10,
        boxShadow: "var(--shadow-lg)",
        padding: "28px 28px 24px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 22 }}>
          <span style={{
            width: 36, height: 36, borderRadius: 6,
            background: "var(--navy)", color: "var(--navy-ink)",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            position: "relative",
            boxShadow: "inset 0 -1px 0 oklch(0.18 0.07 255)",
          }}>
            <Ic.Scale size={18} />
            <span style={{
              position: "absolute", bottom: -2, right: -2,
              width: 10, height: 10, borderRadius: 99,
              background: "var(--gold)",
              border: "2px solid var(--surface)",
            }} />
          </span>
          <div>
            <div style={{ fontSize: 18, fontWeight: 600, letterSpacing: "-0.015em" }}>
              Advox <span style={{ color: "var(--ink-3)", fontWeight: 400 }}>Telecom</span>
            </div>
            <div style={{ fontSize: 11, color: "var(--ink-4)", marginTop: 1 }}>CRM Telecom + Jurídico</div>
          </div>
        </div>

        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600, letterSpacing: "-0.015em" }}>{title}</h1>
        {subtitle && (
          <p style={{ margin: "6px 0 18px", fontSize: 13, color: "var(--ink-3)", lineHeight: 1.5 }}>
            {subtitle}
          </p>
        )}

        {children}
      </div>
    </div>
  );
}

function GoogleBtn({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} type="button" style={{
      width: "100%",
      display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 9,
      padding: "10px 14px",
      fontSize: 13.5, fontWeight: 500,
      background: "var(--surface)", color: "var(--ink)",
      border: "1px solid var(--line-2)",
      borderRadius: 6,
      cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.6 : 1,
      boxShadow: "var(--shadow-sm)",
    }}>
      <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
      </svg>
      Continuar com Google
    </button>
  );
}

function Divider({ label }: { label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "16px 0", color: "var(--ink-4)", fontSize: 11 }}>
      <span style={{ flex: 1, height: 1, background: "var(--line)" }} />
      {label}
      <span style={{ flex: 1, height: 1, background: "var(--line)" }} />
    </div>
  );
}

function ErrorMsg({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: "var(--rose-soft)",
      border: "1px solid var(--rose-border)",
      color: "var(--rose)",
      padding: "9px 12px",
      borderRadius: 5,
      fontSize: 12.5,
      marginBottom: 14,
      display: "flex", alignItems: "center", gap: 8,
    }}>
      <Ic.Warn size={13} /> {children}
    </div>
  );
}

function SuccessMsg({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: "var(--green-soft)",
      border: "1px solid oklch(0.85 0.06 145)",
      color: "var(--green)",
      padding: "9px 12px",
      borderRadius: 5,
      fontSize: 12.5,
      marginBottom: 14,
      display: "flex", alignItems: "center", gap: 8,
    }}>
      <Ic.CheckCircle size={13} /> {children}
    </div>
  );
}

/* === Login === */
type LoginView = "login" | "cadastro" | "forgot" | "invite";

function getInviteTokenFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  return params.get("invite");
}

function clearInviteFromUrl() {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  url.searchParams.delete("invite");
  window.history.replaceState({}, "", url.toString());
}

export function AuthGate() {
  const [view, setView] = useState<LoginView>(() => getInviteTokenFromUrl() ? "invite" : "login");
  if (!isSupabaseConfigured) return <ConfigMissing />;
  if (view === "invite") return <AceitarConvite token={getInviteTokenFromUrl()!} onCancel={() => { clearInviteFromUrl(); setView("login"); }} />;
  if (view === "cadastro") return <Cadastro onBack={() => setView("login")} />;
  if (view === "forgot") return <ForgotPassword onBack={() => setView("login")} />;
  return <Login onCadastro={() => setView("cadastro")} onForgot={() => setView("forgot")} />;
}

function ConfigMissing() {
  return (
    <AuthShell title="Configuração ausente" subtitle="As credenciais do Supabase não foram carregadas.">
      <ErrorMsg>
        Crie o arquivo <code className="mono">.env.local</code> com as variáveis <code className="mono">VITE_SUPABASE_URL</code> e <code className="mono">VITE_SUPABASE_ANON_KEY</code>, e reinicie o servidor de desenvolvimento.
      </ErrorMsg>
    </AuthShell>
  );
}

function Login({ onCadastro, onForgot }: { onCadastro: () => void; onForgot: () => void }) {
  const { signIn, signInWithGoogle } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    const { error } = await signIn(email, password);
    setBusy(false);
    if (error) setErr(error);
  };

  return (
    <AuthShell title="Entrar" subtitle="Acesse sua conta para continuar.">
      {err && <ErrorMsg>{err}</ErrorMsg>}

      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Field label="Email">
          <Input full type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="voce@empresa.com.br" />
        </Field>
        <Field label="Senha">
          <Input full type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" />
        </Field>

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: -4 }}>
          <button type="button" onClick={onForgot} style={{
            background: "transparent", border: 0, color: "var(--navy)",
            fontSize: 12, cursor: "pointer", padding: 0,
          }}>Esqueci minha senha</button>
        </div>

        <Btn variant="primary" type="submit" disabled={busy || !email || !password} style={{ width: "100%", justifyContent: "center", padding: "10px 16px", marginTop: 4 }}>
          {busy ? "Entrando…" : "Entrar"}
        </Btn>
      </form>

      <Divider label="ou" />

      <GoogleBtn onClick={signInWithGoogle} disabled={busy} />

      <div style={{ textAlign: "center", marginTop: 22, fontSize: 12.5, color: "var(--ink-3)" }}>
        Ainda não tem conta?{" "}
        <button onClick={onCadastro} type="button" style={{
          background: "transparent", border: 0, color: "var(--navy)",
          fontWeight: 600, cursor: "pointer", padding: 0,
        }}>Cadastre-se</button>
      </div>
    </AuthShell>
  );
}

/* === Cadastro de Representante === */
function Cadastro({ onBack }: { onBack: () => void }) {
  const { signUpRep, signInWithGoogle } = useAuth();
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [revendaId, setRevendaId] = useState("");
  const [accept, setAccept] = useState(false);
  const [revendas, setRevendas] = useState<Revenda[]>([]);
  const [loadingRevendas, setLoadingRevendas] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<"session" | "email" | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let mounted = true;
    supabase.from("revendas").select("*").eq("status", "ativo").order("nome").then(({ data, error }) => {
      if (!mounted) return;
      if (error) setErr("Não foi possível carregar a lista de revendas: " + error.message);
      else setRevendas(data ?? []);
      setLoadingRevendas(false);
    });
    return () => { mounted = false; };
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accept) { setErr("Você precisa aceitar os termos."); return; }
    setErr(null);
    setBusy(true);
    const { error, needsEmailConfirm } = await signUpRep({ nome, email, password, revenda_id: revendaId });
    setBusy(false);
    if (error) { setErr(error); return; }
    setDone(needsEmailConfirm ? "email" : "session");
  };

  if (done === "email") {
    return (
      <AuthShell title="Confirme seu email">
        <SuccessMsg>Enviamos um link para <strong>{email}</strong>. Abra a caixa e clique no link para ativar sua conta.</SuccessMsg>
        <p style={{ fontSize: 12.5, color: "var(--ink-2)", lineHeight: 1.55 }}>
          Após confirmar, você será encaminhado para a tela de aprovação — o coordenador da revenda <strong>{revendas.find(r => r.id === revendaId)?.nome || "selecionada"}</strong> precisa liberar seu acesso.
        </p>
        <Btn variant="default" onClick={onBack} style={{ width: "100%", marginTop: 16, justifyContent: "center" }}>Voltar ao login</Btn>
      </AuthShell>
    );
  }

  if (done === "session") {
    // user logado, vai cair na tela de "aguardando aprovação" automaticamente
    return null;
  }

  return (
    <AuthShell title="Criar conta de Representante" subtitle="Vendedores de telecom — escolha sua revenda e aguarde a aprovação do coordenador.">
      {err && <ErrorMsg>{err}</ErrorMsg>}

      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Field label="Nome completo">
          <Input full value={nome} onChange={e=>setNome(e.target.value)} placeholder="Seu nome" />
        </Field>
        <Field label="Email">
          <Input full type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="voce@empresa.com.br" />
        </Field>
        <Field label="Senha" hint="Mínimo 6 caracteres.">
          <Input full type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" />
        </Field>
        <Field label="Revenda">
          {loadingRevendas ? (
            <div style={{ fontSize: 12, color: "var(--ink-3)", padding: "8px 0" }}>Carregando…</div>
          ) : revendas.length === 0 ? (
            <div style={{ fontSize: 12, color: "var(--ink-3)", padding: "8px 10px", border: "1px dashed var(--line-2)", borderRadius: 5, background: "var(--surface-2)" }}>
              Nenhuma revenda cadastrada ainda. Peça ao administrador para cadastrar sua revenda antes de continuar.
            </div>
          ) : (
            <div style={{ position: "relative" }}>
              <select value={revendaId} onChange={e=>setRevendaId(e.target.value)} required style={{
                width: "100%",
                padding: "8px 28px 8px 10px",
                border: "1px solid var(--line-2)",
                borderRadius: 5,
                background: "var(--surface)",
                fontSize: 13, color: "var(--ink)",
                appearance: "none", cursor: "pointer",
              }}>
                <option value="" disabled>Selecione…</option>
                {revendas.map(r => <option key={r.id} value={r.id}>{r.nome}</option>)}
              </select>
              <span style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "var(--ink-4)" }}>
                <Ic.ChevronDown size={14} />
              </span>
            </div>
          )}
        </Field>

        <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12.5, color: "var(--ink-2)", marginTop: 4, cursor: "pointer", lineHeight: 1.5 }}>
          <input type="checkbox" checked={accept} onChange={e=>setAccept(e.target.checked)} style={{ marginTop: 2 }} />
          <span>Li e aceito os Termos de Uso e a Política de Privacidade do Advox.</span>
        </label>

        <Btn
          variant="primary" type="submit"
          disabled={busy || !nome || !email || !password || !revendaId || !accept || revendas.length === 0}
          style={{ width: "100%", justifyContent: "center", padding: "10px 16px", marginTop: 4 }}
        >
          {busy ? "Criando conta…" : "Criar conta"}
        </Btn>
      </form>

      <Divider label="ou" />
      <GoogleBtn onClick={signInWithGoogle} disabled={busy} />

      <div style={{ textAlign: "center", marginTop: 22, fontSize: 12.5, color: "var(--ink-3)" }}>
        Já tem conta?{" "}
        <button onClick={onBack} type="button" style={{
          background: "transparent", border: 0, color: "var(--navy)",
          fontWeight: 600, cursor: "pointer", padding: 0,
        }}>Entrar</button>
      </div>
    </AuthShell>
  );
}

/* === Aceitar Convite === */
function AceitarConvite({ token, onCancel }: { token: string; onCancel: () => void }) {
  const [invite, setInvite] = useState<InvitePublicData | "loading" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let mounted = true;
    getInvite(token).then(({ data, error }) => {
      if (!mounted) return;
      if (error || !data) {
        setInvite("error");
        setErrorMsg(error === "expirado" ? "Este convite expirou." :
                    error === "usado" ? "Este convite já foi utilizado." :
                    error === "invalido" ? "Convite inválido." :
                    (error ?? "Erro desconhecido"));
      } else {
        setInvite(data);
      }
    });
    return () => { mounted = false; };
  }, [token]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (typeof invite !== "object") return;
    setBusy(true);
    setErrorMsg(null);

    // 1) Cria a conta com o email do convite
    const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
      email: invite.email,
      password,
      options: { data: { nome, papel: invite.papel } },
    });
    if (signUpErr) {
      setBusy(false);
      setErrorMsg(humanizeAuthError(signUpErr.message));
      return;
    }

    // 2) Garante que existe profile (caso o sistema esteja em flow sem trigger)
    const userId = signUpData.user?.id;
    if (userId) {
      await supabase.from("profiles").insert({
        id: userId,
        email: invite.email,
        nome,
        papel: invite.papel,
        status: "pendente",
        revenda_id: invite.revenda_id,
      } as never);
    }

    // 3) Aceita o convite (RPC)
    if (userId) {
      const { error: acErr } = await aceitarConvite(token, userId);
      if (acErr) {
        setBusy(false);
        setErrorMsg(`Conta criada mas falha ao ativar via convite: ${acErr}`);
        return;
      }
      await registrarAceiteTermos(userId).catch(() => {});
    }

    setBusy(false);
    clearInviteFromUrl();
    setDone(true);
  };

  if (invite === "loading") {
    return (
      <AuthShell title="Carregando convite…">
        <div style={{ padding: "20px 0", textAlign: "center", color: "var(--ink-3)", fontSize: 13 }}>Validando seu convite…</div>
      </AuthShell>
    );
  }

  if (invite === "error") {
    return (
      <AuthShell title="Convite inválido">
        <ErrorMsg>{errorMsg ?? "Não foi possível usar este convite."}</ErrorMsg>
        <Btn variant="primary" onClick={onCancel} style={{ width: "100%", justifyContent: "center" }}>Ir para login</Btn>
      </AuthShell>
    );
  }

  if (done) {
    return (
      <AuthShell title="Conta criada com sucesso!" subtitle="Você já pode entrar com seu email e senha.">
        <SuccessMsg>Sua conta foi ativada como <strong>{invite.papel === "rep" ? "Representante" : invite.papel === "coord" ? "Coordenador" : invite.papel === "advogado" ? "Advogado" : "Administrador"}</strong>{invite.revenda_nome ? <> da revenda <strong>{invite.revenda_nome}</strong></> : null}.</SuccessMsg>
        <Btn variant="primary" onClick={() => { clearInviteFromUrl(); window.location.reload(); }} style={{ width: "100%", justifyContent: "center" }}>Entrar agora</Btn>
      </AuthShell>
    );
  }

  const papelLabel = invite.papel === "rep" ? "Representante" : invite.papel === "coord" ? "Coordenador" : invite.papel === "advogado" ? "Advogado" : "Administrador";

  return (
    <AuthShell title="Você foi convidado" subtitle={`Crie sua senha para ativar sua conta como ${papelLabel}${invite.revenda_nome ? ` da ${invite.revenda_nome}` : ""}.`}>
      {errorMsg && <ErrorMsg>{errorMsg}</ErrorMsg>}

      <div style={{
        background: "var(--gold-soft)", border: "1px solid var(--gold-border)",
        padding: "10px 12px", borderRadius: 5, fontSize: 12.5, marginBottom: 14,
        color: "var(--gold-deep)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Ic.Mail size={14} />
          <strong>{invite.email}</strong>
        </div>
        <div style={{ fontSize: 11.5, marginTop: 4, color: "var(--ink-2)" }}>
          Convite expira em {new Date(invite.expira_em).toLocaleDateString("pt-BR")}
        </div>
      </div>

      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Field label="Seu nome completo">
          <Input full value={nome} onChange={e=>setNome(e.target.value)} placeholder="Seu nome" autoFocus />
        </Field>
        <Field label="Senha" hint="Mínimo 6 caracteres.">
          <Input full type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" />
        </Field>
        <Btn variant="primary" type="submit" disabled={busy || !nome || password.length < 6} style={{ width: "100%", justifyContent: "center", padding: "10px 16px", marginTop: 4 }}>
          {busy ? "Criando conta…" : "Aceitar convite e criar conta"}
        </Btn>
      </form>

      <div style={{ textAlign: "center", marginTop: 22, fontSize: 12.5, color: "var(--ink-3)" }}>
        Não é você?{" "}
        <button onClick={onCancel} type="button" style={{
          background: "transparent", border: 0, color: "var(--navy)",
          fontWeight: 600, cursor: "pointer", padding: 0,
        }}>Ir para login</button>
      </div>
    </AuthShell>
  );
}

/* === Reset de senha === */
function ForgotPassword({ onBack }: { onBack: () => void }) {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    const { error } = await resetPassword(email);
    setBusy(false);
    if (error) { setErr(error); return; }
    setSent(true);
  };

  if (sent) {
    return (
      <AuthShell title="Verifique seu email">
        <SuccessMsg>Se houver uma conta para <strong>{email}</strong>, enviamos um link para redefinir a senha.</SuccessMsg>
        <Btn variant="default" onClick={onBack} style={{ width: "100%", marginTop: 12, justifyContent: "center" }}>Voltar ao login</Btn>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Recuperar senha" subtitle="Digite o email da sua conta. Enviaremos um link para você redefinir a senha.">
      {err && <ErrorMsg>{err}</ErrorMsg>}
      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Field label="Email">
          <Input full type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="voce@empresa.com.br" />
        </Field>
        <Btn variant="primary" type="submit" disabled={busy || !email} style={{ width: "100%", justifyContent: "center", padding: "10px 16px", marginTop: 4 }}>
          {busy ? "Enviando…" : "Enviar link de recuperação"}
        </Btn>
      </form>
      <div style={{ textAlign: "center", marginTop: 22, fontSize: 12.5, color: "var(--ink-3)" }}>
        <button onClick={onBack} type="button" style={{
          background: "transparent", border: 0, color: "var(--navy)",
          fontWeight: 600, cursor: "pointer", padding: 0,
        }}>← Voltar ao login</button>
      </div>
    </AuthShell>
  );
}

/* === Tela de aguardando aprovação / bloqueio === */
export function PendingApproval() {
  const { profile, signOut, reloadProfile } = useAuth();
  const [revendaNome, setRevendaNome] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (!profile?.revenda_id) return;
    supabase.from("revendas").select("nome").eq("id", profile.revenda_id).maybeSingle().then(({ data }) => {
      const row = data as { nome: string } | null;
      setRevendaNome(row?.nome ?? null);
    });
  }, [profile?.revenda_id]);

  const check = async () => {
    setChecking(true);
    await reloadProfile();
    setChecking(false);
  };

  if (!profile) return null;

  if (profile.status === "suspenso" || profile.status === "recusado") {
    return (
      <AuthShell title="Acesso bloqueado" subtitle="Sua conta não está ativa no momento.">
        <ErrorMsg>
          Status: <strong>{profile.status}</strong>. Entre em contato com o administrador para mais informações.
        </ErrorMsg>
        <Btn variant="default" onClick={signOut} style={{ width: "100%", justifyContent: "center" }}>Sair</Btn>
      </AuthShell>
    );
  }

  // pendente
  const aprovador =
    profile.papel === "rep"
      ? `o coordenador da revenda${revendaNome ? ` ${revendaNome}` : ""}`
      : "o administrador do sistema";

  return (
    <AuthShell title="Conta criada" subtitle="Aguardando aprovação para liberar o acesso.">
      <div style={{
        background: "var(--amber-soft)",
        border: "1px solid var(--amber-border)",
        borderRadius: 6,
        padding: "12px 14px",
        marginBottom: 16,
        display: "flex", gap: 10, alignItems: "flex-start",
        color: "var(--amber-text)",
        fontSize: 12.5, lineHeight: 1.55,
      }}>
        <Ic.Clock size={14} />
        <div>
          <strong style={{ color: "var(--ink)" }}>Sua conta está pendente.</strong> {aprovador.charAt(0).toUpperCase() + aprovador.slice(1)} precisa aprovar seu cadastro antes que você possa entrar.
          <br />Você receberá um email quando isso acontecer.
        </div>
      </div>

      <div style={{ fontSize: 12.5, color: "var(--ink-2)", lineHeight: 1.55 }}>
        <strong style={{ color: "var(--ink)" }}>Nome:</strong> {profile.nome}<br />
        <strong style={{ color: "var(--ink)" }}>Email:</strong> {profile.email}<br />
        <strong style={{ color: "var(--ink)" }}>Papel:</strong> {profile.papel}
        {revendaNome && <><br /><strong style={{ color: "var(--ink)" }}>Revenda:</strong> {revendaNome}</>}
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
        <Btn variant="primary" onClick={check} disabled={checking} style={{ flex: 1, justifyContent: "center" }}>
          {checking ? "Verificando…" : "Verificar agora"}
        </Btn>
        <Btn variant="default" onClick={signOut} style={{ flex: 1, justifyContent: "center" }}>Sair</Btn>
      </div>
    </AuthShell>
  );
}

/* === Tela de erro quando o profile não carrega === */
export function ProfileErrorScreen() {
  const { profileError, reloadProfile, signOut, session } = useAuth();
  const [busy, setBusy] = useState(false);
  return (
    <AuthShell title="Não conseguimos carregar seu perfil" subtitle="Algo deu errado ao buscar suas informações.">
      <ErrorMsg>{profileError ?? "Erro desconhecido."}</ErrorMsg>
      <div style={{ fontSize: 12, color: "var(--ink-3)", marginBottom: 12, lineHeight: 1.5 }}>
        <strong>Dicas:</strong> verifique se sua conta tem um perfil na tabela <code className="mono">profiles</code> com o mesmo <code className="mono">id</code> do seu usuário em <code className="mono">auth.users</code>.
        {session?.user?.id && <><br /><br /><strong>Seu user id:</strong> <span className="mono">{session.user.id}</span></>}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <Btn variant="primary" disabled={busy} onClick={async () => { setBusy(true); await reloadProfile(); setBusy(false); }} style={{ flex: 1, justifyContent: "center" }}>
          {busy ? "Tentando…" : "Tentar de novo"}
        </Btn>
        <Btn variant="default" onClick={signOut} style={{ flex: 1, justifyContent: "center" }}>Sair</Btn>
      </div>
    </AuthShell>
  );
}

/* === Spinner para loading inicial — com escape se demorar demais === */
export function AuthLoading() {
  const [showEscape, setShowEscape] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setShowEscape(true), 4000);
    return () => clearTimeout(t);
  }, []);

  return (
    <div style={{
      minHeight: "100vh",
      background: PAGE_BG,
      display: "flex", alignItems: "center", justifyContent: "center",
      flexDirection: "column", gap: 14,
      color: "var(--ink-3)",
    }}>
      <span style={{
        width: 32, height: 32, borderRadius: 99,
        border: "3px solid var(--line)",
        borderTopColor: "var(--navy)",
        animation: "spin 0.7s linear infinite",
      }} />
      <span style={{ fontSize: 12.5 }}>Carregando…</span>
      {showEscape && (
        <div style={{ marginTop: 20, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11.5, color: "var(--ink-4)", maxWidth: 260, textAlign: "center" }}>
            Travou? Limpe a sessão e tente entrar de novo.
          </span>
          <button onClick={async () => {
            try { await supabase.auth.signOut(); } catch {}
            localStorage.clear();
            location.reload();
          }} style={{
            background: "var(--surface)", border: "1px solid var(--line-2)",
            color: "var(--ink-2)", borderRadius: 5,
            padding: "6px 12px", fontSize: 12, cursor: "pointer",
          }}>Limpar sessão e recarregar</button>
        </div>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
