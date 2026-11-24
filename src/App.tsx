import React, { useState, useEffect } from "react";
import { Ic } from "./icons";
import { Avatar, Badge, DesbloquearTopbar, Input, useIsMobile } from "./ui";
import { ModalDesbloquear } from "./modal";
import { RepDashboard, RepLeadDetail, RepTarefas, RepCasos } from "./rep";
import { CoordDashboard, CoordTime, CoordLeads, CoordCasos, CoordTarefas } from "./coord";
import { AdvDashboard, AdvCasoDetail, AdvPrazos } from "./adv";
import {
  AdminDashboard, AdminRepresentantes, AdminAdvogados, AdminAuditoria,
  AdminTodosLeads, AdminTodosCasos, AdminConfig, AdminRevendas,
} from "./admin";
import { PerfilScreen, NotifPanel } from "./shared";
import {
  PIPELINE_COMERCIAL, PIPELINE_JURIDICO,
  type Persona, type Representante, type User as MockUser,
} from "./data";
import { useLiveNotificacoes, useRevendaInfo, useApplyRevendaTheme, type UiLead as Lead, type UiCaso as Caso } from "./lib/data-live";
import { useAuth, AuthGate, PendingApproval, AuthLoading, ProfileErrorScreen, NovaSenha, type Profile } from "./auth";

const PAPEL_TO_PERSONA: Record<Profile["papel"], Persona> = {
  rep: "rep",
  coord: "coord",
  advogado: "adv",
  admin: "admin",
};

type NavItem = {
  id: string;
  label: string;
  icon: React.ReactNode;
  badge?: string;
  sub?: string;
};

const NAV: Record<Persona, NavItem[]> = {
  rep: [
    { id: "dashboard",  label: "Painel",          icon: <Ic.Dashboard size={14} /> },
    { id: "tarefas",    label: "Tarefas",         icon: <Ic.Check size={14} /> },
    { id: "casos",      label: "Casos Jurídicos", icon: <Ic.Scale size={14} /> },
  ],
  coord: [
    { id: "dashboard", label: "Painel",            icon: <Ic.Dashboard size={14} /> },
    { id: "time",      label: "Meu Time",          icon: <Ic.Users size={14} /> },
    { id: "leads",     label: "Leads da Equipe",   icon: <Ic.Briefcase size={14} /> },
    { id: "casos",     label: "Casos da Equipe",   icon: <Ic.Scale size={14} /> },
    { id: "tarefas",   label: "Tarefas da Equipe", icon: <Ic.Check size={14} /> },
  ],
  adv: [
    { id: "dashboard", label: "Painel",  icon: <Ic.Dashboard size={14} /> },
    { id: "prazos",    label: "Prazos",  icon: <Ic.Calendar size={14} /> },
  ],
  admin: [
    { id: "dashboard",      label: "Visão Geral",     icon: <Ic.Dashboard size={14} /> },
    { id: "revendas",       label: "Revendas",        icon: <Ic.Building size={14} /> },
    { id: "representantes", label: "Representantes",  icon: <Ic.Users size={14} /> },
    { id: "advogados",      label: "Advogados",       icon: <Ic.Gavel size={14} /> },
    { id: "leads",          label: "Todos os Leads",  icon: <Ic.Briefcase size={14} /> },
    { id: "casos",          label: "Todos os Casos",  icon: <Ic.Scale size={14} /> },
    { id: "auditoria",      label: "Auditoria",       icon: <Ic.Audit size={14} /> },
    { id: "config",         label: "Configurações",   icon: <Ic.Settings size={14} /> },
  ],
};

