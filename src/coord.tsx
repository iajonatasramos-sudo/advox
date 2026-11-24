import React, { useEffect, useState } from "react";
import { Ic } from "./icons";
import {
  Btn, Badge, StatusPill, Avatar, KPI, Input, OperadoraTag, Section, Empty,
} from "./ui";
import { RepKanban, RepLista, TarefaRowLive } from "./rep";
import { useAuth } from "./auth";
import { supabase } from "./lib/supabase";
import type { ContaStatus } from "./lib/database.types";
import {
  useLiveLeads, useLiveCasos, useLiveTarefas, fmtBRL, PIPELINE_JURIDICO_DB,
  readLiveCache, writeLiveCache, useRevendaInfo,
  type UiLead,
} from "./lib/data-live";
import { BrandingModal } from "./branding-modal";

/* === Tipo do rep no time (do Supabase) === */
type TeamRepRow = {
  id: string;
  nome: string;
  email: string;
  status: ContaStatus;
  cidade: string | null;
  uf: string | null;
  whats: string | null;
  created_at: string;
};

const STATUS_LABEL: Record<ContaStatus, string> = {
  ativo: "Ativo", pendente: "Pendente", suspenso: "Suspenso", recusado: "Recusado",
};
const STATUS_COLOR: Record<ContaStatus, string> = {
  ativo: "var(--green)", pendente: "var(--amber)", suspenso: "var(--rose)", recusado: "var(--ink-3)",
};

/* === Helper: nome da revenda do coord === */
function useRevendaNome(revendaId: string | null | undefined) {
  const [nome, setNome] = useState<string | null>(null);
  useEffect(() => {
    if (!revendaId) { setNome(null); return; }
    supabase.from("revendas").select("nome").eq("id", revendaId).maybeSingle().then(({ data }) => {
      const row = data as { nome: string } | null;
      setNome(row?.nome ?? null);
    });
  }, [revendaId]);
  return nome;
}

