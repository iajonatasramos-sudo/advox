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
import { PerfilScreen, NotifPanel, RepOnboarding, ErrorScreen } from "./shared";
import {
  USERS, PIPELINE_COMERCIAL, PIPELINE_JURIDICO,
  type Persona, type Representante, type User as MockUser,
} from "./data";
import { useLiveNotificacoes, useRevendaInfo, useApplyRevendaTheme, type UiLead as Lead, type UiCaso as Caso } from "./lib/data-live";
import { useAuth, AuthGate, PendingApproval, AuthLoading, ProfileErrorScreen, type Profile } from "./auth";

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
    { id: "tarefas",    label: "Tarefas",         icon: <Ic.Check size={14} />,    badge: "3" },
    { id: "casos",      label: "Casos Jurídicos", icon: <Ic.Scale size={14} />,    badge: "7" },
    { id: "onboarding", label: "Onboarding",      icon: <Ic.Sparkles size={14} />, sub: "estado vazio" },
    { id: "404",        label: "Erro 404",        icon: <Ic.Warn size={14} />,    sub: "tela auxiliar" },
  ],
  coord: [
    { id: "dashboard", label: "Painel",            icon: <Ic.Dashboard size={14} /> },
    { id: "time",      label: "Meu Time",          icon: <Ic.Users size={14} />,    badge: "3" },
    { id: "leads",     label: "Leads da Equipe",   icon: <Ic.Briefcase size={14} /> },
    { id: "casos",     label: "Casos da Equipe",   icon: <Ic.Scale size={14} /> },
    { id: "tarefas",   label: "Tarefas da Equipe", icon: <Ic.Check size={14} /> },
  ],
  adv: [
    { id: "dashboard", label: "Painel",  icon: <Ic.Dashboard size={14} /> },
    { id: "prazos",    label: "Prazos",  icon: <Ic.Calendar size={14} />, badge: "2" },
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
  const { loading, session, profile, profileError } = useAuth();

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
    revenda: profile.revenda_id ? (USERS[persona].revenda ?? "—") : undefined,
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
      if (route === "onboarding") return <RepOnboarding onOpenDesbloq={() => setModal(true)} />;
      if (route === "404")        return <ErrorScreen code={404} onBack={() => setRoute("dashboard")} />;
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
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: "var(--bg)" }}>
      {(persona === "rep" || persona === "coord") && <DesbloquearTopbar onOpen={() => setModal(true)} />}

      <Topbar
        user={user}
        persona={persona}
        revendaInfo={revendaInfo}
        onOpenNotif={() => setShowNotif(true)}
        onOpenPerfil={() => setRoute("perfil")}
        onToggleDrawer={() => setDrawerOpen(o => !o)}
        isMobile={isMobile}
      />

      <div style={{
        display: "grid",
        gridTemplateColumns: isMobile ? "1fr" : "232px 1fr",
        flex: 1, minHeight: 0,
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
        />
        <main style={{ overflow: "auto", background: "var(--bg)" }}>
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

function Topbar({ user, persona, revendaInfo, onOpenNotif, onOpenPerfil, onToggleDrawer, isMobile }: TopbarProps) {
  const { signOut, profile } = useAuth();
  const personaInfo = PERSONA_BADGE[persona];
  const { items: notifs } = useLiveNotificacoes(profile?.id);
  const unread = (notifs ?? []).filter(n => !n.lida).length;
  return (
    <div className="topbar" style={{
      display: "flex", alignItems: "center", gap: 14,
      padding: "10px 18px",
      background: "var(--surface)", borderBottom: "1px solid var(--line)",
      flexShrink: 0,
    }}>
      {isMobile && (
        <button
          onClick={onToggleDrawer}
          aria-label="Abrir menu"
          style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            background: "transparent", border: "1px solid var(--line)",
            borderRadius: 5, padding: 6, cursor: "pointer",
            color: "var(--ink-2)",
          }}
        >
          <Ic.List size={16} />
        </button>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
        <Wordmark />
        <span className="only-desktop">
          <Badge bg="var(--surface-3)" border="var(--line)" color="var(--ink-3)" style={{ marginLeft: 2 }}>v2.4.1</Badge>
        </span>
      </div>

      <div className="topbar-search" style={{ marginLeft: 12, flex: 1, maxWidth: 460 }}>
        <Input full icon={<Ic.Search size={13} />} placeholder="Buscar leads, casos, clientes, documentos…" value="" onChange={()=>{}} />
      </div>

      {revendaInfo && (
        <div className="only-desktop" style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          padding: "4px 12px",
          background: "var(--surface-3)", border: "1px solid var(--line)",
          borderRadius: 6, minHeight: 32,
          flexShrink: 0,
        }} title={revendaInfo.nome}>
          {revendaInfo.logo_url ? (
            <img src={revendaInfo.logo_url} alt={revendaInfo.nome} style={{ height: 22, width: "auto", maxWidth: 110, objectFit: "contain" }} />
          ) : (
            <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink)", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {revendaInfo.nome}
            </span>
          )}
        </div>
      )}

      <div className="topbar-actions" style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        <div className="only-desktop" style={{
          display: "inline-flex", alignItems: "center", gap: 5,
          padding: "4px 10px", fontSize: 11.5, fontWeight: 500,
          background: "var(--surface-3)", color: "var(--ink-2)",
          border: "1px solid var(--line)",
          borderRadius: 6,
        }}>{personaInfo.icon}{personaInfo.label}</div>

        <button onClick={onOpenNotif} className="topbar-icon-btn" style={{
          background: "transparent", border: "1px solid var(--line)",
          borderRadius: 5, padding: "6px 8px", position: "relative",
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
          background: "transparent", border: "1px solid var(--line)",
          borderRadius: 5, padding: "4px 8px 4px 4px", cursor: "pointer",
          flexShrink: 0,
        }}>
          <Avatar name={user.nome} size={24} />
          <div className="only-desktop" style={{ textAlign: "left" }}>
            <div style={{ fontSize: 12, fontWeight: 500 }}>{user.nome}</div>
            <div style={{ fontSize: 10.5, color: "var(--ink-3)" }}>{user.papel}</div>
          </div>
          <span className="only-desktop"><Ic.ChevronDown size={12} color="var(--ink-4)" /></span>
        </button>

        <button onClick={signOut} className="topbar-icon-btn" title="Sair" style={{
          background: "transparent", border: "1px solid var(--line)",
          borderRadius: 5, padding: "6px 8px",
          color: "var(--ink-2)", cursor: "pointer", flexShrink: 0,
        }}>
          <Ic.Logout size={14} />
        </button>
      </div>
    </div>
  );
}

