import React, { useEffect, useState } from "react";
import { Ic } from "./icons";
import {
  Btn, Badge, Avatar, Input, Section, Tabs,
  KV, Field,
} from "./ui";
import { type User } from "./data";
import { useAuth } from "./auth";
import { supabase } from "./lib/supabase";
import { updateMyProfile, useLiveNotificacoes, marcarNotifLida, marcarTodasLidas, meusAceites, TERMOS_VERSAO, POLITICA_VERSAO } from "./lib/data-live";

/* === Perfil === */
export function PerfilScreen({ user }: { user: User }) {
  const { profile, reloadProfile, signOut } = useAuth();
  const [tab, setTab] = useState("info");
  const [nome, setNome] = useState(profile?.nome ?? user.nome);
  const [whats, setWhats] = useState(profile?.whats ?? user.whats);
  const [uf, setUf] = useState(profile?.uf ?? user.uf);
  const [cidade, setCidade] = useState(profile?.cidade ?? "");
  const [oab, setOab] = useState(profile?.oab ?? user.oab ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    if (profile) {
      setNome(profile.nome);
      setWhats(profile.whats ?? "");
      setUf(profile.uf ?? "");
      setCidade(profile.cidade ?? "");
      setOab(profile.oab ?? "");
    }
  }, [profile?.id]);

  const save = async () => {
    if (!profile?.id) return;
    setBusy(true); setMsg(null);
    const { error } = await updateMyProfile(profile.id, {
      nome: nome.trim(),
      whats: whats.trim() || null,
      uf: uf.trim() || null,
      cidade: cidade.trim() || null,
      oab: oab.trim() || null,
    });
    setBusy(false);
    if (error) { setMsg({ kind: "err", text: error }); return; }
    setMsg({ kind: "ok", text: "Alterações salvas." });
    await reloadProfile();
  };

  return (
    <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 16, maxWidth: 980 }}>
      <header>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, letterSpacing: "-0.015em" }}>Perfil</h1>
        <div style={{ fontSize: 13, color: "var(--ink-3)", marginTop: 4 }}>Suas informações, segurança e preferências</div>
      </header>

      <div className="perfil-card" style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 6, padding: "18px 20px", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <Avatar name={profile?.nome ?? user.nome} size={64} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 600 }}>{profile?.nome ?? user.nome}</div>
          <div style={{ fontSize: 12.5, color: "var(--ink-3)", marginTop: 3, wordBreak: "break-word" }}>
            {user.papel} · {profile?.email ?? user.email}
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
            <Badge dotColor="var(--green)">Conta ativa</Badge>
            {profile?.oab && <Badge>{profile.oab}</Badge>}
            {profile?.revenda_id && <Badge>Revenda vinculada</Badge>}
          </div>
        </div>
      </div>

      <Tabs active={tab} onChange={setTab} tabs={[
        { id: "info", label: "Informações", icon: <Ic.User size={13} /> },
        { id: "seguranca", label: "Segurança", icon: <Ic.Lock size={13} /> },
        { id: "lgpd", label: "Privacidade LGPD", icon: <Ic.Doc size={13} /> },
      ]} />

      {msg && (
        <div style={{
          background: msg.kind === "ok" ? "var(--green-soft)" : "var(--rose-soft)",
          border: `1px solid ${msg.kind === "ok" ? "oklch(0.85 0.06 145)" : "var(--rose-border)"}`,
          color: msg.kind === "ok" ? "var(--green)" : "var(--rose)",
          padding: "9px 12px", borderRadius: 5, fontSize: 12.5,
        }}>{msg.text}</div>
      )}

      {tab === "info" && (
        <Section title="Informações pessoais">
          <div className="grid-2col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <Field label="Nome completo"><Input full value={nome} onChange={e=>setNome(e.target.value)} /></Field>
            <Field label="Email"><Input full value={profile?.email ?? user.email} onChange={()=>{}} /></Field>
            <Field label="WhatsApp"><Input full value={whats} onChange={e=>setWhats(e.target.value)} /></Field>
            <Field label="Cidade"><Input full value={cidade} onChange={e=>setCidade(e.target.value)} /></Field>
            <Field label="UF"><Input full value={uf} onChange={e=>setUf(e.target.value)} /></Field>
            {(profile?.papel === "advogado" || profile?.papel === "admin") && (
              <Field label="OAB"><Input full value={oab} onChange={e=>setOab(e.target.value)} placeholder="OAB/SP 12.345" /></Field>
            )}
            <div style={{ gridColumn: "1 / -1", display: "flex", gap: 8 }}>
              <Btn variant="primary" size="sm" onClick={save} disabled={busy}>{busy ? "Salvando…" : "Salvar alterações"}</Btn>
            </div>
          </div>
        </Section>
      )}

      {tab === "seguranca" && <SegurancaTab />}

      {tab === "lgpd" && <LGPDTab signOut={signOut} />}
    </div>
  );
}