/* === Dashboard === */
export function CoordDashboard({ onOpenLead }: { onOpenLead: (l: UiLead) => void }) {
  const { profile } = useAuth();
  const revendaId = profile?.revenda_id ?? undefined;
  const revendaNome = useRevendaNome(revendaId);
  const { leads } = useLiveLeads({});
  const { casos } = useLiveCasos({});
  const { tarefas } = useLiveTarefas({});

  const teamCacheKey = `coord-team:${revendaId ?? "none"}`;
  const [team, setTeam] = useState<TeamRepRow[] | null>(() => readLiveCache<TeamRepRow[]>(teamCacheKey));
  useEffect(() => {
    // O banco já limita ao time de quem está vendo (coordenador, gerente ou proprietário).
    supabase.from("profiles")
      .select("id, nome, email, status, cidade, uf, whats, created_at")
      .eq("papel", "rep")
      .then(({ data }) => {
        const next = (data ?? []) as unknown as TeamRepRow[];
        writeLiveCache(teamCacheKey, next);
        setTeam(next);
      });
  }, [revendaId, leads?.length, teamCacheKey]);

  const tarefasAtrasadas = (tarefas ?? []).filter(t => t.urgencia === "atrasada" && !t.completed);
  const ativos = (leads ?? []).filter(l => !["fechado","perdido"].includes(l.status)).length;
  const fechados = (leads ?? []).filter(l => l.status === "fechado");
  const valor = fechados.reduce((s, l) => s + Number(l.valor || 0), 0);
  const conversao = (leads?.length ?? 0) > 0 ? Math.round((fechados.length / (leads?.length ?? 1)) * 100) : 0;

  // Ranking por valor fechado
  const ranking = (team ?? [])
    .filter(r => r.status === "ativo")
    .map(r => {
      const repLeads = (leads ?? []).filter(l => l.rep?.nome === r.nome || l.rep?.id === r.id);
      const fech = repLeads.filter(l => l.status === "fechado");
      const v = fech.reduce((s, l) => s + Number(l.valor || 0), 0);
      const ativosR = repLeads.filter(l => !["fechado","perdido"].includes(l.status)).length;
      const conv = repLeads.length ? Math.round((fech.length / repLeads.length) * 100) : 0;
      return { rep: r, ativos: ativosR, fechados: fech.length, valor: v, conv };
    })
    .sort((a, b) => b.valor - a.valor);

  const { info: revendaInfo } = useRevendaInfo(revendaId);
  const [showBranding, setShowBranding] = useState(false);

  return (
    <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 14, gap: 12 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, letterSpacing: "-0.015em" }}>
              Bom dia{profile?.nome ? `, ${profile.nome.split(" ")[0]}` : ""}.
            </h1>
            <div style={{ fontSize: 13, color: "var(--ink-3)", marginTop: 4 }}>
              <strong style={{ color: "var(--ink)" }}>{revendaNome ?? "sua revenda"}</strong> · {(team ?? []).filter(t => t.status === "ativo").length} consultores ativos · {leads?.length ?? 0} leads
              {tarefasAtrasadas.length > 0 && <> · <strong style={{ color: "var(--rose)" }}>{tarefasAtrasadas.length} tarefas atrasadas</strong></>}
            </div>
          </div>
          {revendaInfo && profile?.papel === "proprietario" && (
            <Btn variant="default" size="sm" icon={<Ic.Settings size={13} />} onClick={() => setShowBranding(true)}>
              Branding da revenda
            </Btn>
          )}
        </div>
        <div className="grid-kpi" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
          <KPI label="Leads ativos do time" valor={String(ativos)} delta={`${leads?.length ?? 0} no total`} trend="neutral" icon={<Ic.Briefcase size={14} />} />
          <KPI label="Fechados no mês" valor={String(fechados.length)} delta={fmtBRL(valor)} trend={fechados.length > 0 ? "up" : "neutral"} icon={<Ic.Money size={14} />} />
          <KPI label="Conversão média" valor={`${conversao}%`} delta="leads → fechados" trend={conversao >= 30 ? "up" : "neutral"} icon={<Ic.Spark size={14} />} />
          <KPI label="Casos no Advox" valor={String(casos?.length ?? 0)} delta={`${(casos ?? []).filter(c => c.status === "liberado").length} liberados`} trend="neutral" icon={<Ic.Scale size={14} />} />
        </div>
      </div>

      <div className="grid-2col" style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 14 }}>
        <Section title="Ranking do time" subtitle="ordenado por valor fechado" noPad>
          {ranking.length === 0 ? (
            <Empty icon={<Ic.Users size={18} />} title="Sem ranking ainda" hint="Quando consultores ativos tiverem leads fechados, aparecem aqui." />
          ) : ranking.map((r, i) => (
            <div key={r.rep.id} style={{
              display: "grid",
              gridTemplateColumns: "32px 1fr 80px 80px 80px 110px 24px",
              gap: 12, alignItems: "center",
              padding: "12px 16px",
              borderBottom: i < ranking.length - 1 ? "1px solid var(--line)" : 0,
              fontSize: 12.5,
            }}>
              <span className="mono" style={{ fontSize: 13, fontWeight: 600, color: i === 0 ? "var(--gold-deep)" : "var(--ink-3)" }}>
                #{i + 1}
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
                <Avatar name={r.rep.nome} size={28} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 500, color: "var(--ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.rep.nome}</div>
                  <div style={{ fontSize: 11, color: "var(--ink-4)" }}>{r.rep.cidade}{r.rep.uf ? `/${r.rep.uf}` : ""}</div>
                </div>
              </div>
              <div><div className="mono" style={{ fontWeight: 600 }}>{r.ativos}</div><div style={{ fontSize: 10, color: "var(--ink-4)", textTransform: "uppercase" }}>ativos</div></div>
              <div><div className="mono" style={{ fontWeight: 600 }}>{r.fechados}</div><div style={{ fontSize: 10, color: "var(--ink-4)", textTransform: "uppercase" }}>fechados</div></div>
              <div><div className="mono" style={{ fontWeight: 600, color: r.conv >= 30 ? "var(--green)" : "var(--ink-2)" }}>{r.conv}%</div><div style={{ fontSize: 10, color: "var(--ink-4)", textTransform: "uppercase" }}>conv.</div></div>
              <div className="mono" style={{ fontWeight: 600, textAlign: "right" }}>{fmtBRL(r.valor)}</div>
              <Ic.Chevron size={13} color="var(--ink-4)" />
            </div>
          ))}
        </Section>

        <Section title="Atenção" subtitle="o que precisa de você hoje" noPad>
          <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--line)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <span style={{ width: 8, height: 8, borderRadius: 99, background: "var(--rose)" }} />
              <span style={{ fontSize: 12.5, fontWeight: 600 }}>{tarefasAtrasadas.length} tarefas atrasadas</span>
            </div>
            <div style={{ fontSize: 11.5, color: "var(--ink-3)", marginLeft: 16 }}>
              Acumuladas pelos consultores do time
            </div>
          </div>
          <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--line)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <span style={{ width: 8, height: 8, borderRadius: 99, background: "var(--amber)" }} />
              <span style={{ fontSize: 12.5, fontWeight: 600 }}>{(team ?? []).filter(t => t.status === "pendente").length} aprovações pendentes</span>
            </div>
            <div style={{ fontSize: 11.5, color: "var(--ink-3)", marginLeft: 16 }}>
              Consultores aguardando aprovação
            </div>
          </div>
        </Section>
      </div>

      <Section title="Leads recentes do time" noPad>
        <RepLista filter="" onOpenLead={onOpenLead} leads={(leads ?? []).slice(0, 6)} />
      </Section>

      {showBranding && revendaInfo && (
        <BrandingModal
          revendaId={revendaInfo.id}
          revendaNome={revendaInfo.nome}
          logoUrl={revendaInfo.logo_url}
          corPrimaria={revendaInfo.cor_primaria}
          onClose={() => setShowBranding(false)}
        />
      )}
    </div>
  );
}