export function App() {
  const { loading, session, profile, profileError, recuperandoSenha } = useAuth();

  // Veio do link "Esqueci minha senha": primeiro define a senha nova.
  if (recuperandoSenha && session) return <NovaSenha />;
  if (recuperandoSenha && loading) return <AuthLoading />;

  // Render otimista: se já temos profile ativo do cache, mostra a app
  // imediato. onAuthStateChange confirma a session em background — se
  // a session for inválida, o provider derruba pro AuthGate.
  if (profile && profile.status === "ativo") return <AppInner profile={profile} />;

  if (loading) return <AuthLoading />;
  if (!session) return <AuthGate />;
  if (profileError) return <ProfileErrorScreen />;
  if (!profile) return <AuthLoading />;
  return <PendingApproval />;
}

function AppInner({ profile }: { profile: Profile }) {
  const persona: Persona = PAPEL_TO_PERSONA[profile.papel];
  const [route, setRoute] = useState("dashboard");
  const [openLead, setOpenLead] = useState<Lead | null>(null);
  const [openCaso, setOpenCaso] = useState<Caso | null>(null);
  const [modal, setModal] = useState(false);
  const [showNotif, setShowNotif] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [coordFocusRep, setCoordFocusRep] = useState<string | undefined>(undefined);
  const isMobile = useIsMobile();

  // Branding por revenda (logo + cor primária)
  const { info: revendaInfo } = useRevendaInfo(profile.revenda_id);
  useApplyRevendaTheme(revendaInfo?.cor_primaria ?? null);

  // user: derived from real profile, falling back to mock fields for screens
  // that still reference mock-only fields (revenda label, etc.)
  const user: MockUser = {
    nome: profile.nome,
    papel: profile.papel === "advogado" ? "Advogada" : profile.papel === "coord" ? "Coordenador da Revenda" : profile.papel === "admin" ? "Administrador" : "Representante",
    email: profile.email,
    revenda: profile.revenda_id ? (revendaInfo?.nome ?? "—") : undefined,
    oab: profile.oab ?? undefined,
    uf: profile.uf ?? "—",
    whats: profile.whats ?? "—",
  };

  useEffect(() => { setRoute("dashboard"); setOpenLead(null); setOpenCaso(null); setCoordFocusRep(undefined); }, [persona]);
  useEffect(() => { if (!isMobile) setDrawerOpen(false); }, [isMobile]);
  useEffect(() => { setDrawerOpen(false); }, [route, persona, openLead, openCaso]);

  const renderMain = () => {
    if (openLead) return <RepLeadDetail lead={openLead} onBack={() => setOpenLead(null)} onOpenDesbloq={() => setModal(true)} />;
    if (openCaso) return <AdvCasoDetail caso={openCaso} onBack={() => setOpenCaso(null)} />;

    if (persona === "rep") {
      if (route === "dashboard")  return <RepDashboard onOpenLead={setOpenLead} onOpenDesbloq={() => setModal(true)} />;
      if (route === "tarefas")    return <RepTarefas />;
      if (route === "casos")      return <RepCasos onOpenLead={setOpenLead} />;
      if (route === "perfil")     return <PerfilScreen user={user} />;
    }
    if (persona === "coord") {
      if (route === "dashboard") return <CoordDashboard onOpenLead={setOpenLead} />;
      if (route === "time")      return <CoordTime onOpenRep={(r) => { setCoordFocusRep(r.nome); setRoute("leads"); }} />;
      if (route === "leads")     return <CoordLeads onOpenLead={setOpenLead} focusRep={coordFocusRep} onClearFocus={() => setCoordFocusRep(undefined)} />;
      if (route === "casos")     return <CoordCasos onOpenLead={setOpenLead} />;
      if (route === "tarefas")   return <CoordTarefas />;
      if (route === "perfil")    return <PerfilScreen user={user} />;
    }
    if (persona === "adv") {
      if (route === "dashboard") return <AdvDashboard onOpenCaso={setOpenCaso} />;
      if (route === "prazos")    return <AdvPrazos />;
      if (route === "perfil")    return <PerfilScreen user={user} />;
    }
    if (persona === "admin") {
      if (route === "dashboard")      return <AdminDashboard />;
      if (route === "revendas")       return <AdminRevendas />;
      if (route === "representantes") return <AdminRepresentantes />;
      if (route === "advogados")      return <AdminAdvogados />;
      if (route === "leads")          return <AdminTodosLeads onOpenLead={setOpenLead} />;
      if (route === "casos")          return <AdminTodosCasos onOpenCaso={setOpenCaso} />;
      if (route === "auditoria")      return <AdminAuditoria />;
      if (route === "config")         return <AdminConfig />;
      if (route === "perfil")         return <PerfilScreen user={user} />;
    }
    return null;
  };

  return (
    <div style={{
      height: "100vh", background: "var(--bg)",
      display: "grid", gridTemplateColumns: isMobile ? "1fr" : "240px 1fr",
      position: "relative",
    }}>
      <div
        className={`sidebar-overlay${drawerOpen ? " is-open" : ""}`}
        onClick={() => setDrawerOpen(false)}
      />
      <Sidebar
        persona={persona}
        route={route}
        setRoute={(r) => { setRoute(r); setOpenLead(null); setOpenCaso(null); }}
        isMobile={isMobile}
        drawerOpen={drawerOpen}
        revendaInfo={revendaInfo}
      />

      <div style={{ display: "flex", flexDirection: "column", minWidth: 0, minHeight: 0 }}>
        <Topbar
          user={user}
          persona={persona}
          titulo={openLead ? "Lead" : openCaso ? "Caso" : route === "perfil" ? "Meu perfil" : (NAV[persona].find(n => n.id === route)?.label ?? "")}
          revendaInfo={revendaInfo}
          onOpenNotif={() => setShowNotif(true)}
          onOpenPerfil={() => setRoute("perfil")}
          onOpenDesbloq={persona === "rep" || persona === "coord" ? () => setModal(true) : undefined}
          onToggleDrawer={() => setDrawerOpen(o => !o)}
          isMobile={isMobile}
        />
        <main style={{ flex: 1, minHeight: 0, overflow: "auto", background: "var(--bg)" }}>
          {renderMain()}
        </main>
      </div>

      <ModalDesbloquear open={modal} onClose={() => setModal(false)} />
      <NotifPanel open={showNotif} onClose={() => setShowNotif(false)} />
    </div>
  );
}

