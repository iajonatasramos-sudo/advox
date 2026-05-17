import React, { useEffect, useState } from "react";
import { Ic } from "./icons";
import {
  Btn, Badge, StatusPill, Avatar, KPI, Input, OperadoraTag, Section, Empty, Tabs,
  KV, SidebarBlock, Field, Select,
} from "./ui";
import {
  useLiveLeads, useLiveCasos, useLiveTarefas, updateLead, createLead, toggleTarefa,
  PIPELINE_COMERCIAL_DB, PIPELINE_JURIDICO_DB, fmtBRL, OPERADORAS_LIST,
  type UiLead, type UiCaso, type UiTarefa,
} from "./lib/data-live";
import { useAuth } from "./auth";
import { supabase } from "./lib/supabase";
import type { LeadStatus, Operadora } from "./lib/database.types";
import { DocumentosLista } from "./docs";

export type Lead = UiLead;

const PIPELINE_COMERCIAL = PIPELINE_COMERCIAL_DB;
const PIPELINE_JURIDICO = PIPELINE_JURIDICO_DB;

const STATUS_PILL_LABEL: Record<string, string> = Object.fromEntries(
  [...PIPELINE_COMERCIAL_DB, ...PIPELINE_JURIDICO_DB].map(s => [s.id, s.label])
);

export function RepDashboard({ onOpenLead, onOpenDesbloq }: { onOpenLead: (l: UiLead) => void; onOpenDesbloq: () => void }) {
  const { profile } = useAuth();
  const [view, setView] = useState<"kanban" | "lista">("kanban");
  const [filter, setFilter] = useState("");
  const [showNovo, setShowNovo] = useState(false);
  const { leads, error } = useLiveLeads({ repId: profile?.id });

  const kpiAtivos = (leads ?? []).filter(l => !["fechado","perdido"].includes(l.status)).length;
  const kpiFechados = (leads ?? []).filter(l => l.status === "fechado");
  const kpiValor = kpiFechados.reduce((s, l) => s + Number(l.valor || 0), 0);
  const kpiTravados = (leads ?? []).filter(l => l.status === "travado" || l.status === "aguardando").length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: 18 }}>
      <div>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 14 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, letterSpacing: "-0.015em" }}>
              Bom dia{profile?.nome ? `, ${profile.nome.split(" ")[0]}` : ""}.
            </h1>
            <div style={{ fontSize: 13, color: "var(--ink-3)", marginTop: 4 }}>
              {leads === null ? "Carregando…" :
                <>{kpiAtivos} leads ativos · {kpiTravados} em processo Advox · {kpiFechados.length} fechados no mês</>
              }
            </div>
          </div>
          <div style={{ fontSize: 11.5, color: "var(--ink-3)" }} className="mono">
            {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" })}
          </div>
        </div>
        <div className="grid-kpi" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
          <KPI label="Leads ativos" valor={String(kpiAtivos)} delta={leads ? `${leads.length} no total` : "—"} trend="neutral" icon={<Ic.Briefcase size={14} />} />
          <KPI label="Em processo Advox" valor={String(kpiTravados)} delta="travados + aguardando" trend="neutral" icon={<Ic.Scale size={14} />} />
          <KPI label="Fechados no mês" valor={String(kpiFechados.length)} delta={fmtBRL(kpiValor)} trend={kpiFechados.length > 0 ? "up" : "neutral"} icon={<Ic.Money size={14} />} />
          <KPI label="Pipeline aberto" valor={fmtBRL((leads ?? []).filter(l => !["fechado","perdido"].includes(l.status)).reduce((s, l) => s + Number(l.valor || 0), 0))} delta="valor estimado" trend="neutral" icon={<Ic.Pipeline size={14} />} />
        </div>
      </div>

      {error && (
        <div style={{ background: "var(--rose-soft)", border: "1px solid var(--rose-border)", color: "var(--rose)", padding: "10px 14px", borderRadius: 5, fontSize: 12.5 }}>
          {error}
        </div>
      )}

      <div className="toolbar-row" style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "10px 12px",
        background: "var(--surface)", border: "1px solid var(--line)",
        borderRadius: 6,
      }}>
        <div style={{ display: "inline-flex", background: "var(--surface-3)", border: "1px solid var(--line)", borderRadius: 5, padding: 2 }}>
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
        <Input icon={<Ic.Search size={13} />} placeholder="Buscar por empresa, contato, CNPJ…" value={filter} onChange={e=>setFilter(e.target.value)} style={{ minWidth: 320 }} />
        <div className="toolbar-actions" style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <Btn variant="ghost" size="sm" icon={<Ic.Download size={13} />}>Exportar</Btn>
          <Btn variant="primary" size="sm" icon={<Ic.Plus size={13} />} onClick={() => setShowNovo(true)}>Novo Lead</Btn>
        </div>
      </div>

      {view === "kanban"
        ? <RepKanban filter={filter} onOpenLead={onOpenLead} leads={leads} />
        : <RepLista filter={filter} onOpenLead={onOpenLead} leads={leads} />}

      {showNovo && <NovoLeadModal onClose={() => setShowNovo(false)} />}
    </div>
  );
}