/* === Pipeline do time === */
export function CoordLeads({ onOpenLead, focusRep, onClearFocus }: {
  onOpenLead: (l: UiLead) => void;
  focusRep?: string;
  onClearFocus?: () => void;
}) {
  const { profile } = useAuth();
  const [view, setView] = useState<"kanban" | "lista">("kanban");
  const [filter, setFilter] = useState("");
  const [selectedRep, setSelectedRep] = useState<string>(focusRep || "Todos");
  const { leads } = useLiveLeads({});

  const reps = Array.from(new Set((leads ?? []).map(l => l.rep?.nome).filter(Boolean) as string[])).sort();
  const filtered = selectedRep === "Todos" ? (leads ?? []) : (leads ?? []).filter(l => l.rep?.nome === selectedRep);

  return (
    <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 16 }}>
      <header style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, letterSpacing: "-0.015em" }}>
            Leads da Equipe
            {focusRep && <span style={{ fontSize: 14, color: "var(--ink-3)", fontWeight: 400, marginLeft: 10 }}>· pipeline de {focusRep}</span>}
          </h1>
          <div style={{ fontSize: 13, color: "var(--ink-3)", marginTop: 4 }}>
            {leads === null ? "Carregando…" : `${filtered.length} leads ${selectedRep !== "Todos" ? `com ${selectedRep}` : `de ${reps.length} consultores`}`}
          </div>
        </div>
        {focusRep && onClearFocus && (
          <Btn variant="soft" size="sm" icon={<Ic.X size={12} />} onClick={onClearFocus}>Ver todo o time</Btn>
        )}
      </header>

      <div className="toolbar-row" style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "10px 12px",
        background: "var(--surface)", border: "1px solid var(--line)",
        borderRadius: 6,
      }}>
        <div className="seg-rola" style={{ display: "inline-flex", background: "var(--surface-3)", border: "1px solid var(--line)", borderRadius: 5, padding: 2 }}>
          {([["kanban", <Ic.Kanban size={13} />, "Kanban"], ["lista", <Ic.List size={13} />, "Lista"]] as const).map(([id, ic, l]) => (
            <button key={id} onClick={() => setView(id as "kanban" | "lista")} style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "5px 10px", fontSize: 12, fontWeight: 500,
              background: view === id ? "var(--surface)" : "transparent",
              border: 0, borderRadius: 4,
              color: view === id ? "var(--ink)" : "var(--ink-3)",
              boxShadow: view === id ? "var(--shadow-sm)" : "none",
              cursor: "pointer",
            }}>{ic}{l}</button>
          ))}
        </div>
        <Input icon={<Ic.Search size={13} />} placeholder="Buscar empresa, contato…" value={filter} onChange={e=>setFilter(e.target.value)} style={{ minWidth: 280 }} />
        <div style={{ display: "inline-flex", background: "var(--surface-3)", border: "1px solid var(--line)", borderRadius: 5, padding: 2, flexWrap: "wrap" }}>
          {["Todos", ...reps].map(r => (
            <button key={r} onClick={() => setSelectedRep(r)} title={r} style={{
              padding: "4px 9px", fontSize: 11.5, fontWeight: 500, border: 0,
              background: selectedRep === r ? "var(--surface)" : "transparent",
              color: selectedRep === r ? "var(--ink)" : "var(--ink-3)",
              borderRadius: 4, cursor: "pointer",
              boxShadow: selectedRep === r ? "var(--shadow-sm)" : "none",
              whiteSpace: "nowrap",
            }}>
              {r === "Todos" ? "Todos" : r.split(" ")[0]}
            </button>
          ))}
        </div>
      </div>

      {view === "kanban"
        ? <RepKanban filter={filter} onOpenLead={onOpenLead} leads={filtered} />
        : <RepLista filter={filter} onOpenLead={onOpenLead} leads={filtered} />}
    </div>
  );
}

