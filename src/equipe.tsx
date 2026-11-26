// Meu Time (organograma + gestão da equipe) e Revendas da empresa (proprietário).
//
// Hierarquia: Proprietário > Gerente > Coordenador > Consultor ('rep').
// O banco (RLS) já entrega só quem o usuário pode ver; as mudanças passam
// pelas funções aprovar_membro / definir_superior / definir_funcao /
// alocar_revenda / definir_status_membro, que checam a permissão de novo.
import React, { useEffect, useMemo, useState } from "react";
import { Ic } from "./icons";
import { Avatar, Badge, Btn, Empty, Field, Input, Select } from "./ui";
import { useAuth } from "./auth";
import { supabase } from "./lib/supabase";
import { rotuloPapel, rankPapel, rpcEquipe, type Papel } from "./lib/data-live";
import type { ContaStatus } from "./lib/database.types";
import { ConvidarModal } from "./invite-modal";
import { BrandingModal } from "./branding-modal";

type Membro = {
  id: string;
  nome: string;
  email: string;
  papel: Papel;
  status: ContaStatus;
  revenda_id: string | null;
  superior_id: string | null;
  empresa_id: string | null;
  cidade: string | null;
  uf: string | null;
  created_at: string;
};
type RevendaEmpresa = { id: string; nome: string; cnpj: string | null; sede: boolean; status: ContaStatus; logo_url: string | null; cor_primaria: string | null };

const COR_PAPEL: Record<string, string> = {
  proprietario: "var(--gold)",
  gerente: "oklch(0.55 0.15 280)",
  coord: "var(--navy)",
  rep: "oklch(0.58 0.12 160)",
};

function useEquipe() {
  const { profile } = useAuth();
  const [membros, setMembros] = useState<Membro[] | null>(null);
  const [revendas, setRevendas] = useState<RevendaEmpresa[]>([]);
  const [empresaNome, setEmpresaNome] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, nome, email, papel, status, revenda_id, superior_id, empresa_id, cidade, uf, created_at")
      .in("papel", ["proprietario", "gerente", "coord", "rep"])
      .order("nome");
    if (error) { setErro(error.message); return; }
    setMembros((data ?? []) as unknown as Membro[]);
    if (profile?.empresa_id) {
      const [{ data: revs }, { data: emp }] = await Promise.all([
        supabase.from("revendas").select("id, nome, cnpj, sede, status, logo_url, cor_primaria").eq("empresa_id", profile.empresa_id).order("sede", { ascending: false }).order("nome"),
        supabase.from("empresas" as never).select("nome").eq("id", profile.empresa_id).maybeSingle(),
      ]);
      setRevendas((revs ?? []) as unknown as RevendaEmpresa[]);
      setEmpresaNome((emp as { nome: string } | null)?.nome ?? null);
    }
  };

  useEffect(() => {
    carregar();
    const ch = supabase.channel("equipe-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => carregar())
      .on("postgres_changes", { event: "*", schema: "public", table: "revendas" }, () => carregar())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id, profile?.empresa_id]);

  return { membros, revendas, empresaNome, erro, recarregar: carregar };
}

/* ====================================================================
 * MEU TIME
 * ================================================================== */