/* === Kanban === */
export function RepKanban({ filter, onOpenLead, leads: leadsProp }: { filter: string; onOpenLead: (l: UiLead) => void; leads?: UiLead[] | null }) {
  const source = leadsProp ?? [];
  const leads = source.filter(l => !filter || (l.empresa + l.contato).toLowerCase().includes(filter.toLowerCase()));
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  const handleDrop = async (newStatus: LeadStatus, leadId: string) => {
    await updateLead(leadId, { status: newStatus });
  };

  if (leadsProp === null) {
    return <div style={{ padding: 40, textAlign: "center", color: "var(--ink-3)", fontSize: 13 }}>Carregando leads…</div>;
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${PIPELINE_COMERCIAL.length}, minmax(260px, 1fr))`, gap: 10, overflowX: "auto", paddingBottom: 4 }}>
      {PIPELINE_COMERCIAL.map(col => {
        const items = leads.filter(l => l.status === col.id);
        const total = items.reduce((s, l) => s + Number(l.valor || 0), 0);
        const isTarget = dropTarget === col.id && dragId !== null;
        return (
          <div
            key={col.id}
            onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }}
            onDragEnter={() => setDropTarget(col.id)}
            onDragLeave={e => {
              if (!(e.currentTarget as HTMLDivElement).contains(e.relatedTarget as Node)) setDropTarget(null);
            }}
            onDrop={e => {
              e.preventDefault();
              const id = e.dataTransfer.getData("text/lead-id");
              if (id) handleDrop(col.id, id);
              setDragId(null);
              setDropTarget(null);
            }}
            style={{
              background: isTarget ? "var(--gold-soft)" : "var(--surface-2)",
              border: `1px ${isTarget ? "dashed" : "solid"} ${isTarget ? "var(--gold-border)" : "var(--line)"}`,
              borderRadius: 6,
              display: "flex", flexDirection: "column",
              minHeight: 400, maxHeight: "calc(100vh - 280px)",
              transition: "background 100ms, border-color 100ms",
            }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderBottom: "1px solid var(--line)" }}>
              <span style={{ width: 6, height: 6, borderRadius: 99, background: col.color }} />
              <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink)" }}>{col.label}</span>
              <span style={{ fontSize: 11, color: "var(--ink-4)", marginLeft: 2 }}>{items.length}</span>
            </div>
            {items.length > 0 && (
              <div style={{ padding: "6px 12px", fontSize: 11, color: "var(--ink-3)", borderBottom: "1px solid var(--line)" }}>
                <span className="mono">{fmtBRL(total)}</span>
              </div>
            )}
            <div style={{ flex: 1, overflowY: "auto", padding: 8, display: "flex", flexDirection: "column", gap: 8 }}>
              {items.map(l => (
                <LeadCard
                  key={l.id} lead={l} onClick={() => onOpenLead(l)}
                  onDragStart={e => {
                    e.dataTransfer.setData("text/lead-id", l.id);
                    e.dataTransfer.effectAllowed = "move";
                    setDragId(l.id);
                  }}
                  onDragEnd={() => { setDragId(null); setDropTarget(null); }}
                  isDragging={dragId === l.id}
                />
              ))}
              {items.length === 0 && (
                <div style={{ padding: 24, textAlign: "center", color: "var(--ink-4)", fontSize: 11.5 }}>
                  {isTarget ? "Solte aqui" : "Sem leads"}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function LeadCard({ lead, onClick, onDragStart, onDragEnd, isDragging }: {
  lead: UiLead;
  onClick: () => void;
  onDragStart?: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragEnd?: () => void;
  isDragging?: boolean;
}) {
  return (
    <div
      onClick={onClick}
      draggable={!!onDragStart}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className="grab"
      style={{
        background: "var(--surface)", border: "1px solid var(--line)",
        borderRadius: 5, padding: "10px 11px",
        display: "flex", flexDirection: "column", gap: 7,
        cursor: onDragStart ? "grab" : "pointer",
        transition: "border-color 80ms, box-shadow 80ms, opacity 100ms",
        opacity: isDragging ? 0.4 : 1,
      }}
      onMouseEnter={e=>{ const el = e.currentTarget; el.style.borderColor="var(--line-strong)"; el.style.boxShadow="var(--shadow-md)"; }}
      onMouseLeave={e=>{ const el = e.currentTarget; el.style.borderColor="var(--line)"; el.style.boxShadow="none"; }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
        <span className="mono" style={{ fontSize: 10.5, color: "var(--ink-4)", letterSpacing: "0.02em" }}>{lead.id.slice(0, 8)}</span>
        <OperadoraTag op={lead.operadora} />
      </div>
      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", lineHeight: 1.3 }}>{lead.empresa}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <Avatar name={lead.contato} size={20} />
        <span style={{ fontSize: 11.5, color: "var(--ink-2)" }}>{lead.contato}</span>
      </div>
      {(lead.cidade || lead.uf) && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--ink-3)" }}>
          <Ic.Pin size={11} /> {lead.cidade ?? ""}{lead.uf ? `/${lead.uf}` : ""}
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 4, paddingTop: 7, borderTop: "1px dashed var(--line)" }}>
        <span className="mono" style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)" }}>{fmtBRL(Number(lead.valor || 0))}</span>
        {lead.proximo && lead.proximo !== "—" && (
          <span style={{ fontSize: 11, color: "var(--ink-3)", display: "inline-flex", alignItems: "center", gap: 4 }}>
            <Ic.Clock size={10} />{lead.proximo}
          </span>
        )}
      </div>
      {lead.advox_caso_id && (
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "4px 7px",
          background: "var(--gold-soft)",
          border: "1px solid var(--gold-border)",
          borderRadius: 4, fontSize: 11, color: "var(--gold-deep)",
          marginTop: 2,
        }}>
          <Ic.Scale size={11} /><span className="mono">{lead.advox_caso_id.slice(0, 8)}</span> · em análise
        </div>
      )}
    </div>
  );
}

/* === Lista === */
export function RepLista({ filter, onOpenLead, leads: leadsProp }: { filter: string; onOpenLead: (l: UiLead) => void; leads?: UiLead[] | null }) {
  const source = leadsProp ?? [];
  const leads = source.filter(l => !filter || (l.empresa + l.contato).toLowerCase().includes(filter.toLowerCase()));
  if (leadsProp === null) {
    return <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 6, padding: 40, textAlign: "center", color: "var(--ink-3)", fontSize: 13 }}>Carregando leads…</div>;
  }
  if (leads.length === 0) {
    return (
      <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 6 }}>
        <Empty icon={<Ic.Briefcase size={20} />} title="Nenhum lead aqui ainda" hint={filter ? "Tente outra busca." : "Clique em 'Novo Lead' para começar."} />
      </div>
    );
  }
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 6, overflow: "hidden" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
        <thead>
          <tr style={{ background: "var(--surface-2)", borderBottom: "1px solid var(--line)" }}>
            {["ID", "Empresa / Contato", "Operadora", "Status", "Valor", "Próximo passo", "Origem", ""].map(h => (
              <th key={h} style={{ textAlign: "left", padding: "9px 12px", fontWeight: 500, color: "var(--ink-3)", fontSize: 11.5, textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {leads.map(l => (
            <tr key={l.id} onClick={() => onOpenLead(l)} style={{ borderBottom: "1px solid var(--line)", cursor: "pointer" }}
              onMouseEnter={e=>e.currentTarget.style.background="var(--hover)"}
              onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
              <td style={{ padding: "10px 12px" }}><span className="mono" style={{ color: "var(--ink-3)", fontSize: 11.5 }}>{l.id.slice(0, 8)}</span></td>
              <td style={{ padding: "10px 12px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                  <Avatar name={l.contato} size={26} />
                  <div>
                    <div style={{ fontWeight: 500, color: "var(--ink)" }}>{l.empresa}</div>
                    <div style={{ fontSize: 11.5, color: "var(--ink-3)" }}>{l.contato}{l.cidade ? ` · ${l.cidade}` : ""}{l.uf ? `/${l.uf}` : ""}</div>
                  </div>
                </div>
              </td>
              <td style={{ padding: "10px 12px" }}><OperadoraTag op={l.operadora} /></td>
              <td style={{ padding: "10px 12px" }}><StatusPillDB stage={l.status} size="sm" /></td>
              <td style={{ padding: "10px 12px" }} className="mono"><span style={{ fontWeight: 500 }}>{fmtBRL(Number(l.valor || 0))}</span></td>
              <td style={{ padding: "10px 12px", color: "var(--ink-2)" }}>{l.proximo ?? "—"}</td>
              <td style={{ padding: "10px 12px", color: "var(--ink-3)" }}>{l.origem ?? "—"}</td>
              <td style={{ padding: "10px 12px", textAlign: "right" }}>
                <Ic.Chevron size={13} color="var(--ink-4)" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatusPillDB({ stage, size = "md" }: { stage: string; size?: "sm" | "md" }) {
  const s = [...PIPELINE_COMERCIAL_DB, ...PIPELINE_JURIDICO_DB].find(p => p.id === stage);
  return <StatusPill stage={stage} pipeline={s && PIPELINE_COMERCIAL_DB.find(p => p.id === stage) ? PIPELINE_COMERCIAL_DB : PIPELINE_JURIDICO_DB} size={size} />;
}

/* === Novo Lead Modal === */
function NovoLeadModal({ onClose }: { onClose: () => void }) {
  const { profile } = useAuth();
  const [empresa, setEmpresa] = useState("");
  const [contato, setContato] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [cidade, setCidade] = useState("");
  const [uf, setUf] = useState("SP");
  const [operadora, setOperadora] = useState<Operadora>("Vivo");
  const [valor, setValor] = useState("");
  const [tag, setTag] = useState("");
  const [origem, setOrigem] = useState("Indicação");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.revenda_id) { setErr("Você precisa estar vinculado a uma revenda."); return; }
    setBusy(true);
    setErr(null);
    const { error } = await createLead({
      empresa: empresa.trim(),
      contato: contato.trim(),
      cnpj: cnpj.trim() || null,
      cidade: cidade.trim() || null,
      uf: uf || null,
      operadora,
      valor: Number(valor.replace(/[^\d.,]/g, "").replace(",", ".")) || 0,
      status: "novo",
      tag: tag.trim() || null,
      origem,
      rep_id: profile.id,
      revenda_id: profile.revenda_id,
    });
    setBusy(false);
    if (error) { setErr(error); return; }
    onClose();
  };

  return (
    <div onClick={onClose} className="modal-backdrop" style={{
      position: "fixed", inset: 0, zIndex: 100,
      background: "oklch(0.10 0.04 250 / 0.45)", backdropFilter: "blur(2px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
    }}>
      <div onClick={e=>e.stopPropagation()} className="modal-shell fade-up" style={{
        width: 640, maxWidth: "100%",
        background: "var(--surface)", border: "1px solid var(--line-2)",
        borderRadius: 8, boxShadow: "var(--shadow-lg)",
        display: "flex", flexDirection: "column", overflow: "hidden",
      }}>
        <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ width: 28, height: 28, borderRadius: 5, background: "var(--navy)", color: "var(--navy-ink)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
            <Ic.Plus size={15} />
          </span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>Novo Lead</div>
            <div style={{ fontSize: 11.5, color: "var(--ink-3)" }}>Cadastre um novo cliente em prospecção</div>
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: 0, color: "var(--ink-3)", cursor: "pointer", padding: 6 }}>
            <Ic.X size={16} />
          </button>
        </div>

        <form onSubmit={submit} style={{ padding: 18, display: "flex", flexDirection: "column", gap: 12, overflow: "auto", maxHeight: "calc(92vh - 130px)" }}>
          {err && (
            <div style={{ background: "var(--rose-soft)", border: "1px solid var(--rose-border)", color: "var(--rose)", padding: "9px 12px", borderRadius: 5, fontSize: 12.5 }}>
              {err}
            </div>
          )}
          <div className="grid-2col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Empresa">
              <Input full value={empresa} onChange={e=>setEmpresa(e.target.value)} placeholder="Construtora Vértice Sul" autoFocus />
            </Field>
            <Field label="Contato">
              <Input full value={contato} onChange={e=>setContato(e.target.value)} placeholder="Mariana Albuquerque" />
            </Field>
            <Field label="CNPJ (opcional)">
              <Input full value={cnpj} onChange={e=>setCnpj(e.target.value)} placeholder="32.481.902/0001-44" />
            </Field>
            <Field label="Operadora atual">
              <Select value={operadora} onChange={e=>setOperadora(e.target.value as Operadora)} options={OPERADORAS_LIST as unknown as string[]} />
            </Field>
            <Field label="Cidade">
              <Input full value={cidade} onChange={e=>setCidade(e.target.value)} placeholder="Florianópolis" />
            </Field>
            <Field label="UF">
              <Select value={uf} onChange={e=>setUf(e.target.value)} options={["SP","RJ","MG","RS","SC","PR","PE","BA","DF","GO","MT","MS","CE","ES","AM","PA","SE","AL","MA","PI","RN","PB","TO","RO","AC","RR","AP"]} />
            </Field>
            <Field label="Valor estimado (R$)">
              <Input full value={valor} onChange={e=>setValor(e.target.value)} placeholder="48000" />
            </Field>
            <Field label="Origem">
              <Select value={origem} onChange={e=>setOrigem(e.target.value)} options={["Indicação","Landing","Cold call","Inbound","Evento","Outros"]} />
            </Field>
            <Field label="Tag (opcional)">
              <Input full value={tag} onChange={e=>setTag(e.target.value)} placeholder="Pós-pago, Frota M2M, etc." />
            </Field>
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 6 }}>
            <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
            <Btn variant="primary" type="submit" disabled={busy || !empresa.trim() || !contato.trim()}>
              {busy ? "Salvando…" : "Criar lead"}
            </Btn>
          </div>
        </form>
      </div>
    </div>
  );
}

/* === Lead detail === */
export function RepLeadDetail({ lead: leadProp, onBack, onOpenDesbloq }: { lead: UiLead; onBack: () => void; onOpenDesbloq: () => void }) {
  const [tab, setTab] = useState("historico");
  // Re-busca lead atualizado em tempo real (segue mudanças remotas)
  const [lead, setLead] = useState<UiLead>(leadProp);
  const { casos } = useLiveCasos();
  const caso = (casos ?? []).find(c => c.lead_id === lead.id);

  useEffect(() => {
    const ch = supabase.channel(`lead-detail-${lead.id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "leads", filter: `id=eq.${lead.id}` }, (payload) => {
        setLead(prev => ({ ...prev, ...(payload.new as UiLead) }));
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [lead.id]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ padding: "12px 18px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", gap: 10, background: "var(--surface-2)" }}>
        <button onClick={onBack} style={{ background: "transparent", border: 0, color: "var(--ink-2)", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5, padding: 4, fontSize: 12.5 }}>
          <Ic.ArrowLeft size={13} /> Pipeline
        </button>
        <span style={{ color: "var(--ink-4)" }}>/</span>
        <span className="mono" style={{ fontSize: 12, color: "var(--ink-3)" }}>{lead.id.slice(0, 8)}</span>
        <span style={{ color: "var(--ink-4)" }}>·</span>
        <span style={{ fontSize: 13, color: "var(--ink)" }}>{lead.empresa}</span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <Btn variant="ghost" size="sm" icon={<Ic.Phone size={13} />}>Ligar</Btn>
          <Btn variant="ghost" size="sm" icon={<Ic.Whats size={13} />}>WhatsApp</Btn>
          <Btn variant="ghost" size="sm" icon={<Ic.Mail size={13} />}>Email</Btn>
          {!caso && <Btn variant="gold" size="sm" icon={<Ic.Unlock size={13} />} onClick={onOpenDesbloq}>Indicar para Advox</Btn>}
        </div>
      </div>

      <div className="grid-detail" style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 0, flex: 1, overflow: "hidden" }}>
        <div style={{ overflow: "auto", padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
            <div style={{ width: 56, height: 56, borderRadius: 8, background: "var(--surface-3)", border: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Ic.Building size={26} />
            </div>
            <div style={{ flex: 1 }}>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, letterSpacing: "-0.015em" }}>{lead.empresa}</h1>
              <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 10, fontSize: 12.5, color: "var(--ink-3)", flexWrap: "wrap" }}>
                {lead.cnpj && <><span><span className="mono">{lead.cnpj}</span></span><span>·</span></>}
                {(lead.cidade || lead.uf) && <><span>{lead.cidade ?? ""}{lead.uf ? `/${lead.uf}` : ""}</span><span>·</span></>}
                <span>Origem: {lead.origem ?? "—"}</span>
              </div>
              <div style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <StatusPillDB stage={lead.status} />
                <OperadoraTag op={lead.operadora} />
                {lead.tag && <Badge>{lead.tag}</Badge>}
                <span style={{ marginLeft: 8, fontSize: 13, fontWeight: 600, color: "var(--ink)" }} className="mono">{fmtBRL(Number(lead.valor || 0))}</span>
                <span style={{ fontSize: 11.5, color: "var(--ink-4)" }}>valor estimado</span>
              </div>
            </div>
          </div>

          {caso && (
            <div style={{
              background: "linear-gradient(180deg, var(--gold-soft), var(--gold-soft))",
              border: "1px solid var(--gold-border)",
              borderRadius: 6, padding: "14px 16px",
              display: "flex", alignItems: "center", gap: 14,
            }}>
              <div style={{ width: 40, height: 40, borderRadius: 6, background: "var(--gold-soft-2)", color: "var(--gold-deep)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                <Ic.Scale size={20} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11.5, color: "var(--gold-deep)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 500 }}>Caso jurídico vinculado</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", marginTop: 2 }}>
                  <span className="mono">{caso.id.slice(0, 8)}</span> — {caso.advogado?.nome ?? "Aguardando atribuição"}
                </div>
                <div style={{ fontSize: 12, color: "var(--ink-2)", marginTop: 4 }}>
                  Próximo passo: <strong>{caso.prox_passo ?? "—"}</strong>
                </div>
              </div>
              <StatusPill stage={caso.status} pipeline={PIPELINE_JURIDICO_DB} />
            </div>
          )}

          {/* Edit status inline */}
          <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 6, padding: 14 }}>
            <div style={{ fontSize: 12, color: "var(--ink-3)", marginBottom: 8, fontWeight: 500 }}>Mover para</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {PIPELINE_COMERCIAL.map(s => {
                const isCurrent = lead.status === s.id;
                return (
                  <button key={s.id} onClick={async () => { if (!isCurrent) await updateLead(lead.id, { status: s.id }); }} style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    padding: "5px 10px",
                    border: `1px solid ${isCurrent ? "var(--navy)" : "var(--line-2)"}`,
                    background: isCurrent ? "var(--navy)" : "var(--surface)",
                    color: isCurrent ? "var(--navy-ink)" : "var(--ink)",
                    borderRadius: 5, fontSize: 11.5, fontWeight: 500, cursor: "pointer",
                  }}>
                    <span style={{ width: 6, height: 6, borderRadius: 99, background: s.color }} />
                    {s.label}
                  </button>
                );
              })}
            </div>
          </div>

          <Tabs active={tab} onChange={setTab} tabs={[
            { id: "historico", label: "Histórico", icon: <Ic.Clock size={13} /> },
            { id: "tarefas", label: "Tarefas", icon: <Ic.Check size={13} /> },
            { id: "documentos", label: "Documentos", icon: <Ic.Doc size={13} /> },
            { id: "comercial", label: "Dados Comerciais", icon: <Ic.Money size={13} /> },
          ]} />

          {tab === "historico" && <NotasLead leadId={lead.id} />}
          {tab === "tarefas" && <TarefasLead leadId={lead.id} />}
          {tab === "documentos" && <DocumentosLista parent={{ kind: "lead", id: lead.id }} />}
          {tab === "comercial" && <DadosComerciais lead={lead} />}
        </div>

        <aside style={{ borderLeft: "1px solid var(--line)", background: "var(--surface-2)", overflow: "auto" }}>
          <SidebarBlock title="Identificação">
            <KV k="Contato" v={lead.contato} />
            {lead.cnpj && <KV k="CNPJ" v={lead.cnpj} mono />}
            {(lead.cidade || lead.uf) && <KV k="Localização" v={`${lead.cidade ?? ""}${lead.uf ? `/${lead.uf}` : ""}`} />}
          </SidebarBlock>
          <SidebarBlock title="Comercial">
            <KV k="Valor estimado" v={fmtBRL(Number(lead.valor || 0))} mono />
            <KV k="Operadora atual" v={<OperadoraTag op={lead.operadora} size="sm" />} />
            {lead.tag && <KV k="Tag" v={<Badge>{lead.tag}</Badge>} />}
            <KV k="Origem" v={lead.origem ?? "—"} />
          </SidebarBlock>
          <SidebarBlock title="Atribuição">
            <KV k="Responsável" v={<><Avatar name={lead.rep?.nome ?? "?"} size={18} /> <span style={{ marginLeft: 6 }}>{lead.rep?.nome ?? "—"}</span></>} />
            <KV k="Revenda" v={lead.revenda?.nome ?? "—"} />
            <KV k="Aberto em" v={new Date(lead.created_at).toLocaleDateString("pt-BR")} />
          </SidebarBlock>
        </aside>
      </div>
    </div>
  );
}

