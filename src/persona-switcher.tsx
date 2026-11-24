// "Visualizando como" (igual ao BuildClinic): o admin entra como outro
// usuário para ver o sistema exatamente como ele vê — com as permissões dele.
// A troca é feita pela Edge Function `impersonar` (link de uso único, sem
// e-mail); o caminho de volta fica guardado só neste navegador e expira em 12h.
import { useEffect, useMemo, useRef, useState } from "react";
import { Ic } from "./icons";
import { Avatar } from "./ui";
import { useAuth } from "./auth";
import { supabase } from "./lib/supabase";

type Pessoa = { id: string; nome: string; email: string; papel: string; revenda?: { nome: string } | null };

const CHAVE_IMP = "advox-impersonacao";       // { id, adminNome }
const CHAVE_LISTA = "advox-impersonacao-lista"; // lista de usuários (o alvo não consegue listar)

const GRUPOS: { titulo: string; papel: string; rotulo: string }[] = [
  { titulo: "Administração", papel: "admin", rotulo: "Admin" },
  { titulo: "Proprietários", papel: "proprietario", rotulo: "Proprietário" },
  { titulo: "Gerência", papel: "gerente", rotulo: "Gerente" },
  { titulo: "Coordenação", papel: "coord", rotulo: "Coordenador" },
  { titulo: "Consultores", papel: "rep", rotulo: "Consultor" },
  { titulo: "Jurídico", papel: "advogado", rotulo: "Advogado" },
];
const rotuloPapel = (p: string) => GRUPOS.find(g => g.papel === p)?.rotulo ?? p;

function lerImp(): { id: string; adminNome: string } | null {
  try { return JSON.parse(localStorage.getItem(CHAVE_IMP) ?? "null"); } catch { return null; }
}

/** Troca a sessão do navegador para a do token_hash e recarrega a app. */
async function entrarCom(tokenHash: string) {
  try { localStorage.removeItem("advox-profile-cache-v1"); } catch { /* ignore */ }
  // scope local: não derruba as outras sessões (ex.: a extensão do WhatsApp).
  await supabase.auth.signOut({ scope: "local" });
  const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "magiclink" });
  if (error) throw new Error(error.message);
  window.location.href = window.location.pathname;
}