export function MeuTime({ onOpenMembro }: { onOpenMembro: (nome: string) => void }) {
  const { profile } = useAuth();
  const { membros, revendas, empresaNome, erro, recarregar } = useEquipe();
  const [convidar, setConvidar] = useState(false);
  const [aberto, setAberto] = useState<Membro | null>(null);
  const meuPapel = profile?.papel as Papel;
  const nomeRevenda = (id: string | null) => revendas.find(r => r.id === id)?.nome ?? null;

  const todos = membros ?? [];
  const eu = todos.find(m => m.id === profile?.id) ?? null;
  const ativos = todos.filter(m => m.status === "ativo" || m.status === "suspenso");
  const pendentes = todos.filter(m => m.status === "pendente" && m.id !== profile?.id);
  const filhos = (id: string) => ativos.filter(m => m.superior_id === id);

  const contagem = (["gerente", "coord", "rep"] as Papel[])
    .map(p => ({ p, n: ativos.filter(m => m.papel === p && m.id !== profile?.id).length }))
    .filter(x => x.n > 0);

  // Colunas abaixo de mim no organograma.
  const colunas = useMemo(() => {
    if (!eu) return [] as React.ReactNode[];
    const abrir = (m: Membro) => setAberto(m);
    const blocoCoord = (c: Membro) => (
      <BlocoCoord key={c.id} coord={c} consultores={filhos(c.id)} revenda={nomeRevenda} onAbrir={abrir} />
    );
    if (meuPapel === "proprietario") {
      const gerentes = ativos.filter(m => m.papel === "gerente");
      const coordsSoltos = ativos.filter(m => m.papel === "coord" && !m.superior_id);
      const repsSoltos = ativos.filter(m => m.papel === "rep" && !m.superior_id);
      return [
        ...gerentes.map(g => (
          <div key={g.id} className="org-coluna">
            <Cartao m={g} revenda={nomeRevenda(g.revenda_id)} onClick={() => abrir(g)} info={`${filhos(g.id).length} coordenador(es)`} />
            {filhos(g.id).length > 0 && <div className="org-sub">{filhos(g.id).map(blocoCoord)}</div>}
          </div>
        )),
        ...(coordsSoltos.length ? [<GrupoSolto key="cs" titulo="Coordenadores sem gerente">{coordsSoltos.map(blocoCoord)}</GrupoSolto>] : []),
        ...(repsSoltos.length ? [<GrupoSolto key="rs" titulo="Consultores sem coordenador">{repsSoltos.map(r => <Chip key={r.id} m={r} onClick={() => abrir(r)} />)}</GrupoSolto>] : []),
      ];
    }
    if (meuPapel === "gerente") {
      const repsSoltos = ativos.filter(m => m.papel === "rep" && !m.superior_id);
      return [
        ...filhos(eu.id).map(c => <div key={c.id} className="org-coluna">{blocoCoord(c)}</div>),
        ...(repsSoltos.length ? [<GrupoSolto key="rs" titulo="Consultores sem coordenador">{repsSoltos.map(r => <Chip key={r.id} m={r} onClick={() => abrir(r)} />)}</GrupoSolto>] : []),
      ];
    }
    return filhos(eu.id).map(r => (
      <div key={r.id} className="org-coluna"><Cartao m={r} revenda={nomeRevenda(r.revenda_id)} onClick={() => abrir(r)} /></div>
    ));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [membros, revendas, meuPapel, eu?.id]);

  const textoVazio = meuPapel === "coord"
    ? "Ainda não há consultores no seu time. Convide alguém ou aprove um cadastro."
    : meuPapel === "gerente"
      ? "Ainda não há coordenadores no seu time. O proprietário coloca coordenadores sob gerentes."
      : "Ainda não há ninguém na empresa além de você. Convide gerentes, coordenadores e consultores.";

  return (
    <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 16 }}>
      <header style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 className="page-title" style={{ margin: 0, fontSize: 26, fontWeight: 600 }}>Meu time</h1>
          <div style={{ fontSize: 13, color: "var(--ink-3)", marginTop: 4 }}>
            {membros === null ? "Carregando…" : (
              <>
                {empresaNome && <>{empresaNome}: </>}
                {contagem.length ? contagem.map(x => `${x.n} ${x.p === "rep" ? (x.n === 1 ? "consultor" : "consultores") : x.p === "coord" ? (x.n === 1 ? "coordenador" : "coordenadores") : (x.n === 1 ? "gerente" : "gerentes")}`).join(", ") : "Sem equipe ainda"}
                {pendentes.length > 0 && <>. <strong style={{ color: "var(--amber-text)" }}>{pendentes.length} aguardando aprovação</strong></>}
              </>
            )}
          </div>
        </div>
        <Btn variant="primary" size="sm" icon={<Ic.Plus size={13} />} onClick={() => setConvidar(true)}>Convidar</Btn>
      </header>

      {erro && <div style={{ background: "var(--rose-soft)", border: "1px solid var(--rose-border)", color: "var(--rose)", padding: "10px 14px", borderRadius: 6, fontSize: 12.5 }}>{erro}</div>}

      {pendentes.length > 0 && (
        <Pendentes pendentes={pendentes} coords={ativos.filter(m => m.papel === "coord" && m.status === "ativo")} meuPapel={meuPapel} revenda={nomeRevenda} onFeito={recarregar} />
      )}

      <section style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12, boxShadow: "var(--shadow-sm)", overflow: "hidden" }}>
        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div style={{ fontSize: 14, fontWeight: 600, flex: 1 }}>Estrutura da equipe</div>
          <Legenda />
        </div>
        <div className="org-scroll">
          {membros === null ? (
            <div style={{ padding: 40, textAlign: "center", color: "var(--ink-3)", fontSize: 13 }}>Carregando equipe…</div>
          ) : !eu ? (
            <Empty icon={<Ic.Users size={20} />} title="Não foi possível montar a equipe" hint="Seu perfil não está ligado a uma empresa." />
          ) : (
            <div className="org">
              <div className="org-raiz"><Cartao m={eu} revenda={nomeRevenda(eu.revenda_id)} voce /></div>
              {colunas.length > 0 ? (
                <div className="org-ramos">
                  {colunas.map((c, i) => <div key={i} className="org-ramo">{c}</div>)}
                </div>
              ) : (
                <div style={{ marginTop: 18, maxWidth: 420, textAlign: "center", color: "var(--ink-3)", fontSize: 12.5 }}>{textoVazio}</div>
              )}
            </div>
          )}
        </div>
      </section>

      {convidar && <ConvidarModal open={convidar} onClose={() => setConvidar(false)} />}
      {aberto && (
        <GerirMembro
          m={aberto}
          meuPapel={meuPapel}
          ativos={ativos}
          revendas={revendas}
          onClose={() => setAberto(null)}
          onVerPipeline={() => { setAberto(null); onOpenMembro(aberto.nome); }}
          onFeito={() => { recarregar(); }}
        />
      )}
    </div>
  );
}