function NotasLead({ leadId }: { leadId: string }) {
  const { profile } = useAuth();
  const [notas, setNotas] = useState<Array<{ id: string; texto: string; tipo: string; created_at: string; autor: { nome: string } | null }> | null>(null);
  const [novo, setNovo] = useState("");
  const [tipoNovo, setTipoNovo] = useState<"nota"|"ligacao"|"email"|"whatsapp">("nota");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data } = await supabase
      .from("notas")
      .select("id, texto, tipo, created_at, autor:profiles!notas_autor_id_fkey(nome)")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false });
    setNotas((data ?? []) as never);
  };

  useEffect(() => { load(); }, [leadId]);
  useEffect(() => {
    const ch = supabase.channel(`notas-${leadId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "notas", filter: `lead_id=eq.${leadId}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [leadId]);

  const submit = async () => {
    if (!novo.trim() || !profile?.id) return;
    setBusy(true);
    await supabase.from("notas").insert({
      lead_id: leadId, autor_id: profile.id, texto: novo.trim(), tipo: tipoNovo, interno: false,
    } as never);
    setNovo("");
    setBusy(false);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 6, padding: 12 }}>
        <textarea value={novo} onChange={e=>setNovo(e.target.value)} placeholder="Adicionar nota, ligação ou mensagem…"
          style={{ width: "100%", minHeight: 56, border: 0, outline: 0, resize: "vertical", fontFamily: "inherit", fontSize: 13, lineHeight: 1.5, background: "transparent", color: "var(--ink)" }} />
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}>
          {(["nota","ligacao","whatsapp","email"] as const).map(t => (
            <button key={t} onClick={() => setTipoNovo(t)} style={{
              padding: "4px 9px", fontSize: 11.5,
              background: tipoNovo === t ? "var(--surface-3)" : "transparent",
              border: `1px solid ${tipoNovo === t ? "var(--line-2)" : "transparent"}`,
              color: tipoNovo === t ? "var(--ink)" : "var(--ink-3)",
              borderRadius: 4, cursor: "pointer", textTransform: "capitalize",
            }}>{t === "nota" ? "Nota" : t === "ligacao" ? "Ligação" : t}</button>
          ))}
          <Btn variant="primary" size="sm" style={{ marginLeft: "auto" }} onClick={submit} disabled={busy || !novo.trim()}>Adicionar</Btn>
        </div>
      </div>

      <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 6 }}>
        {notas === null ? (
          <div style={{ padding: 24, textAlign: "center", color: "var(--ink-3)", fontSize: 12.5 }}>Carregando histórico…</div>
        ) : notas.length === 0 ? (
          <Empty icon={<Ic.Clock size={18} />} title="Sem histórico ainda" hint="Adicione a primeira nota acima." />
        ) : (
          notas.map((n, i) => (
            <div key={n.id} style={{ display: "flex", gap: 12, padding: "12px 14px", borderBottom: i < notas.length - 1 ? "1px solid var(--line)" : 0 }}>
              <span style={{ width: 22, height: 22, borderRadius: 99, background: "var(--surface-3)", border: "1px solid var(--line)", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "var(--ink-2)" }}>
                {n.tipo === "ligacao" ? <Ic.Phone size={11} /> : n.tipo === "email" ? <Ic.Mail size={11} /> : n.tipo === "whatsapp" ? <Ic.Whats size={11} /> : <Ic.Pin size={11} />}
              </span>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
                  <span style={{ fontSize: 12.5, fontWeight: 500 }}>{n.autor?.nome ?? "—"}</span>
                  <span style={{ fontSize: 11, color: "var(--ink-4)" }}>{new Date(n.created_at).toLocaleString("pt-BR")}</span>
                </div>
                <div style={{ fontSize: 12.5, color: "var(--ink-2)", lineHeight: 1.5, marginTop: 3 }}>{n.texto}</div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function TarefasLead({ leadId }: { leadId: string }) {
  const { tarefas } = useLiveTarefas({ leadId });
  if (tarefas === null) return <div style={{ padding: 20, textAlign: "center", color: "var(--ink-3)", fontSize: 13 }}>Carregando…</div>;
  if (tarefas.length === 0) {
    return (
      <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 6 }}>
        <Empty icon={<Ic.Check size={18} />} title="Nenhuma tarefa para este lead" />
      </div>
    );
  }
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 6, overflow: "hidden" }}>
      {tarefas.map(t => <TarefaRowLive key={t.id} t={t} />)}
    </div>
  );
}