type TopbarProps = {
  user: MockUser;
  persona: Persona;
  titulo: string;
  onOpenDesbloq?: () => void;
  revendaInfo: { nome: string; logo_url: string | null } | null;
  onOpenNotif: () => void;
  onOpenPerfil: () => void;
  onToggleDrawer: () => void;
  isMobile: boolean;
};

const PERSONA_BADGE: Record<Persona, { label: string; icon: React.ReactNode }> = {
  rep:   { label: "Representante",            icon: <Ic.Briefcase size={12} /> },
  coord: { label: "Coordenador",              icon: <Ic.Users size={12} /> },
  adv:   { label: "Advogado",                 icon: <Ic.Gavel size={12} /> },
  admin: { label: "Administrador",            icon: <Ic.Settings size={12} /> },
};

function Topbar({ user, persona, titulo, revendaInfo, onOpenNotif, onOpenPerfil, onOpenDesbloq, onToggleDrawer, isMobile }: TopbarProps) {
  const { signOut, profile } = useAuth();
  const personaInfo = PERSONA_BADGE[persona];
  const { items: notifs } = useLiveNotificacoes(profile?.id);
  const unread = (notifs ?? []).filter(n => !n.lida).length;
  return (
    <div className="topbar" style={{
      display: "flex", alignItems: "center", gap: 14,
      padding: "0 22px", minHeight: 62,
      background: "var(--surface)", borderBottom: "1px solid var(--line)",
      flexShrink: 0,
    }}>
      {isMobile && (
        <button
          onClick={onToggleDrawer}
          aria-label="Abrir menu"
          style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            background: "var(--surface)", border: "1px solid var(--line)",
            borderRadius: 10, padding: 7, cursor: "pointer",
            color: "var(--ink-2)",
          }}
        >
          <Ic.List size={16} />
        </button>
      )}
      {isMobile ? <Wordmark compact /> : (
        <h1 style={{ margin: 0, fontSize: 19, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--ink)", whiteSpace: "nowrap" }}>{titulo}</h1>
      )}
      <div style={{ flex: 1 }} />

      <div className="topbar-actions" style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        {onOpenDesbloq && (
          <button onClick={onOpenDesbloq} title="Cliente preso em contrato abusivo? Indique ao jurídico." style={{
            display: "inline-flex", alignItems: "center", gap: 7,
            background: "var(--gold)", color: "var(--gold-ink)", border: 0,
            padding: "9px 14px", borderRadius: 10, fontWeight: 600, fontSize: 12.5,
            cursor: "pointer", whiteSpace: "nowrap",
            boxShadow: "0 6px 16px -6px color-mix(in oklch, var(--gold) 60%, transparent)",
          }}>
            <Ic.Unlock size={14} /><span className="only-desktop">Desbloquear cliente</span>
          </button>
        )}

        <button onClick={onOpenNotif} className="topbar-icon-btn" style={{
          background: "var(--surface)", border: "1px solid var(--line)",
          borderRadius: 10, padding: "8px 9px", position: "relative",
          color: "var(--ink-2)", cursor: "pointer", flexShrink: 0,
        }}>
          <Ic.Bell size={14} />
          {unread > 0 && (
            <span style={{
              position: "absolute", top: -2, right: -2,
              minWidth: 16, height: 16, padding: "0 4px", borderRadius: 99,
              background: "var(--rose)", color: "white",
              fontSize: 10, fontWeight: 600,
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              border: "1.5px solid var(--surface)",
            }}>{unread > 9 ? "9+" : unread}</span>
          )}
        </button>

        <button onClick={onOpenPerfil} className="topbar-user-btn" style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          background: "var(--surface)", border: "1px solid var(--line)",
          borderRadius: 10, padding: "4px 10px 4px 4px", cursor: "pointer",
          flexShrink: 0,
        }}>
          <Avatar name={user.nome} size={30} />
          <div className="only-desktop" style={{ textAlign: "left" }}>
            <div style={{ fontSize: 12.5, fontWeight: 600 }}>{user.nome}</div>
            <div style={{ fontSize: 10.5, color: "var(--ink-3)" }}>{personaInfo.label}</div>
          </div>
          <span className="only-desktop"><Ic.ChevronDown size={12} color="var(--ink-4)" /></span>
        </button>

        <button onClick={signOut} className="topbar-icon-btn" title="Sair" style={{
          background: "var(--surface)", border: "1px solid var(--line)",
          borderRadius: 10, padding: "8px 9px",
          color: "var(--ink-2)", cursor: "pointer", flexShrink: 0,
        }}>
          <Ic.Logout size={14} />
        </button>
      </div>
    </div>
  );
}

