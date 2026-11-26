import React, { useEffect, useState } from "react";
import { Ic } from "./icons";
import {
  Btn, Badge, StatusPill, Avatar, KPI, Input, OperadoraTag, Section, Empty, Tabs,
  KV, SidebarBlock, Field, Select,
} from "./ui";
import {
  useLiveLeads, useLiveCasos, useLiveTarefas, updateLead, createLead, toggleTarefa,
  PIPELINE_COMERCIAL_DB, PIPELINE_JURIDICO_DB, fmtBRL, parseBRL, OPERADORAS_LIST,
  normalizaTelefone, fmtTelefone, waLink, registrarContato, MOTIVOS_PERDA, TIPOS_ATIVIDADE, fetchLead,
  type UiLead, type UiCaso, type UiTarefa,
} from "./lib/data-live";
import { useAuth } from "./auth";
import { supabase } from "./lib/supabase";
import type { LeadStatus, Operadora, TipoAtividade } from "./lib/database.types";
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

  const lista = leads ?? [];
  const abertos = lista.filter(l => !["fechado", "perdido"].includes(l.status));
  const emAberto = abertos.reduce((s, l) => s + Number(l.valor || 0), 0);
  const noJuridico = lista.filter(l => l.status === "travado" || l.status === "aguardando").length;
  const inicioMes = new Date(); inicioMes.setDate(1); inicioMes.setHours(0, 0, 0, 0);
  const fechadosMes = lista.filter(l => l.status === "fechado" && new Date(l.updated_at ?? l.created_at) >= inicioMes);
  const valorMes = fechadosMes.reduce((s, l) => s + Number(l.valor || 0), 0);
  const hojeTxt = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
  const mes = new Date().toLocaleDateString("pt-BR", { month: "long" });
  const numero = (rotulo: string, valor: string, nota: string, cor?: string) => (
    <div>
      <div style={{ fontSize: 14, color: "var(--ink-3)" }}>{rotulo}</div>
      <div className="titulo mono" style={{ fontSize: 28, fontWeight: 600, lineHeight: 1.15, color: cor ?? "var(--ink)" }}>{valor}</div>
      <div style={{ fontSize: 13, color: "var(--ink-3)" }}>{nota}</div>
    </div>
  );

  return (
    <div className="page-pad" style={{ display: "flex", flexDirection: "column", gap: 16, padding: "22px 24px" }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: "14px 40px" }}>
        <div>
          <h1 className="page-title" style={{ margin: 0, fontSize: 28, fontWeight: 600 }}>Seus leads</h1>
          <div style={{ fontSize: 14, color: "var(--ink-3)", marginTop: 2 }}>{hojeTxt.charAt(0).toUpperCase() + hojeTxt.slice(1)}</div>
        </div>
        {leads !== null && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "12px 36px" }}>
            {numero("Em negociação", fmtBRL(emAberto), `${abertos.length} ${abertos.length === 1 ? "lead aberto" : "leads abertos"}`)}
            {numero("No jurídico", String(noJuridico), noJuridico === 1 ? "cliente sendo desbloqueado" : "clientes sendo desbloqueados")}
            {numero(`Fechado em ${mes}`, fmtBRL(valorMes), `${fechadosMes.length} ${fechadosMes.length === 1 ? "contrato" : "contratos"}`, valorMes ? "var(--green)" : undefined)}
          </div>
        )}
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
        borderRadius: 10,
      }}>
        <div className="seg-rola" style={{ display: "inline-flex", background: "var(--surface-3)", border: "1px solid var(--line)", borderRadius: 5, padding: 2 }}>
          {([["kanban", <Ic.Kanban size={13} />, "Funil"], ["lista", <Ic.List size={13} />, "Lista"]] as const).map(([id, ic, l]) => (
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
        <Input icon={<Ic.Search size={13} />} placeholder="Buscar empresa ou contato" value={filter} onChange={e=>setFilter(e.target.value)} style={{ minWidth: 320 }} />
        <div className="toolbar-actions" style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <Btn variant="primary" size="sm" icon={<Ic.Plus size={13} />} onClick={() => setShowNovo(true)}>Novo lead</Btn>
        </div>
      </div>

      {view === "kanban"
        ? <RepKanban filter={filter} onOpenLead={onOpenLead} leads={leads} onOpenDesbloq={onOpenDesbloq} />
        : <RepLista filter={filter} onOpenLead={onOpenLead} leads={leads} />}

      {showNovo && <NovoLeadModal onClose={() => setShowNovo(false)} />}
    </div>
  );
}

/* === Kanban === */
export function RepKanban({ filter, onOpenLead, leads: leadsProp, onOpenDesbloq }: { filter: string; onOpenLead: (l: UiLead) => void; leads?: UiLead[] | null; onOpenDesbloq?: () => void }) {
  const [preview, setPreview] = useState<UiLead | null>(null);
  const source = leadsProp ?? [];
  const leads = source.filter(l => !filter || (l.empresa + l.contato).toLowerCase().includes(filter.toLowerCase()));
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [perdendo, setPerdendo] = useState<UiLead | null>(null);
  const [erroMover, setErroMover] = useState<string | null>(null);

  const handleDrop = async (newStatus: LeadStatus, leadId: string) => {
    const lead = source.find(l => l.id === leadId);
    if (!lead || lead.status === newStatus) return;
    if (newStatus === "perdido") { setPerdendo(lead); return; }
    const { error } = await updateLead(leadId, { status: newStatus, motivo_perda: null });
    setErroMover(error ? `Não foi possível mover: ${error}` : null);
  };

  if (leadsProp === null) {
    return <div style={{ padding: 40, textAlign: "center", color: "var(--ink-3)", fontSize: 13 }}>Carregando leads…</div>;
  }

  return (
    <>
    {erroMover && (
      <div style={{ background: "var(--rose-soft)", border: "1px solid var(--rose-border)", color: "var(--rose)", padding: "9px 12px", borderRadius: 5, fontSize: 12.5, marginBottom: 8 }}>{erroMover}</div>
    )}
    {preview && (
      <LeadQuickView lead={source.find(l => l.id === preview.id) ?? preview} onClose={() => setPreview(null)} onOpenFull={onOpenLead} onOpenDesbloq={onOpenDesbloq} />
    )}
    {perdendo && (
      <MotivoPerdaModal lead={perdendo} onClose={() => setPerdendo(null)} onConfirm={async (motivo) => {
        const { error } = await updateLead(perdendo.id, { status: "perdido", motivo_perda: motivo });
        setErroMover(error ? `Não foi possível mover: ${error}` : null);
        setPerdendo(null);
      }} />
    )}
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
              background: isTarget ? "var(--navy-soft)" : "var(--surface-3)",
              border: `1px ${isTarget ? "dashed" : "solid"} ${isTarget ? "var(--navy)" : "var(--line)"}`,
              borderRadius: 12,
              display: "flex", flexDirection: "column",
              minHeight: 400, maxHeight: "calc(100vh - 280px)",
              transition: "background 100ms, border-color 100ms",
            }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 12px 6px" }}>
              <span style={{ width: 7, height: 7, borderRadius: 99, background: col.color }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-2)" }}>{col.label}</span>
              <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 600, color: "var(--ink-3)", background: "var(--surface)", border: "1px solid var(--line)", padding: "1px 8px", borderRadius: 99 }}>{items.length}</span>
            </div>
            <div style={{ padding: "0 12px 6px", fontSize: 11.5, color: "var(--ink-3)", minHeight: 18 }}>
              {items.length > 0 && <span className="mono">{fmtBRL(total)}</span>}
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: 8, display: "flex", flexDirection: "column", gap: 8 }}>
              {items.map(l => (
                <LeadCard
                  key={l.id} lead={l} onClick={() => setPreview(l)}
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
    </>
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
      className="grab card-hover"
      style={{
        background: "var(--surface)", border: "1px solid var(--line)",
        borderRadius: 10, padding: "12px 12px",
        display: "flex", flexDirection: "column", gap: 8,
        boxShadow: "var(--shadow-sm)",
        cursor: onDragStart ? "grab" : "pointer",
        opacity: isDragging ? 0.4 : 1,
      }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
        <span className="mono" style={{ fontSize: 10.5, color: "var(--ink-4)", letterSpacing: "0.02em" }}>{lead.telefone ? fmtTelefone(lead.telefone) : "sem WhatsApp"}</span>
        <OperadoraTag op={lead.operadora} />
      </div>
      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", lineHeight: 1.3, letterSpacing: "-0.005em" }}>{lead.empresa}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <Avatar name={lead.contato} size={20} />
        <span style={{ fontSize: 11.5, color: "var(--ink-2)" }}>{lead.contato}</span>
      </div>
      {(lead.cidade || lead.uf) && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--ink-3)" }}>
          <Ic.Pin size={11} /> {lead.cidade ?? ""}{lead.uf ? `/${lead.uf}` : ""}
        </div>
      )}
      {!["fechado", "perdido"].includes(lead.status) && <div><FidelidadeBadge fim={lead.fim_fidelidade} /></div>}
      {lead.status === "perdido" && lead.motivo_perda && (
        <div style={{ fontSize: 11, color: "var(--ink-3)" }}>Motivo: {lead.motivo_perda}</div>
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
          padding: "4px 8px",
          background: "var(--gold-soft)",
          border: "1px solid var(--gold-border)",
          borderRadius: 6, fontSize: 11, color: "var(--gold-deep)",
          marginTop: 2,
        }}>
          <Ic.Scale size={11} />No jurídico
        </div>
      )}
    </div>
  );
}