function SegurancaTab() {
  const [atual, setAtual] = useState("");
  const [nova, setNova] = useState("");
  const [confirma, setConfirma] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const trocar = async () => {
    setMsg(null);
    if (nova.length < 6) { setMsg({ kind: "err", text: "A senha precisa ter pelo menos 6 caracteres." }); return; }
    if (nova !== confirma) { setMsg({ kind: "err", text: "A confirmação não bate com a nova senha." }); return; }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: nova });
    setBusy(false);
    if (error) { setMsg({ kind: "err", text: error.message }); return; }
    setMsg({ kind: "ok", text: "Senha alterada com sucesso." });
    setAtual(""); setNova(""); setConfirma("");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <Section title="Senha">
        {msg && (
          <div style={{
            background: msg.kind === "ok" ? "var(--green-soft)" : "var(--rose-soft)",
            border: `1px solid ${msg.kind === "ok" ? "oklch(0.85 0.06 145)" : "var(--rose-border)"}`,
            color: msg.kind === "ok" ? "var(--green)" : "var(--rose)",
            padding: "9px 12px", borderRadius: 5, fontSize: 12.5, marginBottom: 12,
          }}>{msg.text}</div>
        )}
        <div className="grid-3col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
          <Field label="Senha atual (informativo)"><Input full type="password" value={atual} onChange={e=>setAtual(e.target.value)} /></Field>
          <Field label="Nova senha" hint="Mínimo 6 caracteres."><Input full type="password" value={nova} onChange={e=>setNova(e.target.value)} /></Field>
          <Field label="Confirmar nova senha"><Input full type="password" value={confirma} onChange={e=>setConfirma(e.target.value)} /></Field>
        </div>
        <div style={{ marginTop: 10 }}><Btn variant="primary" size="sm" onClick={trocar} disabled={busy || !nova || !confirma}>{busy ? "Alterando…" : "Alterar senha"}</Btn></div>
      </Section>
      <Section title="Autenticação em dois fatores (2FA)">
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ flex: 1, fontSize: 13, color: "var(--ink-2)", lineHeight: 1.55 }}>
            Recurso disponibilizado em fase futura. Por enquanto, mantenha uma senha forte.
          </div>
          <Btn variant="default" disabled>Ativar 2FA</Btn>
        </div>
      </Section>
    </div>
  );
}