function Wordmark() {
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <span style={{
        width: 26, height: 26, borderRadius: 5,
        background: "var(--navy)", color: "var(--navy-ink)",
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        position: "relative",
        boxShadow: "inset 0 -1px 0 oklch(0.18 0.07 255)",
      }}>
        <Ic.Scale size={14} />
        <span style={{
          position: "absolute", bottom: -2, right: -2,
          width: 8, height: 8, borderRadius: 99,
          background: "var(--gold)",
          border: "1.5px solid var(--surface)",
        }} />
      </span>
      <span style={{ fontSize: 16, fontWeight: 600, letterSpacing: "-0.015em", color: "var(--ink)" }}>
        Advox <span className="only-desktop" style={{ color: "var(--ink-3)", fontWeight: 400 }}>Telecom</span>
      </span>
    </div>
  );
}

type SidebarProps = {
  persona: Persona;
  route: string;
  setRoute: (r: string) => void;
  isMobile: boolean;
  drawerOpen: boolean;
};

function Sidebar({ persona, route, setRoute, isMobile, drawerOpen }: SidebarProps) {
  const items = NAV[persona];
  const labels: Record<Persona, string> = { rep: "Representante", coord: "Coordenador", adv: "Advogado", admin: "Administrador" };
  return (
    <aside
      className={`sidebar-drawer${drawerOpen ? " is-open" : ""}`}
      style={{
        background: "var(--surface)",
        borderRight: "1px solid var(--line)",
        display: "flex",
        flexDirection: "column",
        overflow: "auto",
      }}>
      <div style={{ padding: "12px 14px 8px", display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 10.5, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600 }}>
          {labels[persona]}
        </span>
        <span style={{ height: 1, flex: 1, background: "var(--line)" }} />
      </div>
      <nav style={{ padding: "2px 10px 12px", display: "flex", flexDirection: "column", gap: 1 }}>
        {items.map(it => {
          const active = route === it.id;
          return (
            <button key={it.id} onClick={() => setRoute(it.id)} style={{
              display: "flex", alignItems: "center", gap: 9,
              padding: "7px 9px",
              fontSize: 12.5, fontWeight: 500,
              background: active ? "var(--surface-3)" : "transparent",
              border: active ? "1px solid var(--line-2)" : "1px solid transparent",
              color: active ? "var(--ink)" : "var(--ink-2)",
              borderRadius: 5, cursor: "pointer", textAlign: "left",
            }}
              onMouseEnter={e => { if (!active) e.currentTarget.style.background = "var(--hover)"; }}
              onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent"; }}>
              <span style={{ color: active ? "var(--ink)" : "var(--ink-3)" }}>{it.icon}</span>
              <span style={{ flex: 1 }}>{it.label}</span>
              {it.badge && (
                <span style={{
                  fontSize: 10.5, fontWeight: 500,
                  background: "var(--surface-3)", color: "var(--ink-3)",
                  padding: "1px 6px", borderRadius: 99,
                  border: "1px solid var(--line)",
                }}>{it.badge}</span>
              )}
              {it.sub && (
                <span style={{ fontSize: 10, color: "var(--ink-4)" }}>{it.sub}</span>
              )}
            </button>
          );
        })}
      </nav>

      <div style={{ padding: "12px 14px 8px", display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 10.5, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600 }}>
          Pipeline {persona === "adv" ? "Jurídico" : "Comercial"}
        </span>
        <span style={{ height: 1, flex: 1, background: "var(--line)" }} />
      </div>
      <div style={{ padding: "0 14px 14px", display: "flex", flexDirection: "column", gap: 4, fontSize: 11.5 }}>
        {(persona === "adv" ? PIPELINE_JURIDICO.slice(0, 9) : PIPELINE_COMERCIAL).map(s => (
          <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "2px 0" }}>
            <span style={{ width: 6, height: 6, borderRadius: 99, background: s.color, flexShrink: 0 }} />
            <span style={{ color: "var(--ink-2)" }}>{s.label}</span>
          </div>
        ))}
      </div>

      <div style={{ marginTop: "auto", padding: "12px 14px", borderTop: "1px solid var(--line)" }}>
        <button style={{
          display: "inline-flex", alignItems: "center", gap: 7,
          background: "transparent", border: 0,
          color: "var(--ink-3)", fontSize: 12, cursor: "pointer", padding: "4px 0",
        }}>
          <Ic.Logout size={13} /> Sair
        </button>
        <div style={{ fontSize: 10.5, color: "var(--ink-4)", marginTop: 6, lineHeight: 1.5 }}>
          Advox v2.4.1 — Use o seletor de persona acima para alternar entre fluxos.
        </div>
      </div>
    </aside>
  );
}