/* === Lista === */
export function RepLista({ filter, onOpenLead, leads: leadsProp, semMoldura }: { filter: string; onOpenLead: (l: UiLead) => void; leads?: UiLead[] | null; semMoldura?: boolean }) {
  const source = leadsProp ?? [];
  const leads = source.filter(l => !filter || (l.empresa + l.contato).toLowerCase().includes(filter.toLowerCase()));
  if (leadsProp === null) {
    return <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 6, padding: 40, textAlign: "center", color: "var(--ink-3)", fontSize: 13 }}>Carregando leads…</div>;
  }
  if (leads.length === 0) {
    return (
      <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 6 }}>
        <Empty icon={<Ic.Briefcase size={20} />} title="Nenhum lead aqui ainda" hint={filter ? "Tente outra busca." : "Cadastre o primeiro em Novo lead."} />
      </div>
    );
  }
  return (
    <div style={semMoldura ? undefined : { background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 10, overflow: "hidden" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
        <thead>
          <tr style={{ borderBottom: "1px solid var(--line)" }}>
            {["Cliente", "Operadora", "Etapa", "Valor", "Próximo passo", "Origem", ""].map(h => (
              <th key={h} style={{ textAlign: "left", padding: "10px 14px", fontWeight: 500, color: "var(--ink-3)", fontSize: 13 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {leads.map(l => (
            <tr key={l.id} onClick={() => onOpenLead(l)} style={{ borderBottom: "1px solid var(--line)", cursor: "pointer" }}
              onMouseEnter={e=>e.currentTarget.style.background="var(--hover)"}
              onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
              <td style={{ padding: "10px 12px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                  <Avatar name={l.contato} size={26} />
                  <div>
                    <div style={{ fontWeight: 600, color: "var(--ink)" }}>{l.empresa}</div>
                    <div style={{ fontSize: 13, color: "var(--ink-3)" }}>{l.contato}{l.cidade ? `, ${l.cidade}` : ""}{l.uf ? `/${l.uf}` : ""}</div>
                  </div>
                </div>
              </td>
              <td style={{ padding: "10px 12px" }}><OperadoraTag op={l.operadora} /></td>
              <td style={{ padding: "10px 12px" }}><StatusPillDB stage={l.status} size="sm" /></td>
              <td style={{ padding: "10px 12px" }} className="mono"><span style={{ fontWeight: 500 }}>{fmtBRL(Number(l.valor || 0))}</span></td>
              <td style={{ padding: "10px 12px", color: l.proximo ? "var(--ink-2)" : "var(--ink-4)" }}>{l.proximo ?? "Definir"}</td>
              <td style={{ padding: "10px 12px", color: "var(--ink-3)" }}>{l.origem ?? ""}</td>
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

/* === Lead: criar / editar === */
export function NovoLeadModal({ onClose, lead, inicial }: {
  onClose: () => void;
  lead?: UiLead;                                   // presente = edição
  inicial?: Partial<Pick<UiLead, "contato" | "telefone" | "empresa">>; // pré-preenchimento (ex.: vindo do WhatsApp)
}) {
  const { profile } = useAuth();
  const editando = !!lead;
  const [empresa, setEmpresa] = useState(lead?.empresa ?? inicial?.empresa ?? "");
  const [contato, setContato] = useState(lead?.contato ?? inicial?.contato ?? "");
  const [telefone, setTelefone] = useState(lead?.telefone ? fmtTelefone(lead.telefone) : (inicial?.telefone ? fmtTelefone(inicial.telefone) : ""));
  const [email, setEmail] = useState(lead?.email ?? "");
  const [cnpj, setCnpj] = useState(lead?.cnpj ?? "");
  const [cidade, setCidade] = useState(lead?.cidade ?? "");
  const [uf, setUf] = useState(lead?.uf ?? "SP");
  const [operadora, setOperadora] = useState<Operadora>(lead?.operadora ?? "Vivo");
  const [valor, setValor] = useState(lead ? String(lead.valor ?? "") : "");
  const [fimFidelidade, setFimFidelidade] = useState(lead?.fim_fidelidade ?? "");
  const [tag, setTag] = useState(lead?.tag ?? "");
  const [origem, setOrigem] = useState(lead?.origem ?? "Indicação");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const telDigits = telefone.replace(/\D/g, "");
  const telInvalido = telDigits.length > 0 && telDigits.length < 10;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (telInvalido) { setErr("Telefone incompleto: informe DDD + número."); return; }
    const campos = {
      empresa: empresa.trim(),
      contato: contato.trim(),
      telefone: normalizaTelefone(telefone),
      email: email.trim() || null,
      cnpj: cnpj.trim() || null,
      cidade: cidade.trim() || null,
      uf: uf || null,
      operadora,
      valor: parseBRL(valor),
      fim_fidelidade: fimFidelidade || null,
      tag: tag.trim() || null,
      origem,
    };
    setBusy(true);
    setErr(null);
    let error: string | undefined;
    if (editando && lead) {
      ({ error } = await updateLead(lead.id, campos));
    } else {
      if (!profile?.revenda_id) { setBusy(false); setErr("Você precisa estar vinculado a uma revenda."); return; }
      ({ error } = await createLead({ ...campos, status: "novo", rep_id: profile.id, revenda_id: profile.revenda_id }));
    }
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
            {editando ? <Ic.Edit size={14} /> : <Ic.Plus size={15} />}
          </span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{editando ? "Editar lead" : "Novo lead"}</div>
            <div style={{ fontSize: 11.5, color: "var(--ink-3)" }}>{editando ? lead?.empresa : "Cadastre um novo cliente em prospecção"}</div>
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
            <Field label="WhatsApp / celular" hint={telInvalido ? "Informe DDD + número" : "Usado pelos botões e pela extensão do WhatsApp"}>
              <Input full value={telefone} onChange={e=>setTelefone(e.target.value)} placeholder="(11) 98765-4321" />
            </Field>
            <Field label="E-mail (opcional)">
              <Input full type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="contato@empresa.com.br" />
            </Field>
            <Field label="CNPJ (opcional)">
              <Input full value={cnpj} onChange={e=>setCnpj(e.target.value)} placeholder="32.481.902/0001-44" />
            </Field>
            <Field label="Operadora atual">
              <Select value={operadora} onChange={e=>setOperadora(e.target.value as Operadora)} options={OPERADORAS_LIST as unknown as string[]} />
            </Field>
            <Field label="Fim da fidelidade (opcional)" hint="Avisamos quando estiver perto de vencer">
              <Input full type="date" value={fimFidelidade} onChange={e=>setFimFidelidade(e.target.value)} />
            </Field>
            <Field label="Valor estimado (R$)">
              <Input full value={valor} onChange={e=>setValor(e.target.value)} placeholder="48000" />
            </Field>
            <Field label="Cidade">
              <Input full value={cidade} onChange={e=>setCidade(e.target.value)} placeholder="Florianópolis" />
            </Field>
            <Field label="UF">
              <Select value={uf} onChange={e=>setUf(e.target.value)} options={["SP","RJ","MG","RS","SC","PR","PE","BA","DF","GO","MT","MS","CE","ES","AM","PA","SE","AL","MA","PI","RN","PB","TO","RO","AC","RR","AP"]} />
            </Field>
            <Field label="Origem">
              <Select value={origem} onChange={e=>setOrigem(e.target.value)} options={["Indicação","Landing","Cold call","Inbound","Evento","WhatsApp","Porta a porta","Outros"]} />
            </Field>
            <Field label="Tag (opcional)">
              <Input full value={tag} onChange={e=>setTag(e.target.value)} placeholder="Pós-pago, Frota M2M, etc." />
            </Field>
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 6 }}>
            <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
            <Btn variant="primary" type="submit" disabled={busy || !empresa.trim() || !contato.trim()}>
              {busy ? "Salvando…" : editando ? "Salvar" : "Criar lead"}
            </Btn>
          </div>
        </form>
      </div>
    </div>
  );
}

/* === Motivo de perda (obrigatório ao mover para Perdido) === */
export function MotivoPerdaModal({ lead, onClose, onConfirm }: { lead: Pick<UiLead, "empresa">; onClose: () => void; onConfirm: (motivo: string) => Promise<void> | void }) {
  const [motivo, setMotivo] = useState<string>("");
  const [outro, setOutro] = useState("");
  const [busy, setBusy] = useState(false);
  const final = motivo === "Outro" ? outro.trim() : motivo;
  return (
    <div onClick={onClose} className="modal-backdrop" style={{
      position: "fixed", inset: 0, zIndex: 110,
      background: "oklch(0.10 0.04 250 / 0.45)", backdropFilter: "blur(2px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
    }}>
      <div onClick={e=>e.stopPropagation()} className="modal-shell fade-up" style={{
        width: 460, maxWidth: "100%", background: "var(--surface)", border: "1px solid var(--line-2)",
        borderRadius: 8, boxShadow: "var(--shadow-lg)",
      }}>
        <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--line)" }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>Por que este negócio foi perdido?</div>
          <div style={{ fontSize: 11.5, color: "var(--ink-3)", marginTop: 2 }}>{lead.empresa}</div>
        </div>
        <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 8 }}>
          {MOTIVOS_PERDA.map(m => (
            <label key={m} style={{
              display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", cursor: "pointer",
              border: `1px solid ${motivo === m ? "var(--navy)" : "var(--line-2)"}`, borderRadius: 6,
              background: motivo === m ? "var(--surface-2)" : "var(--surface)", fontSize: 13,
            }}>
              <input type="radio" name="motivo-perda" checked={motivo === m} onChange={() => setMotivo(m)} />
              {m}
            </label>
          ))}
          {motivo === "Outro" && (
            <Input full value={outro} onChange={e=>setOutro(e.target.value)} placeholder="Descreva o motivo" autoFocus />
          )}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
            <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
            <Btn variant="primary" disabled={busy || !final} onClick={async () => { setBusy(true); await onConfirm(final); setBusy(false); }}>
              {busy ? "Salvando…" : "Marcar como perdido"}
            </Btn>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Dias até o fim da fidelidade (negativo = já venceu). */
function diasParaFidelidade(fim: string | null | undefined): number | null {
  if (!fim) return null;
  const [y, m, d] = fim.split("-").map(Number);
  const alvo = new Date(y, m - 1, d);
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  return Math.round((alvo.getTime() - hoje.getTime()) / 86400000);
}

export function FidelidadeBadge({ fim }: { fim: string | null | undefined }) {
  const dias = diasParaFidelidade(fim);
  if (dias === null || dias > 60) return null;
  const vencida = dias < 0;
  return (
    <span title={`Fim da fidelidade: ${fim!.split("-").reverse().join("/")}`} style={{
      display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 7px", borderRadius: 4, fontSize: 11, fontWeight: 500,
      background: vencida ? "var(--green-soft, var(--surface-3))" : "var(--amber-soft)",
      color: vencida ? "var(--green)" : "var(--amber-text)",
      border: `1px solid ${vencida ? "var(--line)" : "var(--amber-border)"}`,
    }}>
      <Ic.Calendar size={11} />
      {vencida ? "Fidelidade vencida, sem multa" : dias === 0 ? "Fidelidade vence hoje" : `Fidelidade vence em ${dias}d`}
    </span>
  );
}

/* === Popup do lead (clique no card do kanban) === */
export function LeadQuickView({ lead: leadProp, onClose, onOpenFull, onOpenDesbloq }: {
  lead: UiLead;
  onClose: () => void;
  onOpenFull: (l: UiLead) => void;
  onOpenDesbloq?: () => void;
}) {
  const { profile } = useAuth();
  const [lead, setLead] = useState<UiLead>(leadProp);
  const { tarefas } = useLiveTarefas({ leadId: lead.id });
  const [notas, setNotas] = useState<Array<{ id: string; texto: string; tipo: string; created_at: string; autor: { nome: string } | null }> | null>(null);
  const [nota, setNota] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [perdendo, setPerdendo] = useState(false);
  const [editando, setEditando] = useState(false);
  const [agendando, setAgendando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [verArquivos, setVerArquivos] = useState(false);

  useEffect(() => { setLead(leadProp); }, [leadProp]);
  useEffect(() => { fetchLead(leadProp.id).then(l => { if (l) setLead(l); }); }, [leadProp.id]);

  const carregarNotas = async () => {
    const { data } = await supabase
      .from("notas")
      .select("id, texto, tipo, created_at, autor:profiles!notas_autor_id_fkey(nome)")
      .eq("lead_id", lead.id)
      .order("created_at", { ascending: false })
      .limit(4);
    setNotas((data ?? []) as never);
  };
  useEffect(() => {
    carregarNotas();
    const ch = supabase.channel(`quick-${lead.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "notas", filter: `lead_id=eq.${lead.id}` }, () => carregarNotas())
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "leads", filter: `id=eq.${lead.id}` }, (p) => setLead(prev => ({ ...prev, ...(p.new as UiLead) })))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lead.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !perdendo && !editando && !agendando) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, perdendo, editando, agendando]);

  const proxima = (tarefas ?? []).filter(t => !t.completed)[0];

  const mover = async (status: LeadStatus) => {
    if (status === lead.status) return;
    if (status === "perdido") { setPerdendo(true); return; }
    setLead(prev => ({ ...prev, status, motivo_perda: null }));
    const { error } = await updateLead(lead.id, { status, motivo_perda: null });
    if (error) { setErro(`Não foi possível mover: ${error}`); setLead(leadProp); } else setErro(null);
  };

  const contatar = (tipo: "ligacao" | "whatsapp" | "email") => {
    const url = tipo === "ligacao" ? `tel:+${normalizaTelefone(lead.telefone)}`
      : tipo === "whatsapp" ? waLink(lead.telefone!)
      : `mailto:${lead.email}`;
    window.open(url, tipo === "whatsapp" ? "_blank" : "_self");
    if (profile?.id) registrarContato(lead.id, profile.id, tipo);
  };

  const salvarNota = async () => {
    if (!nota.trim() || !profile?.id) return;
    setSalvando(true);
    const { error } = await supabase.from("notas").insert({ lead_id: lead.id, autor_id: profile.id, texto: nota.trim(), tipo: "nota", interno: false } as never);
    setSalvando(false);
    if (error) { setErro("Não foi possível salvar a anotação: " + error.message); return; }
    setNota("");
    carregarNotas();
  };

  const etapaIdx = PIPELINE_COMERCIAL.findIndex(p => p.id === lead.status);

  return (
    <div onClick={onClose} className="modal-backdrop" style={{
      position: "fixed", inset: 0, zIndex: 90,
      background: "oklch(0.10 0.04 250 / 0.45)", backdropFilter: "blur(2px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
    }}>
      {editando && <NovoLeadModal lead={lead} onClose={() => { setEditando(false); fetchLead(lead.id).then(l => { if (l) setLead(l); }); }} />}
      {agendando && <NovaTarefaModal leadId={lead.id} onClose={() => setAgendando(false)} />}
      {perdendo && (
        <MotivoPerdaModal lead={lead} onClose={() => setPerdendo(false)} onConfirm={async (motivo) => {
          const { error } = await updateLead(lead.id, { status: "perdido", motivo_perda: motivo });
          if (error) setErro(`Não foi possível mover: ${error}`);
          else setLead(prev => ({ ...prev, status: "perdido", motivo_perda: motivo }));
          setPerdendo(false);
        }} />
      )}
      <div onClick={e => e.stopPropagation()} className="modal-shell fade-up" style={{
        width: 720, maxWidth: "100%", maxHeight: "90vh",
        background: "var(--surface)", border: "1px solid var(--line-2)",
        borderRadius: 10, boxShadow: "var(--shadow-lg)",
        display: "flex", flexDirection: "column", overflow: "hidden",
      }}>
        {/* Cabeçalho */}
        <div style={{ padding: "16px 20px 12px", borderBottom: "1px solid var(--line)", display: "flex", gap: 12, alignItems: "flex-start" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 17, fontWeight: 600, color: "var(--ink)", letterSpacing: "-0.01em" }}>{lead.empresa}</div>
            <div style={{ marginTop: 4, display: "flex", gap: 10, flexWrap: "wrap", fontSize: 12.5, color: "var(--ink-3)" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><Ic.User size={12} />{lead.contato}</span>
              {lead.telefone && <span className="mono">{fmtTelefone(lead.telefone)}</span>}
              {(lead.cidade || lead.uf) && (
                <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lead.cidade ?? ""} ${lead.uf ?? ""}`)}`}
                  target="_blank" rel="noopener noreferrer" style={{ color: "var(--ink-3)", display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <Ic.Pin size={11} />{lead.cidade ?? ""}{lead.uf ? `/${lead.uf}` : ""}
                </a>
              )}
            </div>
            <div style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <OperadoraTag op={lead.operadora} />
              {lead.tag && <Badge>{lead.tag}</Badge>}
              {!["fechado", "perdido"].includes(lead.status) && <FidelidadeBadge fim={lead.fim_fidelidade} />}
              <span className="mono" style={{ fontSize: 13, fontWeight: 600 }}>{fmtBRL(Number(lead.valor || 0))}</span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
            <Btn variant="ghost" size="sm" icon={<Ic.Edit size={13} />} onClick={() => setEditando(true)}>Editar</Btn>
            <button onClick={onClose} aria-label="Fechar" style={{ background: "transparent", border: 0, color: "var(--ink-3)", cursor: "pointer", padding: 6 }}><Ic.X size={16} /></button>
          </div>
        </div>

        <div style={{ padding: "14px 20px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 16 }}>
          {erro && <div style={{ background: "var(--rose-soft)", border: "1px solid var(--rose-border)", color: "var(--rose)", padding: "8px 10px", borderRadius: 5, fontSize: 12.5 }}>{erro}</div>}

          {/* Linha do tempo do funil (clique para mover) */}
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink-4)", marginBottom: 6 }}>Etapa do funil</div>
            <div style={{ display: "flex", gap: 3 }}>
              {PIPELINE_COMERCIAL.map((s, i) => {
                const atual = s.id === lead.status;
                const passou = etapaIdx >= 0 && i < etapaIdx && !["perdido"].includes(lead.status);
                return (
                  <button key={s.id} onClick={() => mover(s.id)} title={`Mover para ${s.label}`} style={{
                    flex: 1, minWidth: 0, padding: "7px 4px", fontSize: 10.5, fontWeight: atual ? 600 : 500, cursor: "pointer",
                    border: `1px solid ${atual ? s.color : "var(--line)"}`,
                    background: atual ? s.color : passou ? "var(--surface-3)" : "var(--surface)",
                    color: atual ? "#fff" : passou ? "var(--ink-2)" : "var(--ink-3)",
                    borderRadius: i === 0 ? "5px 2px 2px 5px" : i === PIPELINE_COMERCIAL.length - 1 ? "2px 5px 5px 2px" : 2,
                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                  }}>{s.label}</button>
                );
              })}
            </div>
            {lead.status === "perdido" && lead.motivo_perda && (
              <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 6 }}>Motivo da perda: <strong>{lead.motivo_perda}</strong></div>
            )}
          </div>

          {/* Contato rápido */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Btn variant="ghost" size="sm" icon={<Ic.Whats size={13} />} disabled={!lead.telefone} onClick={() => contatar("whatsapp")}>WhatsApp</Btn>
            <Btn variant="ghost" size="sm" icon={<Ic.Phone size={13} />} disabled={!lead.telefone} onClick={() => contatar("ligacao")}>Ligar</Btn>
            <Btn variant="ghost" size="sm" icon={<Ic.Mail size={13} />} disabled={!lead.email} onClick={() => contatar("email")}>E-mail</Btn>
            {!lead.telefone && <span style={{ fontSize: 11.5, color: "var(--ink-4)", alignSelf: "center" }}>Cadastre o WhatsApp em Editar para habilitar os botões.</span>}
          </div>

          <div className="grid-2col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            {/* Próxima atividade */}
            <div style={{ border: "1px solid var(--line)", borderRadius: 6, padding: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 600 }}>Próxima atividade</span>
                <button onClick={() => setAgendando(true)} style={{ background: "transparent", border: 0, color: "var(--navy)", cursor: "pointer", fontSize: 12, fontWeight: 500 }}>+ Agendar</button>
              </div>
              {tarefas === null ? <span style={{ fontSize: 12, color: "var(--ink-4)" }}>Carregando…</span>
                : proxima ? (
                  <div style={{ fontSize: 12.5 }}>
                    <div style={{ fontWeight: 500 }}>
                      {proxima.tipo && proxima.tipo !== "tarefa" && <span style={{ color: "var(--ink-3)", marginRight: 6 }}>{TIPOS_ATIVIDADE.find(x => x.id === proxima.tipo)?.label}</span>}
                      {proxima.descricao}
                    </div>
                    <div style={{ marginTop: 4, color: proxima.urgencia === "atrasada" ? "var(--rose)" : "var(--ink-3)", fontSize: 11.5, display: "inline-flex", gap: 4, alignItems: "center" }}>
                      <Ic.Clock size={11} />
                      {proxima.quando ? new Date(proxima.quando).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "sem data"}
                      {proxima.urgencia === "atrasada" && " · atrasada"}
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: "var(--amber-text)" }}>Nenhuma atividade agendada para este lead.</div>
                )}
            </div>

            {/* Caso jurídico */}
            <div style={{ border: "1px solid var(--line)", borderRadius: 6, padding: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Jurídico</div>
              {lead.advox_caso_id ? (
                <div style={{ fontSize: 12.5, display: "flex", alignItems: "center", gap: 6 }}>
                  <Ic.Scale size={13} /> No jurídico
                  {lead.advox_caso && <StatusPill stage={lead.advox_caso.status} pipeline={PIPELINE_JURIDICO_DB} size="sm" />}
                </div>
              ) : onOpenDesbloq ? (
                <Btn variant="gold" size="sm" icon={<Ic.Unlock size={13} />} onClick={() => { onClose(); onOpenDesbloq(); }}>Indicar para Advox</Btn>
              ) : <span style={{ fontSize: 12, color: "var(--ink-4)" }}>Sem caso vinculado</span>}
            </div>
          </div>

          {/* Anotações */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Anotações</div>
            <div style={{ display: "flex", gap: 8 }}>
              <textarea value={nota} onChange={e => setNota(e.target.value)} placeholder="Escreva uma anotação…"
                onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) salvarNota(); }}
                style={{ flex: 1, minHeight: 44, border: "1px solid var(--line-2)", borderRadius: 6, padding: "8px 10px", fontFamily: "inherit", fontSize: 13, resize: "vertical", background: "var(--surface)", color: "var(--ink)" }} />
              <Btn variant="primary" size="sm" disabled={salvando || !nota.trim()} onClick={salvarNota}>{salvando ? "Salvando…" : "Salvar"}</Btn>
            </div>
            <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
              {notas === null ? <span style={{ fontSize: 12, color: "var(--ink-4)" }}>Carregando…</span>
                : notas.length === 0 ? <span style={{ fontSize: 12, color: "var(--ink-4)" }}>Nenhuma anotação ainda.</span>
                : notas.map(n => (
                  <div key={n.id} style={{ fontSize: 12.5, padding: "7px 10px", background: "var(--surface-2)", borderRadius: 5, border: "1px solid var(--line)" }}>
                    <div style={{ fontSize: 11, color: "var(--ink-4)", marginBottom: 2 }}>
                      {n.autor?.nome ?? "—"} · {new Date(n.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    </div>
                    <div style={{ whiteSpace: "pre-wrap" }}>{n.texto}</div>
                  </div>
                ))}
            </div>
          </div>

          {/* Arquivos */}
          <div>
            <button onClick={() => setVerArquivos(v => !v)} style={{ background: "transparent", border: 0, padding: 0, cursor: "pointer", fontSize: 12, fontWeight: 600, color: "var(--ink)", display: "inline-flex", alignItems: "center", gap: 6 }}>
              <Ic.Doc size={13} /> Arquivos do cliente <Ic.ChevronDown size={12} />
            </button>
            {verArquivos && <div style={{ marginTop: 8 }}><DocumentosLista parent={{ kind: "lead", id: lead.id }} /></div>}
          </div>
        </div>

        {/* Rodapé */}
        <div style={{ padding: "12px 20px", borderTop: "1px solid var(--line)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--surface-2)" }}>
          <span style={{ fontSize: 11.5, color: "var(--ink-4)" }}>Aberto em {new Date(lead.created_at).toLocaleDateString("pt-BR")} · {lead.rep?.nome ?? "—"}</span>
          <Btn variant="primary" size="sm" icon={<Ic.ArrowRight size={13} />} onClick={() => { onClose(); onOpenFull(lead); }}>Abrir cadastro completo</Btn>
        </div>
      </div>
    </div>
  );
}

/* === Lead detail === */
export function RepLeadDetail({ lead: leadProp, onBack, onOpenDesbloq }: { lead: UiLead; onBack: () => void; onOpenDesbloq: () => void }) {
  const { profile } = useAuth();
  const [tab, setTab] = useState("historico");
  const [editando, setEditando] = useState(false);
  const [perdendo, setPerdendo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  // Re-busca lead atualizado em tempo real (segue mudanças remotas)
  const [lead, setLead] = useState<UiLead>(leadProp);
  const { casos } = useLiveCasos();
  const caso = (casos ?? []).find(c => c.lead_id === lead.id);

  useEffect(() => { fetchLead(leadProp.id).then(l => { if (l) setLead(l); }); }, [leadProp.id]);

  useEffect(() => {
    const ch = supabase.channel(`lead-detail-${lead.id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "leads", filter: `id=eq.${lead.id}` }, (payload) => {
        setLead(prev => ({ ...prev, ...(payload.new as UiLead) }));
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [lead.id]);

  const contatar = (tipo: "ligacao" | "whatsapp" | "email") => {
    const url = tipo === "ligacao" ? `tel:+${normalizaTelefone(lead.telefone)}`
      : tipo === "whatsapp" ? waLink(lead.telefone!)
      : `mailto:${lead.email}`;
    window.open(url, tipo === "whatsapp" ? "_blank" : "_self");
    if (profile?.id) registrarContato(lead.id, profile.id, tipo);
  };

  const mover = async (status: LeadStatus) => {
    if (status === lead.status) return;
    if (status === "perdido") { setPerdendo(true); return; }
    const { error } = await updateLead(lead.id, { status, motivo_perda: null });
    setErro(error ? `Não foi possível mover: ${error}` : null);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {editando && <NovoLeadModal lead={lead} onClose={() => { setEditando(false); fetchLead(lead.id).then(l => { if (l) setLead(l); }); }} />}
      {perdendo && (
        <MotivoPerdaModal lead={lead} onClose={() => setPerdendo(false)} onConfirm={async (motivo) => {
          const { error } = await updateLead(lead.id, { status: "perdido", motivo_perda: motivo });
          setErro(error ? `Não foi possível mover: ${error}` : null);
          setPerdendo(false);
        }} />
      )}
      <div style={{ padding: "12px 18px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", gap: 10, background: "var(--surface-2)" }}>
        <button onClick={onBack} style={{ background: "transparent", border: 0, color: "var(--ink-2)", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5, padding: 4, fontSize: 12.5 }}>
          <Ic.ArrowLeft size={13} /> Leads
        </button>
        <span style={{ color: "var(--ink-4)" }}>/</span>
        <span style={{ fontSize: 14, color: "var(--ink)" }}>{lead.empresa}</span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <Btn variant="ghost" size="sm" icon={<Ic.Phone size={13} />} disabled={!lead.telefone}
            title={lead.telefone ? `Ligar para ${fmtTelefone(lead.telefone)}` : "Cadastre o telefone do contato"}
            onClick={() => contatar("ligacao")}>Ligar</Btn>
          <Btn variant="ghost" size="sm" icon={<Ic.Whats size={13} />} disabled={!lead.telefone}
            title={lead.telefone ? `Abrir conversa com ${fmtTelefone(lead.telefone)}` : "Cadastre o WhatsApp do contato"}
            onClick={() => contatar("whatsapp")}>WhatsApp</Btn>
          <Btn variant="ghost" size="sm" icon={<Ic.Mail size={13} />} disabled={!lead.email}
            title={lead.email ?? "Cadastre o e-mail do contato"}
            onClick={() => contatar("email")}>Email</Btn>
          <Btn variant="ghost" size="sm" icon={<Ic.Edit size={13} />} onClick={() => setEditando(true)}>Editar</Btn>
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
              <h1 className="page-title" style={{ margin: 0, fontSize: 26, fontWeight: 600 }}>{lead.empresa}</h1>
              <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 10, fontSize: 12.5, color: "var(--ink-3)", flexWrap: "wrap" }}>
                {lead.cnpj && <><span><span className="mono">{lead.cnpj}</span></span><span>·</span></>}
                {(lead.cidade || lead.uf) && <><span>{lead.cidade ?? ""}{lead.uf ? `/${lead.uf}` : ""}</span><span>·</span></>}
                <span>Origem: {lead.origem ?? "—"}</span>
              </div>
              <div style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <StatusPillDB stage={lead.status} />
                <OperadoraTag op={lead.operadora} />
                {lead.tag && <Badge>{lead.tag}</Badge>}
                {!["fechado", "perdido"].includes(lead.status) && <FidelidadeBadge fim={lead.fim_fidelidade} />}
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
                <div style={{ fontSize: 13.5, color: "var(--gold-deep)", fontWeight: 500 }}>Caso jurídico vinculado</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", marginTop: 2 }}>
                  {caso.advogado?.nome ? `Advogado: ${caso.advogado.nome}` : "Esperando um advogado ser designado"}
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
            {erro && <div style={{ background: "var(--rose-soft)", border: "1px solid var(--rose-border)", color: "var(--rose)", padding: "8px 10px", borderRadius: 5, fontSize: 12, marginBottom: 8 }}>{erro}</div>}
            <div style={{ fontSize: 12, color: "var(--ink-3)", marginBottom: 8, fontWeight: 500 }}>Mover para</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {PIPELINE_COMERCIAL.map(s => {
                const isCurrent = lead.status === s.id;
                return (
                  <button key={s.id} onClick={() => mover(s.id)} style={{
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
            <KV k="WhatsApp" v={lead.telefone ? fmtTelefone(lead.telefone) : <span style={{ color: "var(--ink-4)" }}>não informado</span>} mono={!!lead.telefone} />
            <KV k="E-mail" v={lead.email ?? <span style={{ color: "var(--ink-4)" }}>não informado</span>} />
            {lead.cnpj && <KV k="CNPJ" v={lead.cnpj} mono />}
            {(lead.cidade || lead.uf) && <KV k="Localização" v={`${lead.cidade ?? ""}${lead.uf ? `/${lead.uf}` : ""}`} />}
          </SidebarBlock>
          <SidebarBlock title="Comercial">
            <KV k="Valor estimado" v={fmtBRL(Number(lead.valor || 0))} mono />
            <KV k="Operadora atual" v={<OperadoraTag op={lead.operadora} size="sm" />} />
            <KV k="Fim da fidelidade" v={lead.fim_fidelidade ? lead.fim_fidelidade.split("-").reverse().join("/") : "—"} />
            {lead.status === "perdido" && <KV k="Motivo da perda" v={lead.motivo_perda ?? "—"} />}
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
    const { error } = await supabase.from("notas").insert({
      lead_id: leadId, autor_id: profile.id, texto: novo.trim(), tipo: tipoNovo, interno: false,
    } as never);
    setBusy(false);
    if (error) { window.alert("Não foi possível salvar a nota: " + error.message); return; }
    setNovo("");
    load();
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
  const [nova, setNova] = useState(false);
  const pendentes = (tarefas ?? []).filter(t => !t.completed);
  const feitas = (tarefas ?? []).filter(t => t.completed);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 12.5, color: "var(--ink-3)" }}>
          {tarefas === null ? "Carregando…" : pendentes.length ? `${pendentes.length} pendente(s)` : "Nenhuma atividade agendada"}
        </span>
        <Btn variant="primary" size="sm" icon={<Ic.Plus size={12} />} onClick={() => setNova(true)}>Agendar atividade</Btn>
      </div>
      {tarefas !== null && tarefas.length === 0 ? (
        <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 6 }}>
          <Empty icon={<Ic.Check size={18} />} title="Nenhuma atividade para este lead" hint="Agende a próxima ligação, visita ou reunião." />
        </div>
      ) : tarefas !== null && (
        <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 6, overflow: "hidden" }}>
          {[...pendentes, ...feitas].map(t => <TarefaRowLive key={t.id} t={t} />)}
        </div>
      )}
      {nova && <NovaTarefaModal leadId={leadId} onClose={() => setNova(false)} />}
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
      {t.tipo && t.tipo !== "tarefa" && (
        <span title={TIPOS_ATIVIDADE.find(x => x.id === t.tipo)?.label} style={{ color: "var(--ink-3)", display: "inline-flex", flexShrink: 0 }}>
          {t.tipo === "ligacao" ? <Ic.Phone size={13} /> : t.tipo === "whatsapp" ? <Ic.Whats size={13} /> : t.tipo === "email" ? <Ic.Mail size={13} /> : t.tipo === "visita" ? <Ic.Pin size={13} /> : <Ic.Users size={13} />}
        </span>
      )}
      <div style={{ flex: 1, fontSize: 13, color: "var(--ink)", textDecoration: done ? "line-through" : "none" }}>
        {t.tipo && t.tipo !== "tarefa" && <span style={{ fontSize: 11, color: "var(--ink-3)", marginRight: 6, fontWeight: 500 }}>{TIPOS_ATIVIDADE.find(x => x.id === t.tipo)?.label}</span>}
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
  const { tarefas, error } = useLiveTarefas({ autorId: profile?.id });
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
          <h1 className="page-title" style={{ margin: 0, fontSize: 26, fontWeight: 600 }}>Tarefas</h1>
          <div style={{ fontSize: 13, color: "var(--ink-3)", marginTop: 4 }}>
            {tarefas === null ? "Carregando…" : `${(tarefas ?? []).filter(t => !t.completed).length} pendentes`}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Btn variant="primary" size="sm" icon={<Ic.Plus size={13} />} onClick={() => setShowNova(true)}>Nova tarefa</Btn>
        </div>
      </header>

      {error && (
        <div style={{ background: "var(--rose-soft)", border: "1px solid var(--rose-border)", color: "var(--rose)", padding: "10px 14px", borderRadius: 5, fontSize: 12.5 }}>
          Erro ao carregar tarefas: {error}
        </div>
      )}
      {tarefas === null ? (
        <div style={{ padding: 40, textAlign: "center", color: "var(--ink-3)", fontSize: 13 }}>Carregando tarefas…</div>
      ) : (tarefas ?? []).length === 0 ? (
        <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 6 }}>
          <Empty icon={<Ic.Check size={20} />} title="Nenhuma tarefa ainda" hint="Crie uma tarefa para não esquecer o próximo contato." action={<Btn variant="primary" size="sm" icon={<Ic.Plus size={12} />} onClick={() => setShowNova(true)}>Nova tarefa</Btn>} />
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

export function NovaTarefaModal({ onClose, leadId: leadFixo }: { onClose: () => void; leadId?: string }) {
  const { profile } = useAuth();
  const { leads } = useLiveLeads({ repId: profile?.id });
  const [desc, setDesc] = useState("");
  const [leadId, setLeadId] = useState<string>(leadFixo ?? "");
  const [tipo, setTipo] = useState<TipoAtividade>("ligacao");
  const [prioridade, setPrioridade] = useState<"alta"|"media"|"baixa">("media");
  const [urgencia, setUrgencia] = useState<"atrasada"|"hoje"|"semana"|"proxima">("hoje");
  const [quando, setQuando] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.id) return;
    if (!leadId) { setErr("Selecione o lead da tarefa."); return; }
    setBusy(true);
    setErr(null);
    const { error } = await supabase.from("tarefas").insert({
      autor_id: profile.id,
      lead_id: leadId,
      descricao: desc.trim(),
      // datetime-local não tem fuso: converte do horário local para ISO (UTC)
      quando: quando ? new Date(quando).toISOString() : null,
      prioridade,
      urgencia,
      tipo,
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
          <Field label="Tipo">
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {TIPOS_ATIVIDADE.map(ti => (
                <button type="button" key={ti.id} onClick={() => setTipo(ti.id)} style={{
                  padding: "6px 11px", borderRadius: 5, fontSize: 12, fontWeight: 500, cursor: "pointer",
                  border: `1.5px solid ${tipo === ti.id ? "var(--navy)" : "var(--line-2)"}`,
                  background: tipo === ti.id ? "var(--navy)" : "var(--surface)",
                  color: tipo === ti.id ? "var(--navy-ink)" : "var(--ink)",
                }}>{ti.label}</button>
              ))}
            </div>
          </Field>
          <Field label="Descrição">
            <Input full value={desc} onChange={e=>setDesc(e.target.value)} placeholder="Ligar para cliente, enviar proposta…" autoFocus />
          </Field>
          {!leadFixo && (
            <Field label="Lead vinculado">
              <Select value={leadId} onChange={e=>setLeadId(e.target.value)} options={[
                { value: "", label: "Selecione…" },
                ...((leads ?? []).map(l => ({ value: l.id, label: l.empresa }))),
              ]} />
            </Field>
          )}
          <div className="grid-2col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Quando" hint="A urgência é calculada pela data">
              <Input full type="datetime-local" value={quando} onChange={e=>setQuando(e.target.value)} placeholder="" />
            </Field>
            <Field label="Prioridade">
              <Select value={prioridade} onChange={e=>setPrioridade(e.target.value as "alta"|"media"|"baixa")} options={["alta","media","baixa"]} />
            </Field>
          </div>
          {!quando && (
            <Field label="Urgência (quando não há data)">
              <Select value={urgencia} onChange={e=>setUrgencia(e.target.value as "atrasada"|"hoje"|"semana"|"proxima")} options={["hoje","semana","proxima"]} />
            </Field>
          )}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 6 }}>
            <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
            <Btn variant="primary" type="submit" disabled={busy || !desc.trim() || !leadId}>{busy ? "Salvando…" : "Criar tarefa"}</Btn>
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
        <h1 className="page-title" style={{ margin: 0, fontSize: 26, fontWeight: 600 }}>Leads no jurídico</h1>
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
          <Empty icon={<Ic.Scale size={20} />} title="Nenhum caso jurídico ainda" hint="Use Desbloquear cliente para indicar um lead ao escritório." />
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: "var(--surface-2)", borderBottom: "1px solid var(--line)" }}>
                {["Cliente", "Etapa no jurídico", "Advogado", "Próximo passo", "Multa", ""].map(h => (
                  <th key={h} style={{ textAlign: "left", padding: "9px 12px", fontWeight: 500, color: "var(--ink-3)", fontSize: 13.5 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(casos ?? []).map(c => {
                const lead = (leads ?? []).find(l => l.id === c.lead_id);
                return (
                  <tr key={c.id} onClick={() => lead && onOpenLead(lead)} style={{ borderBottom: "1px solid var(--line)", cursor: lead ? "pointer" : "default" }}
                    onMouseEnter={e=>e.currentTarget.style.background="var(--hover)"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
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