function Legenda() {
  return (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
      {(["proprietario", "gerente", "coord", "rep"] as Papel[]).map(p => (
        <span key={p} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, color: "var(--ink-3)" }}>
          <span style={{ width: 8, height: 8, borderRadius: 99, background: COR_PAPEL[p] }} />{rotuloPapel(p)}
        </span>
      ))}
    </div>
  );
}

function Cartao({ m, revenda, info, voce, onClick }: { m: Membro; revenda?: string | null; info?: string; voce?: boolean; onClick?: () => void }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag {...(onClick ? { type: "button" as const, onClick } : {})} className="org-cartao" style={{
      borderTop: `3px solid ${COR_PAPEL[m.papel] ?? "var(--line-2)"}`,
      cursor: onClick ? "pointer" : "default",
      opacity: m.status === "suspenso" ? 0.55 : 1,
    }}>
      <Avatar name={m.nome} size={34} />
      <span style={{ minWidth: 0, flex: 1, textAlign: "left" }}>
        <span style={{ display: "block", fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {m.nome}{voce && <span style={{ color: "var(--ink-4)", fontWeight: 500 }}> (você)</span>}
        </span>
        <span style={{ display: "block", fontSize: 11, color: COR_PAPEL[m.papel] ?? "var(--ink-3)", fontWeight: 600 }}>{rotuloPapel(m.papel)}</span>
        {(revenda || info || m.status === "suspenso") && (
          <span style={{ display: "block", fontSize: 10.5, color: "var(--ink-4)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {[revenda, info, m.status === "suspenso" ? "suspenso" : null].filter(Boolean).join(" · ")}
          </span>
        )}
      </span>
    </Tag>
  );
}

function Chip({ m, onClick }: { m: Membro; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="org-chip" style={{ opacity: m.status === "suspenso" ? 0.55 : 1 }}>
      <span style={{ width: 7, height: 7, borderRadius: 99, background: COR_PAPEL[m.papel], flexShrink: 0 }} />
      <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.nome}</span>
      {m.status === "suspenso" && <span style={{ fontSize: 10, color: "var(--rose)" }}>suspenso</span>}
    </button>
  );
}

function BlocoCoord({ coord, consultores, revenda, onAbrir }: { coord: Membro; consultores: Membro[]; revenda: (id: string | null) => string | null; onAbrir: (m: Membro) => void }) {
  return (
    <div className="org-bloco">
      <Cartao m={coord} revenda={revenda(coord.revenda_id)} info={`${consultores.length} consultor(es)`} onClick={() => onAbrir(coord)} />
      {consultores.length > 0 && (
        <div className="org-folhas">
          {consultores.map(r => <Chip key={r.id} m={r} onClick={() => onAbrir(r)} />)}
        </div>
      )}
    </div>
  );
}

function GrupoSolto({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="org-coluna">
      <div className="org-solto">
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--amber-text)", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
          <Ic.Warn size={12} /> {titulo}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{children}</div>
      </div>
    </div>
  );
}

/* --- Cadastros aguardando aprovação --- */
function Pendentes({ pendentes, coords, meuPapel, revenda, onFeito }: {
  pendentes: Membro[]; coords: Membro[]; meuPapel: Papel;
  revenda: (id: string | null) => string | null; onFeito: () => void;
}) {
  const [time, setTime] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const escolheTime = meuPapel === "gerente" || meuPapel === "proprietario";

  const decidir = async (m: Membro, aprovar: boolean) => {
    setBusy(m.id); setErro(null);
    const r = await rpcEquipe("aprovar_membro", { p_alvo: m.id, p_aprovar: aprovar, p_superior: time[m.id] || null });
    setBusy(null);
    if (r.error) { setErro(r.error); return; }
    onFeito();
  };

  return (
    <div style={{ background: "var(--amber-soft)", border: "1px solid var(--amber-border)", borderRadius: 10, padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600 }}>
        <Ic.Clock size={15} color="var(--amber-text)" /> {pendentes.length === 1 ? "1 cadastro aguardando aprovação" : `${pendentes.length} cadastros aguardando aprovação`}
      </div>
      {erro && <div style={{ color: "var(--rose)", fontSize: 12.5 }}>{erro}</div>}
      {pendentes.map(m => (
        <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 8, padding: "10px 12px" }}>
          <Avatar name={m.nome} size={32} />
          <div style={{ flex: "1 1 180px", minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{m.nome}</div>
            <div style={{ fontSize: 11.5, color: "var(--ink-3)", overflow: "hidden", textOverflow: "ellipsis" }}>{m.email}{revenda(m.revenda_id) ? ` · ${revenda(m.revenda_id)}` : ""}</div>
          </div>
          {escolheTime && (
            <div style={{ flex: "1 1 200px", minWidth: 180 }}>
              <Select value={time[m.id] ?? ""} onChange={e => setTime(t => ({ ...t, [m.id]: e.target.value }))}
                options={[{ value: "", label: "Sem coordenador por enquanto" }, ...coords.map(c => ({ value: c.id, label: `Time de ${c.nome}` }))]} />
            </div>
          )}
          <div style={{ display: "flex", gap: 6 }}>
            <Btn variant="primary" size="sm" disabled={busy === m.id} icon={<Ic.Check size={12} />} onClick={() => decidir(m, true)}>Aprovar</Btn>
            <Btn variant="danger" size="sm" disabled={busy === m.id} icon={<Ic.X size={12} />} onClick={() => decidir(m, false)}>Recusar</Btn>
          </div>
        </div>
      ))}
    </div>
  );
}

/* --- Gerir uma pessoa (time, função, revenda, status) --- */
function GerirMembro({ m, meuPapel, ativos, revendas, onClose, onVerPipeline, onFeito }: {
  m: Membro; meuPapel: Papel; ativos: Membro[]; revendas: RevendaEmpresa[];
  onClose: () => void; onVerPipeline: () => void; onFeito: () => void;
}) {
  const [superior, setSuperior] = useState(m.superior_id ?? "");
  const [funcao, setFuncao] = useState<Papel>(m.papel);
  const [revenda, setRevenda] = useState(m.revenda_id ?? "");
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const souProprietario = meuPapel === "proprietario";
  const abaixoDeMim = rankPapel(m.papel) < rankPapel(meuPapel);
  const podeTime = (m.papel === "rep" && (meuPapel === "gerente" || souProprietario)) || (m.papel === "coord" && souProprietario);
  const opcoesTime = ativos.filter(p => p.status === "ativo" && p.papel === (m.papel === "rep" ? "coord" : "gerente"));
  const podeFuncao = souProprietario && m.papel !== "proprietario";
  const podeRevenda = souProprietario && revendas.length > 0;
  const superiorAtual = ativos.find(p => p.id === m.superior_id);

  const rodar = async (fn: Parameters<typeof rpcEquipe>[0], args: Record<string, unknown>, msg: string) => {
    setBusy(true); setErro(null); setOk(null);
    const r = await rpcEquipe(fn, args);
    setBusy(false);
    if (r.error) { setErro(r.error); return; }
    setOk(msg); onFeito();
  };

  return (
    <div onClick={onClose} className="modal-backdrop" style={{ position: "fixed", inset: 0, zIndex: 100, background: "oklch(0.10 0.04 250 / 0.45)", backdropFilter: "blur(2px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div onClick={e => e.stopPropagation()} className="modal-shell fade-up" style={{ width: 480, maxWidth: "100%", maxHeight: "90vh", overflow: "auto", background: "var(--surface)", border: "1px solid var(--line-2)", borderRadius: 10, boxShadow: "var(--shadow-lg)" }}>
        <div style={{ padding: "16px 18px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", gap: 12 }}>
          <Avatar name={m.nome} size={40} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 600 }}>{m.nome}</div>
            <div style={{ fontSize: 12, color: "var(--ink-3)", overflow: "hidden", textOverflow: "ellipsis" }}>
              <span style={{ color: COR_PAPEL[m.papel], fontWeight: 600 }}>{rotuloPapel(m.papel)}</span> · {m.email}
            </div>
            {superiorAtual && <div style={{ fontSize: 11.5, color: "var(--ink-4)", marginTop: 2 }}>No time de {superiorAtual.nome}</div>}
          </div>
          <Badge dotColor={m.status === "ativo" ? "var(--green)" : "var(--rose)"}>{m.status === "ativo" ? "Ativo" : "Suspenso"}</Badge>
          <button onClick={onClose} style={{ background: "transparent", border: 0, color: "var(--ink-3)", cursor: "pointer", padding: 6 }}><Ic.X size={16} /></button>
        </div>

        <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>
          {erro && <div style={{ background: "var(--rose-soft)", border: "1px solid var(--rose-border)", color: "var(--rose)", padding: "9px 12px", borderRadius: 6, fontSize: 12.5 }}>{erro}</div>}
          {ok && <div style={{ background: "var(--green-soft)", color: "var(--green)", padding: "9px 12px", borderRadius: 6, fontSize: 12.5 }}>{ok}</div>}

          {(m.papel === "rep" || m.papel === "coord") && (
            <Btn variant="soft" icon={<Ic.Eye size={13} />} onClick={onVerPipeline}>Ver leads de {m.nome.split(" ")[0]}</Btn>
          )}

          {podeTime && (
            <Field label={m.papel === "rep" ? "Time do coordenador" : "Time do gerente"}>
              <div style={{ display: "flex", gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <Select value={superior} onChange={e => setSuperior(e.target.value)}
                    options={[{ value: "", label: "Sem time" }, ...opcoesTime.map(p => ({ value: p.id, label: p.nome }))]} />
                </div>
                <Btn variant="primary" disabled={busy || superior === (m.superior_id ?? "")}
                  onClick={() => rodar("definir_superior", { p_alvo: m.id, p_superior: superior || null }, "Time atualizado.")}>Salvar</Btn>
              </div>
            </Field>
          )}

          {podeFuncao && (
            <Field label="Função" hint="Ao mudar a função, a pessoa sai do time atual e quem estava abaixo dela fica sem time até ser redistribuído.">
              <div style={{ display: "flex", gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <Select value={funcao} onChange={e => setFuncao(e.target.value as Papel)}
                    options={(["gerente", "coord", "rep"] as Papel[]).map(p => ({ value: p, label: rotuloPapel(p) }))} />
                </div>
                <Btn variant="primary" disabled={busy || funcao === m.papel}
                  onClick={() => rodar("definir_funcao", { p_alvo: m.id, p_papel: funcao }, `Agora é ${rotuloPapel(funcao)}.`)}>Salvar</Btn>
              </div>
            </Field>
          )}

          {podeRevenda && (
            <Field label="Revenda">
              <div style={{ display: "flex", gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <Select value={revenda} onChange={e => setRevenda(e.target.value)}
                    options={[...(revenda ? [] : [{ value: "", label: "Escolha…" }]), ...revendas.map(r => ({ value: r.id, label: r.nome + (r.sede ? " (sede)" : "") }))]} />
                </div>
                <Btn variant="primary" disabled={busy || !revenda || revenda === (m.revenda_id ?? "")}
                  onClick={() => rodar("alocar_revenda", { p_alvo: m.id, p_revenda: revenda }, "Revenda atualizada.")}>Salvar</Btn>
              </div>
            </Field>
          )}

          {abaixoDeMim && (
            <div style={{ display: "flex", justifyContent: "flex-end", borderTop: "1px solid var(--line)", paddingTop: 12 }}>
              {m.status === "ativo" ? (
                <Btn variant="ghost" disabled={busy} onClick={() => rodar("definir_status_membro", { p_alvo: m.id, p_status: "suspenso" }, "Acesso suspenso.")}>Suspender acesso</Btn>
              ) : (
                <Btn variant="primary" disabled={busy} onClick={() => rodar("definir_status_membro", { p_alvo: m.id, p_status: "ativo" }, "Acesso reativado.")}>Reativar acesso</Btn>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ====================================================================
 * REVENDAS DA EMPRESA (só proprietário)
 * ================================================================== */
export function MinhasRevendas() {
  const { profile } = useAuth();
  const { membros, revendas, empresaNome, erro, recarregar } = useEquipe();
  const [editando, setEditando] = useState<RevendaEmpresa | "nova" | null>(null);
  const [branding, setBranding] = useState<RevendaEmpresa | null>(null);
  const pessoas = (id: string) => (membros ?? []).filter(m => m.revenda_id === id && m.status === "ativo").length;

  return (
    <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 16 }}>
      <header style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 className="page-title" style={{ margin: 0, fontSize: 26, fontWeight: 600 }}>Revendas</h1>
          <div style={{ fontSize: 13, color: "var(--ink-3)", marginTop: 4 }}>
            {revendas.length} {revendas.length === 1 ? "revenda" : "revendas"} de {empresaNome ?? "sua empresa"}
          </div>
        </div>
        <Btn variant="primary" size="sm" icon={<Ic.Plus size={13} />} onClick={() => setEditando("nova")}>Nova revenda</Btn>
      </header>

      {erro && <div style={{ background: "var(--rose-soft)", border: "1px solid var(--rose-border)", color: "var(--rose)", padding: "10px 14px", borderRadius: 6, fontSize: 12.5 }}>{erro}</div>}

      <div className="grid-2col" style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
        {revendas.map(r => (
          <div key={r.id} style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 10, padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ width: 40, height: 40, borderRadius: 8, background: r.cor_primaria || "var(--surface-3)", color: r.cor_primaria ? "white" : "var(--ink-3)", display: "inline-flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
                {r.logo_url ? <img src={r.logo_url} alt="" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} /> : <Ic.Building size={18} />}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                  {r.nome}
                  {r.sede && <Badge color="var(--gold-2)" bg="var(--gold-soft)" border="transparent">Sede</Badge>}
                </div>
                <div style={{ fontSize: 11.5, color: "var(--ink-3)" }}>
                  {r.cnpj ? <span className="mono">{r.cnpj}</span> : "Sem CNPJ"} · {pessoas(r.id)} {pessoas(r.id) === 1 ? "pessoa" : "pessoas"}
                  {r.status !== "ativo" && <> · <span style={{ color: "var(--rose)" }}>{r.status}</span></>}
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <Btn variant="soft" size="sm" icon={<Ic.Edit size={12} />} onClick={() => setEditando(r)}>Editar</Btn>
              <Btn variant="ghost" size="sm" icon={<Ic.Settings size={12} />} onClick={() => setBranding(r)}>Logo e cor</Btn>
            </div>
          </div>
        ))}
      </div>

      {editando && profile?.empresa_id && (
        <RevendaModal revenda={editando === "nova" ? null : editando} empresaId={profile.empresa_id} onClose={() => setEditando(null)} onSalvo={() => { setEditando(null); recarregar(); }} />
      )}
      {branding && (
        <BrandingModal revendaId={branding.id} revendaNome={branding.nome} logoUrl={branding.logo_url} corPrimaria={branding.cor_primaria}
          onClose={() => setBranding(null)} onSaved={recarregar} />
      )}
    </div>
  );
}

function RevendaModal({ revenda, empresaId, onClose, onSalvo }: { revenda: RevendaEmpresa | null; empresaId: string; onClose: () => void; onSalvo: () => void }) {
  const [nome, setNome] = useState(revenda?.nome ?? "");
  const [cnpj, setCnpj] = useState(revenda?.cnpj ?? "");
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErro(null);
    const campos = { nome: nome.trim(), cnpj: cnpj.trim() || null };
    const { error } = revenda
      ? await supabase.from("revendas").update(campos as never).eq("id", revenda.id)
      : await supabase.from("revendas").insert({ ...campos, empresa_id: empresaId } as never);
    setBusy(false);
    if (error) { setErro(error.message.includes("duplicate") ? "Já existe uma revenda com esse nome." : error.message); return; }
    onSalvo();
  };

  return (
    <div onClick={onClose} className="modal-backdrop" style={{ position: "fixed", inset: 0, zIndex: 100, background: "oklch(0.10 0.04 250 / 0.45)", backdropFilter: "blur(2px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <form onSubmit={salvar} onClick={e => e.stopPropagation()} className="modal-shell fade-up" style={{ width: 440, maxWidth: "100%", background: "var(--surface)", border: "1px solid var(--line-2)", borderRadius: 10, boxShadow: "var(--shadow-lg)", padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ fontSize: 15, fontWeight: 600 }}>{revenda ? "Editar revenda" : "Nova revenda"}</div>
        {!revenda && <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: -6 }}>Um novo ponto de venda da sua empresa. Depois é só alocar as pessoas nele pelo Meu Time.</div>}
        {erro && <div style={{ background: "var(--rose-soft)", border: "1px solid var(--rose-border)", color: "var(--rose)", padding: "9px 12px", borderRadius: 6, fontSize: 12.5 }}>{erro}</div>}
        <Field label="Nome"><Input full value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex.: Konecta Asa Norte" autoFocus /></Field>
        <Field label="CNPJ (opcional)"><Input full value={cnpj} onChange={e => setCnpj(e.target.value)} placeholder="00.000.000/0001-00" /></Field>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
          <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
          <Btn variant="primary" type="submit" disabled={busy || !nome.trim()}>{busy ? "Salvando…" : "Salvar"}</Btn>
        </div>
      </form>
    </div>
  );
}