function Wordmark({ compact, subtitulo }: { compact?: boolean; subtitulo?: string }) {
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 10, minWidth: 0 }}>
      <span style={{
        width: compact ? 30 : 34, height: compact ? 30 : 34, borderRadius: 10,
        background: "linear-gradient(135deg, var(--navy), color-mix(in oklch, var(--navy) 70%, var(--gold)))",
        color: "var(--navy-ink)",
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        position: "relative", flexShrink: 0,
        boxShadow: "0 6px 14px -6px color-mix(in oklch, var(--navy) 70%, transparent)",
      }}>
        <Ic.Scale size={compact ? 15 : 17} />
        <span style={{
          position: "absolute", bottom: -2, right: -2,
          width: 9, height: 9, borderRadius: 99,
          background: "var(--gold)", border: "2px solid var(--surface)",
        }} />
      </span>
      <span style={{ display: "flex", flexDirection: "column", lineHeight: 1.15, minWidth: 0 }}>
        <span style={{ fontSize: compact ? 15 : 16, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--ink)" }}>Advox</span>
        {!compact && (
          <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--ink-4)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 150 }}>
            {subtitulo ?? "CRM Telecom"}
          </span>
        )}
      </span>
    </div>
  );
}

type SidebarProps = {
  revendaInfo: { nome: string; logo_url: string | null } | null;
  persona: Persona;
  route: string;
  setRoute: (r: string) => void;
  isMobile: boolean;
  drawerOpen: boolean;
};