export function PersonaSwitcher() {
  const { profile } = useAuth();
  const imp = lerImp();
  const ehAdmin = profile?.papel === "admin";
  const [aberto, setAberto] = useState(false);
  const [pessoas, setPessoas] = useState<Pessoa[]>(() => { try { return JSON.parse(localStorage.getItem(CHAVE_LISTA) ?? "[]"); } catch { return []; } });
  const [busca, setBusca] = useState("");
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  // Admin de verdade: carrega e guarda a lista (o alvo não teria permissão de listar).
  useEffect(() => {
    if (!ehAdmin || !aberto) return;
    supabase.from("profiles").select("id, nome, email, papel, revenda:revendas!profiles_revenda_id_fkey(nome)").eq("status", "ativo").order("nome").then(({ data, error }) => {
      if (error) { console.error("[Advox] persona-switcher", error); return; }
      const lista = (data ?? []) as unknown as Pessoa[];
      setPessoas(lista);
      try { localStorage.setItem(CHAVE_LISTA, JSON.stringify(lista)); } catch { /* ignore */ }
    });
  }, [ehAdmin, aberto]);

  // Saiu da conta pelo botão normal: esquece a impersonação.
  useEffect(() => { if (ehAdmin && imp) localStorage.removeItem(CHAVE_IMP); }, [ehAdmin]);

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false); };
    document.addEventListener("mousedown", fora);
    return () => document.removeEventListener("mousedown", fora);
  }, [aberto]);

  const grupos = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const filtradas = pessoas.filter(p => !q || `${p.nome} ${p.email} ${p.revenda?.nome ?? ""}`.toLowerCase().includes(q));
    return GRUPOS.map(g => ({ ...g, itens: filtradas.filter(p => p.papel === g.papel) })).filter(g => g.itens.length);
  }, [pessoas, busca]);

  if (!profile || (!ehAdmin && !imp)) return null;

  async function chamar(body: Record<string, unknown>) {
    const { data, error } = await supabase.functions.invoke("impersonar", { body });
    if (error) {
      let msg = error.message;
      try { const j = await (error as { context?: Response }).context?.json(); if (j?.erro) msg = j.erro; } catch { /* ignore */ }
      throw new Error(msg);
    }
    return data as { token_hash: string; impersonacao_id?: string | null; erro?: string };
  }

  async function verComo(p: Pessoa) {
    if (p.id === profile!.id) { setAberto(false); return; }
    setOcupado(p.id); setErro(null);
    try {
      const r = await chamar({ acao: "iniciar", alvo_id: p.id, impersonacao_id: imp?.id });
      if (r.impersonacao_id) localStorage.setItem(CHAVE_IMP, JSON.stringify({ id: r.impersonacao_id, adminNome: imp?.adminNome ?? profile!.nome }));
      else localStorage.removeItem(CHAVE_IMP);
      await entrarCom(r.token_hash);
    } catch (e) { setErro((e as Error).message); setOcupado(null); }
  }

  async function voltar() {
    if (!imp) return;
    setOcupado("voltar"); setErro(null);
    try {
      const r = await chamar({ acao: "voltar", impersonacao_id: imp.id });
      localStorage.removeItem(CHAVE_IMP);
      await entrarCom(r.token_hash);
    } catch (e) { setErro((e as Error).message); setOcupado(null); }
  }

  return (
    <div ref={ref} style={{ position: "relative" }} className="only-desktop">
      <button onClick={() => setAberto(a => !a)} title="Visualizar o sistema como outro usuário" style={{
        display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer", borderRadius: 99, padding: "4px 10px 4px 4px",
        border: `1.5px solid ${imp ? "var(--amber)" : aberto ? "var(--navy)" : "var(--line)"}`,
        background: imp ? "var(--amber-soft)" : "var(--surface)",
      }}>
        <span style={{ width: 24, height: 24, borderRadius: 99, background: imp ? "var(--amber)" : "var(--ink)", color: "white", fontSize: 10, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
          {profile.nome.split(/\s+/).slice(0, 2).map(s => s[0]).join("").toUpperCase()}
        </span>
        <span style={{ textAlign: "left", lineHeight: 1.1 }}>
          <span style={{ display: "block", fontSize: 8.5, fontWeight: 700, letterSpacing: "0.1em", color: imp ? "var(--amber-text)" : "var(--ink-4)" }}>VISUALIZANDO COMO</span>
          <span style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--ink)", whiteSpace: "nowrap" }}>{profile.nome} · {rotuloPapel(profile.papel)}</span>
        </span>
        <Ic.ChevronDown size={12} color="var(--ink-3)" />
      </button>

      {aberto && (
        <div className="fade-up" style={{
          position: "absolute", top: "calc(100% + 6px)", right: 0, width: 320, maxHeight: "70vh", zIndex: 60,
          background: "var(--surface)", border: "1px solid var(--line-2)", borderRadius: 12, boxShadow: "var(--shadow-lg)", display: "flex", flexDirection: "column", overflow: "hidden",
        }}>
          <div style={{ padding: "10px 12px 8px", borderBottom: "1px solid var(--line)" }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.08em", color: "var(--ink-3)", marginBottom: 8 }}>{pessoas.length} USUÁRIOS CADASTRADOS</div>
            <div className="ring-focus" style={{ display: "flex", alignItems: "center", gap: 6, border: "1px solid var(--line)", borderRadius: 8, padding: "5px 8px" }}>
              <Ic.Search size={12} color="var(--ink-4)" />
              <input autoFocus value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar pessoa ou revenda…" style={{ border: 0, outline: 0, background: "transparent", fontSize: 12, width: "100%", color: "var(--ink)" }} />
            </div>
          </div>
          {imp && (
            <button onClick={voltar} disabled={!!ocupado} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", border: 0, borderBottom: "1px solid var(--line)", background: "var(--amber-soft)", cursor: "pointer", textAlign: "left", fontSize: 12.5, fontWeight: 600, color: "var(--amber-text)" }}>
              <Ic.ArrowLeft size={13} /> {ocupado === "voltar" ? "Voltando…" : `Voltar para ${imp.adminNome} (admin)`}
            </button>
          )}
          {erro && <div style={{ padding: "8px 12px", fontSize: 12, color: "var(--rose)", background: "var(--rose-soft)" }}>{erro}</div>}
          <div style={{ overflowY: "auto", padding: "4px 6px 8px" }}>
            {pessoas.length === 0 && <div style={{ padding: 14, fontSize: 12, color: "var(--ink-3)" }}>Carregando…</div>}
            {grupos.map(g => (
              <div key={g.papel}>
                <div style={{ padding: "10px 8px 4px", fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", color: "var(--ink-4)", textTransform: "uppercase" }}>{g.titulo}</div>
                {g.itens.map(p => {
                  const atual = p.id === profile.id;
                  const bloqueado = p.papel === "admin" && !atual;
                  return (
                    <button key={p.id} onClick={() => !bloqueado && verComo(p)} disabled={!!ocupado || bloqueado} className={atual ? undefined : "nav-item"}
                      title={bloqueado ? "Não é possível visualizar como outro administrador" : undefined}
                      style={{ display: "flex", alignItems: "center", gap: 9, width: "100%", padding: "7px 8px", border: 0, borderRadius: 8, cursor: bloqueado ? "default" : "pointer", textAlign: "left", background: atual ? "var(--navy-soft)" : "transparent", opacity: bloqueado ? 0.5 : 1 }}>
                      <Avatar name={p.nome} size={26} />
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: atual ? "var(--navy)" : "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.nome}</span>
                        <span style={{ display: "block", fontSize: 11, color: "var(--ink-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.rotulo}{p.revenda?.nome ? ` · ${p.revenda.nome}` : ""}</span>
                      </span>
                      {ocupado === p.id ? <span style={{ fontSize: 11, color: "var(--ink-3)" }}>entrando…</span> : atual ? <Ic.Check size={13} color="var(--navy)" /> : null}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** Faixa no topo enquanto o admin está dentro da conta de outra pessoa.
 *  Tem o próprio botão "Voltar" — no celular o seletor do topo fica escondido. */
export function FaixaImpersonacao() {
  const { profile } = useAuth();
  const imp = lerImp();
  const [voltando, setVoltando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  if (!imp || !profile || profile.papel === "admin") return null;

  async function voltar() {
    setVoltando(true); setErro(null);
    try {
      const { data, error } = await supabase.functions.invoke("impersonar", { body: { acao: "voltar", impersonacao_id: imp!.id } });
      if (error || !data?.token_hash) throw new Error(data?.erro ?? error?.message ?? "Falha ao voltar");
      localStorage.removeItem(CHAVE_IMP);
      await entrarCom(data.token_hash);
    } catch (e) { setErro((e as Error).message); setVoltando(false); }
  }

  return (
    <div style={{ background: "var(--amber)", color: "white", fontSize: 12, fontWeight: 600, padding: "6px 12px 6px 16px", display: "flex", alignItems: "center", gap: 8, flexShrink: 0, flexWrap: "wrap" }}>
      <Ic.Eye size={13} />
      <span style={{ flex: "1 1 180px", minWidth: 0, lineHeight: 1.35 }}>
        Vendo como <b>{profile.nome}</b>
        <span className="only-desktop"> — você ({imp.adminNome}) está na conta dessa pessoa; o que fizer aqui fica registrado como ação dela.</span>
        {erro && <span style={{ display: "block", fontWeight: 500 }}>{erro}</span>}
      </span>
      <button onClick={voltar} disabled={voltando} style={{
        display: "inline-flex", alignItems: "center", gap: 5, border: "1px solid rgba(255,255,255,0.7)", background: "rgba(255,255,255,0.15)",
        color: "white", borderRadius: 99, padding: "3px 10px", fontSize: 11.5, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap",
      }}>
        <Ic.ArrowLeft size={11} /> {voltando ? "Voltando…" : `Voltar para ${imp.adminNome}`}
      </button>
    </div>
  );
}

export function limparImpersonacaoAoSair() {
  try { localStorage.removeItem(CHAVE_IMP); localStorage.removeItem(CHAVE_LISTA); } catch { /* ignore */ }
}