function DadosComerciais({ lead }: { lead: UiLead }) {
  return (
    <div className="grid-2col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
      <Section title="Cliente / Empresa" dense>
        <KV k="Razão social" v={lead.empresa} />
        {lead.cnpj && <KV k="CNPJ" v={lead.cnpj} mono />}
        <KV k="Contato principal" v={lead.contato} />
        {(lead.cidade || lead.uf) && <KV k="Endereço" v={`${lead.cidade ?? ""}${lead.uf ? `/${lead.uf}` : ""}`} />}
      </Section>
      <Section title="Operação telecom" dense>
        <KV k="Operadora atual" v={<OperadoraTag op={lead.operadora} />} />
        <KV k="Valor estimado" v={fmtBRL(Number(lead.valor || 0))} mono />
        {lead.tag && <KV k="Tags" v={<Badge>{lead.tag}</Badge>} />}
      </Section>
    </div>
  );
}

/* === TarefaRow live === */
export function TarefaRowLive({ t, dense }: { t: UiTarefa; dense?: boolean }) {
  const [done, setDone] = useState(t.completed);
  const toggle = async () => {
    const novo = !done;
    setDone(novo);
    await toggleTarefa(t.id, novo);
  };
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: dense ? "8px 12px" : "11px 14px",
      borderBottom: "1px solid var(--line)",
      opacity: done ? 0.4 : 1,
    }}>
      <button onClick={toggle} style={{
        width: 16, height: 16, borderRadius: 4,
        border: `1.5px solid ${done ? "var(--green)" : "var(--line-strong)"}`,
        background: done ? "var(--green)" : "transparent",
        color: "#fff",
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        cursor: "pointer", padding: 0, flexShrink: 0,
      }}>{done && <Ic.Check size={10} />}</button>
      <div style={{ flex: 1, fontSize: 13, color: "var(--ink)", textDecoration: done ? "line-through" : "none" }}>
        {t.descricao}
        {t.lead?.empresa && <span style={{ color: "var(--ink-4)", fontSize: 11.5, marginLeft: 6 }}>· {t.lead.empresa}</span>}
      </div>
      <span style={{
        fontSize: 11, padding: "2px 6px", borderRadius: 3,
        background: t.prioridade === "alta" ? "var(--rose-soft)" : t.prioridade === "media" ? "var(--amber-soft)" : "var(--surface-3)",
        color: t.prioridade === "alta" ? "var(--rose)" : t.prioridade === "media" ? "var(--amber-text)" : "var(--ink-3)",
        border: "1px solid " + (t.prioridade === "alta" ? "var(--rose-border)" : t.prioridade === "media" ? "var(--amber-border)" : "var(--line)"),
        fontWeight: 500,
      }}>{t.prioridade}</span>
      <span style={{
        fontSize: 11.5, color: t.urgencia === "atrasada" ? "var(--rose)" : "var(--ink-3)",
        display: "inline-flex", alignItems: "center", gap: 4,
        minWidth: 110, justifyContent: "flex-end",
      }}>
        <Ic.Clock size={11} /> {t.quando ? new Date(t.quando).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—"}
      </span>
    </div>
  );
}