function LGPDTab({ signOut }: { signOut: () => Promise<void> }) {
  const { profile } = useAuth();
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const exportar = async () => {
    if (!profile?.id) return;
    setExporting(true); setMsg(null);
    try {
      const [{ data: prof }, { data: leads }, { data: casos }, { data: tarefas }, { data: notas }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", profile.id).maybeSingle(),
        supabase.from("leads").select("*").eq("rep_id", profile.id),
        supabase.from("casos").select("*").eq("advogado_id", profile.id),
        supabase.from("tarefas").select("*").eq("autor_id", profile.id),
        supabase.from("notas").select("*").eq("autor_id", profile.id),
      ]);
      const dump = {
        exported_at: new Date().toISOString(),
        user_id: profile.id,
        profile: prof,
        leads: leads ?? [],
        casos: casos ?? [],
        tarefas: tarefas ?? [],
        notas: notas ?? [],
      };
      const blob = new Blob([JSON.stringify(dump, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `advox-meus-dados-${profile.id}.json`; a.click();
      URL.revokeObjectURL(url);
      setMsg({ kind: "ok", text: "Seus dados foram exportados." });
    } catch (e) {
      setMsg({ kind: "err", text: e instanceof Error ? e.message : String(e) });
    }
    setExporting(false);
  };

  const excluir = async () => {
    if (!profile?.id) return;
    const ok = window.confirm("Tem certeza? Sua conta será suspensa imediatamente e os dados marcados para exclusão. Esta ação pode ser revertida pelo admin em até 30 dias.");
    if (!ok) return;
    setDeleting(true); setMsg(null);
    const { error } = await supabase.from("profiles").update({ status: "suspenso" } as never).eq("id", profile.id);
    setDeleting(false);
    if (error) { setMsg({ kind: "err", text: error.message }); return; }
    await signOut();
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {msg && (
        <div style={{
          background: msg.kind === "ok" ? "var(--green-soft)" : "var(--rose-soft)",
          border: `1px solid ${msg.kind === "ok" ? "oklch(0.85 0.06 145)" : "var(--rose-border)"}`,
          color: msg.kind === "ok" ? "var(--green)" : "var(--rose)",
          padding: "9px 12px", borderRadius: 5, fontSize: 12.5,
        }}>{msg.text}</div>
      )}
      <Section title="Seus dados">
        <p style={{ margin: 0, fontSize: 12.5, color: "var(--ink-2)", lineHeight: 1.6 }}>
          Sob a LGPD, você tem o direito de exportar todos os seus dados pessoais armazenados no Advox em formato legível, ou de solicitar a suspensão e exclusão completa da sua conta.
        </p>
        <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
          <Btn variant="default" icon={<Ic.Download size={13} />} onClick={exportar} disabled={exporting}>{exporting ? "Exportando…" : "Exportar meus dados (JSON)"}</Btn>
          <Btn variant="danger" icon={<Ic.Trash size={13} />} onClick={excluir} disabled={deleting}>{deleting ? "Suspendendo…" : "Excluir minha conta"}</Btn>
        </div>
      </Section>
      <Section title="Termos aceitos">
        <AceitesView />
      </Section>
    </div>
  );
}

function AceitesView() {
  const { profile } = useAuth();
  const [list, setList] = useState<Array<{ tipo: string; versao: string; aceito_em: string }> | null>(null);
  useEffect(() => {
    if (!profile?.id) return;
    meusAceites(profile.id).then(setList);
  }, [profile?.id]);
  if (!list) return <div style={{ fontSize: 12.5, color: "var(--ink-3)" }}>Carregando…</div>;
  if (list.length === 0) return (
    <div style={{ fontSize: 12.5, color: "var(--ink-3)" }}>
      Nenhum aceite registrado.{" "}
      <span style={{ color: "var(--ink-4)" }}>(Versão atual: Termos {TERMOS_VERSAO} · Política {POLITICA_VERSAO})</span>
    </div>
  );
  return (
    <div style={{ fontSize: 12.5, color: "var(--ink-2)", lineHeight: 1.6 }}>
      {list.map((a, i) => (
        <KV key={i}
          k={a.tipo === "termos_uso" ? "Termos de Uso" : "Política de Privacidade"}
          v={`${a.versao} · aceito em ${new Date(a.aceito_em).toLocaleDateString("pt-BR")}`}
        />
      ))}
    </div>
  );
}

/* === Notificações === */
export function NotifPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { profile } = useAuth();
  const { items } = useLiveNotificacoes(profile?.id);

  if (!open) return null;
  const unread = (items ?? []).filter(n => !n.lida).length;

  const icone = (tipo: string) => {
    if (tipo === "caso_liberado" || tipo === "caso_recebido" || tipo === "caso_status_mudou") return <Ic.Scale size={14} />;
    if (tipo === "lead_movido") return <Ic.ArrowRight size={14} />;
    if (tipo === "tarefa_atrasada") return <Ic.Clock size={14} />;
    if (tipo === "rep_aprovado") return <Ic.CheckCircle size={14} />;
    return <Ic.Info size={14} />;
  };

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 60 }} />
      <div className="fade-up notif-panel" style={{
        position: "fixed", top: 86, right: 18, zIndex: 70,
        width: 400, maxHeight: "70vh",
        background: "var(--surface)", border: "1px solid var(--line-2)",
        borderRadius: 8, boxShadow: "var(--shadow-lg)",
        display: "flex", flexDirection: "column",
      }}>
        <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>Notificações</span>
          {unread > 0 && <Badge dotColor="var(--rose)" bg="var(--rose-soft)" border="oklch(0.85 0.05 25)" color="var(--rose)">{unread} novas</Badge>}
          <button onClick={async () => { if (profile?.id) await marcarTodasLidas(profile.id); }}
            style={{ marginLeft: "auto", background: "transparent", border: 0, color: "var(--ink-3)", fontSize: 11.5, cursor: "pointer" }}>
            Marcar tudo lido
          </button>
        </div>
        <div style={{ overflow: "auto", flex: 1 }}>
          {items === null ? (
            <div style={{ padding: 24, textAlign: "center", color: "var(--ink-3)", fontSize: 12.5 }}>Carregando…</div>
          ) : items.length === 0 ? (
            <div style={{ padding: 30, textAlign: "center", color: "var(--ink-3)", fontSize: 12.5 }}>
              Sem notificações no momento.
              <div style={{ marginTop: 8, fontSize: 11, color: "var(--ink-4)" }}>
                Você será avisado quando casos avançarem, sua conta for aprovada, etc.
              </div>
            </div>
          ) : items.map((n, i) => (
            <div key={n.id}
              onClick={() => marcarNotifLida(n.id)}
              style={{
                display: "flex", gap: 10, padding: "11px 14px",
                borderBottom: i < items.length - 1 ? "1px solid var(--line)" : 0,
                background: n.lida ? "transparent" : "oklch(0.97 0.02 240)",
                cursor: "pointer",
              }}>
              <span style={{ width: 26, height: 26, borderRadius: 5, background: "var(--surface-3)", color: "var(--ink-2)", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                {icone(n.tipo)}
              </span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12.5, color: "var(--ink)", fontWeight: 500, lineHeight: 1.4 }}>{n.titulo}</div>
                {n.texto && <div style={{ fontSize: 12, color: "var(--ink-2)", lineHeight: 1.45, marginTop: 2 }}>{n.texto}</div>}
                <div style={{ fontSize: 11, color: "var(--ink-4)", marginTop: 3 }}>{new Date(n.created_at).toLocaleString("pt-BR")}</div>
              </div>
              {!n.lida && <span style={{ width: 6, height: 6, borderRadius: 99, background: "var(--navy)", marginTop: 6 }} />}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

/* === Onboarding === */
export function RepOnboarding({ onOpenDesbloq }: { onOpenDesbloq: () => void }) {
  return (
    <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 18 }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 600, letterSpacing: "-0.02em" }}>Bem-vindo ao Advox.</h1>
        <div style={{ marginTop: 6, color: "var(--ink-2)", fontSize: 14, maxWidth: 640, lineHeight: 1.55 }}>
          Antes de mostrar seu painel, escolha como quer começar — você pode usar
          os três caminhos abaixo agora ou quando quiser.
        </div>
      </div>
      <div className="grid-3col" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
        <OnbCard icon={<Ic.Unlock size={22} />} highlight
          titulo="Já tenho um cliente preso"
          desc="Use o botão DESBLOQUEAR CLIENTE para indicar agora um caso ao escritório."
          cta={<Btn variant="gold" size="sm" icon={<Ic.Unlock size={12} />} onClick={onOpenDesbloq}>Desbloquear Cliente</Btn>}
        />
        <OnbCard icon={<Ic.Plus size={22} />}
          titulo="Cadastrar primeiro lead"
          desc="Comece seu pipeline manualmente. Empresa, contato, operadora e valor estimado."
          cta={<Btn variant="primary" size="sm" icon={<Ic.Plus size={12} />}>Novo lead manualmente</Btn>}
        />
        <OnbCard icon={<Ic.Upload size={22} />}
          titulo="Importar planilha"
          desc="Já tem leads em CSV? Import virá em fase futura."
          cta={<Btn variant="default" size="sm" icon={<Ic.Upload size={12} />} disabled>Importar (em breve)</Btn>}
        />
      </div>

      <Section title="O básico que você precisa saber">
        <ol style={{ margin: 0, paddingLeft: 20, color: "var(--ink-2)", fontSize: 13, lineHeight: 1.7 }}>
          <li>O sistema é <strong style={{ color: "var(--ink)" }}>100% grátis para você</strong>. Honorários, se houver êxito, são pagos pelo cliente final.</li>
          <li>O botão <strong style={{ color: "var(--ink)" }}>DESBLOQUEAR CLIENTE</strong> fica sempre visível no topo.</li>
          <li>Quando um cliente vai para o escritório, ele continua no seu pipeline na coluna <strong style={{ color: "var(--ink)" }}>Travado (Advox)</strong>.</li>
          <li>Conforme o jurídico avança, você é notificado e o caso volta para <strong style={{ color: "var(--ink)" }}>Negociação Final</strong>.</li>
        </ol>
      </Section>
    </div>
  );
}

