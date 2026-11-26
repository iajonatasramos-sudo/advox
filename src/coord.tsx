import React, { useEffect, useState } from "react";
import { Ic } from "./icons";
import {
  Btn, Badge, StatusPill, Avatar, KPI, Input, OperadoraTag, Section, Empty, Funil,
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
export function CoordDashboard({ onOpenLead, onIr }: { onOpenLead: (l: UiLead) => void; onIr?: (rota: string) => void }) {
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

  const lista = leads ?? [];
  const tarefasAtrasadas = (tarefas ?? []).filter(t => t.urgencia === "atrasada" && !t.completed);
  const abertos = lista.filter(l => !["fechado", "perdido"].includes(l.status));
  const emAberto = abertos.reduce((s, l) => s + Number(l.valor || 0), 0);
  const inicioMes = new Date(); inicioMes.setDate(1); inicioMes.setHours(0, 0, 0, 0);
  const fechadosMes = lista.filter(l => l.status === "fechado" && new Date(l.updated_at ?? l.created_at) >= inicioMes);
  const valorMes = fechadosMes.reduce((s, l) => s + Number(l.valor || 0), 0);
  const noJuridico = (casos ?? []).filter(c => !["liberado", "naoliberado", "recusou"].includes(c.status)).length;
  const pendentes = (team ?? []).filter(t => t.status === "pendente").length;
  const ativosTime = (team ?? []).filter(t => t.status === "ativo");

  const porConsultor = ativosTime
    .map(r => {
      const repLeads = lista.filter(l => l.rep?.id === r.id || l.rep?.nome === r.nome);
      const fech = repLeads.filter(l => l.status === "fechado");
      return {
        rep: r,
        abertos: repLeads.filter(l => !["fechado", "perdido"].includes(l.status)).length,
        fechados: fech.length,
        valor: fech.reduce((s, l) => s + Number(l.valor || 0), 0),
        atrasadas: tarefasAtrasadas.filter(t => t.autor_id === r.id).length,
      };
    })
    .sort((a, b) => b.valor - a.valor || b.abertos - a.abertos);

  const { info: revendaInfo } = useRevendaInfo(revendaId);
  const [showBranding, setShowBranding] = useState(false);
  const hojeTxt = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
  const hoje = hojeTxt.charAt(0).toUpperCase() + hojeTxt.slice(1);

  const pendencias: { texto: string; tom: string; acao?: { rotulo: string; rota: string } }[] = [];
  if (tarefasAtrasadas.length) pendencias.push({ texto: `${tarefasAtrasadas.length} ${tarefasAtrasadas.length === 1 ? "tarefa atrasada" : "tarefas atrasadas"} no time`, tom: "var(--rose)", acao: { rotulo: "Ver tarefas", rota: "tarefas" } });
  if (pendentes) pendencias.push({ texto: `${pendentes} ${pendentes === 1 ? "consultor esperando" : "consultores esperando"} aprovação`, tom: "var(--amber)", acao: { rotulo: "Aprovar", rota: "time" } });
  const parados = abertos.filter(l => !l.proximo).length;
  if (parados) pendencias.push({ texto: `${parados} ${parados === 1 ? "lead sem próximo passo" : "leads sem próximo passo"}`, tom: "var(--ink-4)", acao: { rotulo: "Ver leads", rota: "leads" } });

  return (
    <div className="page-pad" style={{ padding: "22px 24px", display: "flex", flexDirection: "column", gap: 16, maxWidth: 1240 }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 className="page-title" style={{ margin: 0, fontSize: 28, fontWeight: 600 }}>{revendaNome ?? "Sua revenda"}</h1>
          <div style={{ fontSize: 14, color: "var(--ink-3)", marginTop: 2 }}>{hoje}</div>
        </div>
        {revendaInfo && profile?.papel === "proprietario" && (
          <Btn variant="default" size="sm" icon={<Ic.Settings size={13} />} onClick={() => setShowBranding(true)}>
            Logo e cor da revenda
          </Btn>
        )}
      </div>

      <section style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 10, padding: "18px 20px", display: "flex", flexDirection: "column", gap: 18 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "14px 40px", alignItems: "baseline" }}>
          <div>
            <div style={{ fontSize: 14, color: "var(--ink-3)" }}>Em negociação</div>
            <div className="titulo mono" style={{ fontSize: 40, fontWeight: 600, lineHeight: 1.1 }}>{fmtBRL(emAberto)}</div>
            <div style={{ fontSize: 13, color: "var(--ink-3)" }}>{abertos.length} {abertos.length === 1 ? "lead aberto" : "leads abertos"}</div>
          </div>
          <div>
            <div style={{ fontSize: 14, color: "var(--ink-3)" }}>Fechado em {new Date().toLocaleDateString("pt-BR", { month: "long" })}</div>
            <div className="titulo mono" style={{ fontSize: 28, fontWeight: 600, lineHeight: 1.1, color: valorMes ? "var(--green)" : "var(--ink)" }}>{fmtBRL(valorMes)}</div>
            <div style={{ fontSize: 13, color: "var(--ink-3)" }}>{fechadosMes.length} {fechadosMes.length === 1 ? "contrato" : "contratos"}</div>
          </div>
          <div>
            <div style={{ fontSize: 14, color: "var(--ink-3)" }}>No jurídico</div>
            <div className="titulo mono" style={{ fontSize: 28, fontWeight: 600, lineHeight: 1.1 }}>{noJuridico}</div>
            <div style={{ fontSize: 13, color: "var(--ink-3)" }}>{noJuridico === 1 ? "cliente sendo desbloqueado" : "clientes sendo desbloqueados"}</div>
          </div>
        </div>
        <Funil leads={lista} onEtapa={onIr ? () => onIr("leads") : undefined} />
      </section>

      <div className="grid-2col" style={{ display: "grid", gridTemplateColumns: "minmax(0, 3fr) minmax(0, 2fr)", gap: 16, alignItems: "start" }}>
        <Section title="Consultores" subtitle="Quem mais fechou aparece primeiro" noPad>
          {porConsultor.length === 0 ? (
            <Empty icon={<Ic.Users size={18} />} title="Nenhum consultor ativo" hint="Convide consultores em Meu time." />
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--line)" }}>
                  {["Consultor", "Abertos", "Fechados", "Valor fechado"].map((h, i) => (
                    <th key={h} style={{ textAlign: i === 0 ? "left" : "right", padding: "10px 16px", fontWeight: 500, color: "var(--ink-3)", fontSize: 13 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {porConsultor.map((r, i) => (
                  <tr key={r.rep.id} style={{ borderBottom: i < porConsultor.length - 1 ? "1px solid var(--line)" : 0 }}>
                    <td style={{ padding: "11px 16px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                        <Avatar name={r.rep.nome} size={30} />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.rep.nome}</div>
                          {r.atrasadas > 0
                            ? <div style={{ fontSize: 13, color: "var(--rose)" }}>{r.atrasadas} {r.atrasadas === 1 ? "tarefa atrasada" : "tarefas atrasadas"}</div>
                            : r.rep.cidade && <div style={{ fontSize: 13, color: "var(--ink-3)" }}>{r.rep.cidade}{r.rep.uf ? `/${r.rep.uf}` : ""}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="mono" style={{ padding: "11px 16px", textAlign: "right" }}>{r.abertos}</td>
                    <td className="mono" style={{ padding: "11px 16px", textAlign: "right" }}>{r.fechados}</td>
                    <td className="mono" style={{ padding: "11px 16px", textAlign: "right", fontWeight: 600 }}>{fmtBRL(r.valor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>

        <Section title="Pede sua atenção" noPad>
          {pendencias.length === 0 ? (
            <div style={{ padding: "16px 18px", fontSize: 14, color: "var(--ink-3)" }}>Tudo em dia no time.</div>
          ) : pendencias.map((p, i) => (
            <div key={p.texto} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderBottom: i < pendencias.length - 1 ? "1px solid var(--line)" : 0 }}>
              <span style={{ width: 4, alignSelf: "stretch", borderRadius: 2, background: p.tom }} />
              <span style={{ flex: 1, fontSize: 14, fontWeight: 500 }}>{p.texto}</span>
              {p.acao && onIr && <Btn size="sm" variant="ghost" onClick={() => onIr(p.acao!.rota)}>{p.acao.rotulo}</Btn>}
            </div>
          ))}
        </Section>
      </div>

      <Section title="Últimos leads do time" right={onIr && <Btn size="sm" variant="ghost" onClick={() => onIr("leads")}>Ver todos</Btn>} noPad>
        <RepLista filter="" onOpenLead={onOpenLead} leads={lista.slice(0, 6)} semMoldura />
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
          <h1 className="page-title" style={{ margin: 0, fontSize: 26, fontWeight: 600 }}>
            {focusRep ? `Leads de ${focusRep}` : "Leads da equipe"}
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
        <h1 className="page-title" style={{ margin: 0, fontSize: 26, fontWeight: 600 }}>Leads no jurídico</h1>
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
          <Empty icon={<Ic.Scale size={20} />} title="Nenhum caso ainda" hint="Quando alguém do time usar Desbloquear cliente num lead, o caso aparece aqui." />
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: "var(--surface-2)", borderBottom: "1px solid var(--line)" }}>
                {["Cliente", "Etapa", "Advogado", "Multa", ""].map(h => (
                  <th key={h} style={{ textAlign: "left", padding: "9px 12px", fontWeight: 500, color: "var(--ink-3)", fontSize: 13 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {all.map(c => {
                const lead = (leads ?? []).find(l => l.id === c.lead_id);
                return (
                  <tr key={c.id} onClick={() => lead && onOpenLead(lead)} style={{ borderBottom: "1px solid var(--line)", cursor: lead ? "pointer" : "default" }}
                    onMouseEnter={e=>e.currentTarget.style.background="var(--hover)"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
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
    { id: "atrasada", label: "Atrasadas", color: "var(--rose)" },
    { id: "hoje", label: "Para hoje", color: "var(--amber)" },
    { id: "semana", label: "Esta semana", color: "var(--navy)" },
    { id: "proxima", label: "Próximas", color: "var(--ink-3)" },
  ] as const;
  return (
    <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 16 }}>
      <header>
        <h1 className="page-title" style={{ margin: 0, fontSize: 26, fontWeight: 600 }}>Tarefas da equipe</h1>
        <div style={{ fontSize: 13, color: "var(--ink-3)", marginTop: 4 }}>
          {tarefas === null ? "Carregando…" : `${(tarefas ?? []).length} tarefas, ${(tarefas ?? []).filter(t => t.urgencia === "atrasada" && !t.completed).length} atrasadas`}
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