// Backward compat: TarefaRow alias antigo
export const TarefaRow = TarefaRowLive;

/* === Tarefas screen === */
export function RepTarefas() {
  const { profile } = useAuth();
  const { tarefas } = useLiveTarefas({ autorId: profile?.id });
  const [showNova, setShowNova] = useState(false);
  const groups = [
    { id: "atrasada", label: "Atrasadas", color: "var(--rose)" },
    { id: "hoje", label: "Hoje", color: "var(--amber)" },
    { id: "semana", label: "Esta semana", color: "var(--navy)" },
    { id: "proxima", label: "Próximas", color: "var(--ink-3)" },
  ] as const;

  return (
    <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 16 }}>
      <header style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, letterSpacing: "-0.015em" }}>Tarefas</h1>
          <div style={{ fontSize: 13, color: "var(--ink-3)", marginTop: 4 }}>
            {tarefas === null ? "Carregando…" : `${(tarefas ?? []).filter(t => !t.completed).length} pendentes`}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Btn variant="primary" size="sm" icon={<Ic.Plus size={13} />} onClick={() => setShowNova(true)}>Nova tarefa</Btn>
        </div>
      </header>

      {tarefas === null ? (
        <div style={{ padding: 40, textAlign: "center", color: "var(--ink-3)", fontSize: 13 }}>Carregando tarefas…</div>
      ) : (tarefas ?? []).length === 0 ? (
        <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 6 }}>
          <Empty icon={<Ic.Check size={20} />} title="Nenhuma tarefa ainda" hint="Crie sua primeira tarefa para começar." action={<Btn variant="primary" size="sm" icon={<Ic.Plus size={12} />} onClick={() => setShowNova(true)}>Nova tarefa</Btn>} />
        </div>
      ) : (
        groups.map(g => {
          const items = (tarefas ?? []).filter(t => !t.completed && t.urgencia === g.id);
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
        })
      )}

      {showNova && <NovaTarefaModal onClose={() => setShowNova(false)} />}
    </div>
  );
}