function OnbCard({ icon, titulo, desc, cta, highlight }: { icon: React.ReactNode; titulo: string; desc: string; cta: React.ReactNode; highlight?: boolean }) {
  return (
    <div style={{
      background: highlight ? "linear-gradient(180deg, var(--gold-soft), var(--gold-soft))" : "var(--surface)",
      border: `1px solid ${highlight ? "var(--gold-border)" : "var(--line)"}`,
      borderRadius: 6, padding: 18,
      display: "flex", flexDirection: "column", gap: 10,
    }}>
      <span style={{
        width: 40, height: 40, borderRadius: 6,
        background: highlight ? "var(--gold-soft-2)" : "var(--surface-3)",
        color: highlight ? "var(--gold-deep)" : "var(--ink-2)",
        display: "inline-flex", alignItems: "center", justifyContent: "center",
      }}>{icon}</span>
      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>{titulo}</div>
      <div style={{ fontSize: 12.5, color: "var(--ink-2)", lineHeight: 1.5, flex: 1 }}>{desc}</div>
      <div style={{ marginTop: 4 }}>{cta}</div>
    </div>
  );
}

/* === 404 / 500 === */
export function ErrorScreen({ code = 404, onBack }: { code?: number; onBack: () => void }) {
  const t = code === 500 ? {
    titulo: "Algo deu errado",
    desc: "Tivemos um problema interno e nossa equipe já foi notificada.",
    cta: "Tentar novamente",
  } : {
    titulo: "Página não encontrada",
    desc: "O endereço que você procurou não existe ou foi movido.",
    cta: "Voltar ao painel",
  };
  return (
    <div style={{ padding: 60, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", minHeight: "60vh" }}>
      <div className="mono" style={{ fontSize: 80, fontWeight: 700, color: "var(--ink-4)", letterSpacing: "-0.05em", lineHeight: 1 }}>{code}</div>
      <h1 style={{ margin: "16px 0 8px", fontSize: 22, fontWeight: 600 }}>{t.titulo}</h1>
      <p style={{ maxWidth: 480, color: "var(--ink-2)", fontSize: 13.5, lineHeight: 1.55, margin: 0 }}>{t.desc}</p>
      <div style={{ marginTop: 20, display: "flex", gap: 8 }}>
        <Btn variant="primary" onClick={onBack}>{t.cta}</Btn>
      </div>
    </div>
  );
}