function Sidebar({ persona, route, setRoute, drawerOpen, revendaInfo }: SidebarProps) {
  const { signOut } = useAuth();
  const items = NAV[persona];
  const labels: Record<Persona, string> = { rep: "Vendas", coord: "Gestão da equipe", adv: "Jurídico", admin: "Administração" };
  return (
    <aside
      className={`sidebar-drawer${drawerOpen ? " is-open" : ""}`}
      style={{
        background: "var(--surface)",
        borderRight: "1px solid var(--line)",
        display: "flex", flexDirection: "column",
        overflow: "auto", height: "100vh",
      }}>
      <div style={{ padding: "14px 16px", minHeight: 62, display: "flex", alignItems: "center", borderBottom: "1px solid var(--line)" }}>
        {revendaInfo?.logo_url ? (
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            <img src={revendaInfo.logo_url} alt={revendaInfo.nome} style={{ height: 30, maxWidth: 120, objectFit: "contain" }} />
            <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--ink-4)" }}>Advox</span>
          </div>
        ) : <Wordmark subtitulo={revendaInfo?.nome ?? "CRM Telecom"} />}
      </div>

      <div style={{ padding: "18px 18px 6px", fontSize: 10.5, color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: "0.09em", fontWeight: 600 }}>
        {labels[persona]}
      </div>
      <nav style={{ padding: "0 10px 12px", display: "flex", flexDirection: "column", gap: 2 }}>
        {items.map(it => {
          const active = route === it.id;
          return (
            <button key={it.id} onClick={() => setRoute(it.id)} className={active ? undefined : "nav-item"} style={{
              position: "relative",
              display: "flex", alignItems: "center", gap: 10,
              padding: "9px 12px",
              fontSize: 13.5, fontWeight: active ? 600 : 500,
              background: active ? "var(--navy-soft)" : "transparent",
              border: 0,
              color: active ? "var(--navy)" : "var(--ink-2)",
              borderRadius: 8, cursor: "pointer", textAlign: "left",
            }}>
              {active && <span style={{ position: "absolute", left: -10, top: 8, bottom: 8, width: 3, borderRadius: "0 3px 3px 0", background: "var(--navy)" }} />}
              <span style={{ color: active ? "var(--navy)" : "var(--ink-3)", display: "inline-flex" }}>{it.icon}</span>
              <span style={{ flex: 1 }}>{it.label}</span>
              {it.badge && (
                <span style={{
                  fontSize: 10.5, fontWeight: 600,
                  background: active ? "var(--navy)" : "var(--surface-3)", color: active ? "var(--navy-ink)" : "var(--ink-3)",
                  padding: "1px 7px", borderRadius: 99,
                }}>{it.badge}</span>
              )}
            </button>
          );
        })}
      </nav>

      <div style={{ marginTop: "auto", padding: "12px 16px", borderTop: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--ink-4)" }}>
          <span style={{ width: 6, height: 6, borderRadius: 99, background: "var(--green)" }} /> Advox · online
        </span>
        <button onClick={signOut} className="nav-item" style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          background: "transparent", border: 0, borderRadius: 6,
          color: "var(--ink-3)", fontSize: 12, cursor: "pointer", padding: "5px 8px",
        }}>
          <Ic.Logout size={13} /> Sair
        </button>
      </div>
    </aside>
  );
}