function NovaTarefaModal({ onClose }: { onClose: () => void }) {
  const { profile } = useAuth();
  const { leads } = useLiveLeads({ repId: profile?.id });
  const [desc, setDesc] = useState("");
  const [leadId, setLeadId] = useState<string>("");
  const [prioridade, setPrioridade] = useState<"alta"|"media"|"baixa">("media");
  const [urgencia, setUrgencia] = useState<"atrasada"|"hoje"|"semana"|"proxima">("hoje");
  const [quando, setQuando] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.id) return;
    setBusy(true);
    setErr(null);
    const { error } = await supabase.from("tarefas").insert({
      autor_id: profile.id,
      lead_id: leadId || null,
      descricao: desc.trim(),
      quando: quando || null,
      prioridade,
      urgencia,
    } as never);
    setBusy(false);
    if (error) { setErr(error.message); return; }
    onClose();
  };

  return (
    <div onClick={onClose} className="modal-backdrop" style={{
      position: "fixed", inset: 0, zIndex: 100,
      background: "oklch(0.10 0.04 250 / 0.45)", backdropFilter: "blur(2px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
    }}>
      <div onClick={e=>e.stopPropagation()} className="modal-shell fade-up" style={{
        width: 520, maxWidth: "100%",
        background: "var(--surface)", border: "1px solid var(--line-2)",
        borderRadius: 8, boxShadow: "var(--shadow-lg)",
      }}>
        <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>Nova tarefa</div>
          <button onClick={onClose} style={{ background: "transparent", border: 0, color: "var(--ink-3)", cursor: "pointer", padding: 6 }}><Ic.X size={16} /></button>
        </div>
        <form onSubmit={submit} style={{ padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
          {err && <div style={{ background: "var(--rose-soft)", border: "1px solid var(--rose-border)", color: "var(--rose)", padding: "9px 12px", borderRadius: 5, fontSize: 12.5 }}>{err}</div>}
          <Field label="Descrição">
            <Input full value={desc} onChange={e=>setDesc(e.target.value)} placeholder="Ligar para cliente, enviar proposta…" autoFocus />
          </Field>
          <Field label="Lead vinculado (opcional)">
            <Select value={leadId} onChange={e=>setLeadId(e.target.value)} options={["", ...((leads ?? []).map(l => l.empresa))]} />
          </Field>
          <div className="grid-2col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Prioridade">
              <Select value={prioridade} onChange={e=>setPrioridade(e.target.value as "alta"|"media"|"baixa")} options={["alta","media","baixa"]} />
            </Field>
            <Field label="Urgência">
              <Select value={urgencia} onChange={e=>setUrgencia(e.target.value as "atrasada"|"hoje"|"semana"|"proxima")} options={["hoje","semana","proxima","atrasada"]} />
            </Field>
          </div>
          <Field label="Quando (opcional)">
            <Input full type="datetime-local" value={quando} onChange={e=>setQuando(e.target.value)} placeholder="" />
          </Field>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 6 }}>
            <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
            <Btn variant="primary" type="submit" disabled={busy || !desc.trim()}>{busy ? "Salvando…" : "Criar tarefa"}</Btn>
          </div>
        </form>
      </div>
    </div>
  );
}