/* === Casos do time === */
export function CoordCasos({ onOpenLead }: { onOpenLead: (l: UiLead) => void }) {
  const { profile } = useAuth();
  const { casos } = useLiveCasos({});
  const { leads } = useLiveLeads({});
  const all = casos ?? [];
  return (
    <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 16 }}>
      <header>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, letterSpacing: "-0.015em" }}>Leads no Jurídico</h1>
        <div style={{ fontSize: 13, color: "var(--ink-3)", marginTop: 4 }}>
          {casos === null ? "Carregando…" : `${all.length} casos da sua revenda no escritório Advox`}
        </div>
      </header>

      <div className="grid-kpi" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        <KPI label="Em análise" valor={String(all.filter(c => c.status === "analise").length)} delta="—" trend="neutral" icon={<Ic.Search size={14} />} />
        <KPI label="Em negociação" valor={String(all.filter(c => ["honorarios","contratou"].includes(c.status)).length)} delta="cliente decidindo" trend="neutral" icon={<Ic.Whats size={14} />} />
        <KPI label="Em execução" valor={String(all.filter(c => ["extrajudicial","judicial","documentacao"].includes(c.status)).length)} delta="judicial / extrajudicial" trend="neutral" icon={<Ic.Scale size={14} />} />
        <KPI label="Liberados" valor={String(all.filter(c => c.status === "liberado").length)} delta="este mês" trend="up" icon={<Ic.CheckCircle size={14} />} />
      </div>

      <Section title="Todos os casos da equipe" noPad>
        {casos === null ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--ink-3)", fontSize: 13 }}>Carregando…</div>
        ) : all.length === 0 ? (
          <Empty icon={<Ic.Scale size={20} />} title="Nenhum caso ainda" hint="Casos aparecem aqui quando consultores do seu time usarem o botão 'Desbloquear Cliente' nos leads." />
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: "var(--surface-2)", borderBottom: "1px solid var(--line)" }}>
                {["Caso", "Cliente", "Status", "Advogado", "Multa", ""].map(h => (
                  <th key={h} style={{ textAlign: "left", padding: "9px 12px", fontWeight: 500, color: "var(--ink-3)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {all.map(c => {
                const lead = (leads ?? []).find(l => l.id === c.lead_id);
                return (
                  <tr key={c.id} onClick={() => lead && onOpenLead(lead)} style={{ borderBottom: "1px solid var(--line)", cursor: lead ? "pointer" : "default" }}
                    onMouseEnter={e=>e.currentTarget.style.background="var(--hover)"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                    <td style={{ padding: "10px 12px" }}><span className="mono" style={{ fontWeight: 500 }}>{c.id.slice(0, 8)}</span></td>
                    <td style={{ padding: "10px 12px" }}>
                      <div style={{ fontWeight: 500 }}>{c.lead?.empresa ?? "—"}</div>
                      <div style={{ fontSize: 11, color: "var(--ink-3)" }}>{c.lead?.contato ?? ""}</div>
                    </td>
                    <td style={{ padding: "10px 12px" }}><StatusPill stage={c.status} pipeline={PIPELINE_JURIDICO_DB} size="sm" /></td>
                    <td style={{ padding: "10px 12px", color: "var(--ink-2)" }}>{c.advogado?.nome ?? "Aguardando"}</td>
                    <td style={{ padding: "10px 12px" }} className="mono">{fmtBRL(Number(c.multa || 0))}</td>
                    <td style={{ padding: "10px 12px", textAlign: "right" }}><Ic.Chevron size={13} color="var(--ink-4)" /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Section>
    </div>
  );
}

/* === Tarefas do time === */
export function CoordTarefas() {
  const { profile } = useAuth();
  const { tarefas } = useLiveTarefas({});
  const groups = [
    { id: "atrasada", label: "Atrasadas — pendentes do time", color: "var(--rose)" },
    { id: "hoje", label: "Para hoje", color: "var(--amber)" },
    { id: "semana", label: "Esta semana", color: "var(--navy)" },
    { id: "proxima", label: "Próximas", color: "var(--ink-3)" },
  ] as const;
  return (
    <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 16 }}>
      <header>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, letterSpacing: "-0.015em" }}>Tarefas da Equipe</h1>
        <div style={{ fontSize: 13, color: "var(--ink-3)", marginTop: 4 }}>
          {tarefas === null ? "Carregando…" : `${(tarefas ?? []).length} tarefas · ${(tarefas ?? []).filter(t => t.urgencia === "atrasada" && !t.completed).length} atrasadas`}
        </div>
      </header>

      {tarefas === null ? (
        <div style={{ padding: 40, textAlign: "center", color: "var(--ink-3)", fontSize: 13 }}>Carregando…</div>
      ) : (tarefas ?? []).length === 0 ? (
        <Section title="Nada por aqui">
          <div style={{ padding: 20, textAlign: "center", color: "var(--ink-3)", fontSize: 12.5 }}>
            Nenhuma tarefa do time ainda.
          </div>
        </Section>
      ) : groups.map(g => {
        const items = (tarefas ?? []).filter(t => t.urgencia === g.id && !t.completed);
        if (!items.length) return null;
        return (
          <Section key={g.id} title={
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 6, height: 6, borderRadius: 99, background: g.color }} />
              {g.label}
              <span style={{ fontSize: 11, color: "var(--ink-4)" }}>{items.length}</span>
            </span>
          } noPad>
            <div>{items.map(t => <TarefaRowLive key={t.id} t={t} />)}</div>
          </Section>
        );
      })}
    </div>
  );
}