/* === Casos do rep === */
export function RepCasos({ onOpenLead }: { onOpenLead: (l: UiLead) => void }) {
  const { profile } = useAuth();
  const { casos } = useLiveCasos({ repId: profile?.id });
  const { leads } = useLiveLeads({ repId: profile?.id });

  return (
    <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 16 }}>
      <header>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, letterSpacing: "-0.015em" }}>Casos Jurídicos</h1>
        <div style={{ fontSize: 13, color: "var(--ink-3)", marginTop: 4 }}>
          Clientes seus que foram indicados para o escritório.
        </div>
      </header>

      <div className="grid-kpi" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        <KPI label="Em análise" valor={String((casos ?? []).filter(c => c.status === "analise").length)} delta="—" trend="neutral" icon={<Ic.Search size={14} />} />
        <KPI label="Em negociação" valor={String((casos ?? []).filter(c => ["honorarios","contratou"].includes(c.status)).length)} delta="cliente decidindo" trend="neutral" icon={<Ic.Whats size={14} />} />
        <KPI label="Em execução" valor={String((casos ?? []).filter(c => ["extrajudicial","judicial","documentacao"].includes(c.status)).length)} delta="extrajudicial / judicial" trend="neutral" icon={<Ic.Scale size={14} />} />
        <KPI label="Liberados" valor={String((casos ?? []).filter(c => c.status === "liberado").length)} delta={fmtBRL((casos ?? []).filter(c => c.status === "liberado").reduce((s, c) => s + Number(c.multa || 0), 0)) + " recuperados"} trend="up" icon={<Ic.CheckCircle size={14} />} />
      </div>

      <Section title="Meus casos jurídicos" noPad>
        {casos === null ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--ink-3)", fontSize: 13 }}>Carregando…</div>
        ) : (casos ?? []).length === 0 ? (
          <Empty icon={<Ic.Scale size={20} />} title="Nenhum caso jurídico ainda" hint="Use o botão DESBLOQUEAR CLIENTE para indicar um lead ao escritório." />
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: "var(--surface-2)", borderBottom: "1px solid var(--line)" }}>
                {["Caso", "Cliente", "Status jurídico", "Advogado", "Próximo passo", "Multa", ""].map(h => (
                  <th key={h} style={{ textAlign: "left", padding: "9px 12px", fontWeight: 500, color: "var(--ink-3)", fontSize: 11.5, textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(casos ?? []).map(c => {
                const lead = (leads ?? []).find(l => l.id === c.lead_id);
                return (
                  <tr key={c.id} onClick={() => lead && onOpenLead(lead)} style={{ borderBottom: "1px solid var(--line)", cursor: lead ? "pointer" : "default" }}
                    onMouseEnter={e=>e.currentTarget.style.background="var(--hover)"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                    <td style={{ padding: "10px 12px" }}><span className="mono" style={{ color: "var(--ink)", fontWeight: 500 }}>{c.id.slice(0, 8)}</span></td>
                    <td style={{ padding: "10px 12px" }}>
                      <div style={{ fontWeight: 500 }}>{c.lead?.empresa ?? "—"}</div>
                      <div style={{ fontSize: 11.5, color: "var(--ink-3)" }}>{c.lead?.contato ?? ""}</div>
                    </td>
                    <td style={{ padding: "10px 12px" }}><StatusPill stage={c.status} pipeline={PIPELINE_JURIDICO_DB} size="sm" /></td>
                    <td style={{ padding: "10px 12px" }}>{c.advogado?.nome ?? "—"}</td>
                    <td style={{ padding: "10px 12px", color: "var(--ink-2)" }}>{c.prox_passo ?? "—"}</td>
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
