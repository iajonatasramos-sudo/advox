import React, { useState, useEffect } from "react";
import { Ic } from "./icons";
import {
  Btn, Badge, StatusPill, Avatar, KPI, Input, OperadoraTag, Section, Tabs, Empty,
  KV, SidebarBlock,
} from "./ui";
import { useAuth } from "./auth";
import { supabase } from "./lib/supabase";
import type { CasoStatus } from "./lib/database.types";
import {
  useLiveCasos, fmtBRL, PIPELINE_JURIDICO_DB, updateCaso,
  type UiCaso,
} from "./lib/data-live";
import { DocumentosLista } from "./docs";

export type Caso = UiCaso;

const PIPELINE_JURIDICO = PIPELINE_JURIDICO_DB;

const VISIBLE_COLS: CasoStatus[] = ["recebido","analise","contato","honorarios","contratou","documentacao","extrajudicial","judicial","liberado"];

export function AdvDashboard({ onOpenCaso }: { onOpenCaso: (c: UiCaso) => void }) {
  const { profile } = useAuth();
  const { casos } = useLiveCasos({ advogadoId: profile?.id });
  const overdue = (casos ?? []).filter(c => c.sla_dias > 5 && !["liberado","naoliberado","recusou"].includes(c.status));

  const counts = (status: CasoStatus | CasoStatus[]) => {
    const list = Array.isArray(status) ? status : [status];
    return (casos ?? []).filter(c => list.includes(c.status)).length;
  };

  return (
    <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 14 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, letterSpacing: "-0.015em" }}>
              Bom dia{profile?.nome ? `, ${profile.nome.split(" ")[0]}` : ""}.
            </h1>
            <div style={{ fontSize: 13, color: "var(--ink-3)", marginTop: 4 }}>
              {casos === null ? "Carregando…" : <>{(casos ?? []).length} casos sob sua responsabilidade{overdue.length > 0 && <> · <strong style={{ color: "var(--rose)" }}>{overdue.length} casos parados há mais de 5 dias</strong></>}</>}
            </div>
          </div>
        </div>
        <div className="grid-kpi" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
          <KPI label="Atribuídos" valor={String((casos ?? []).filter(c => !["liberado","naoliberado","recusou"].includes(c.status)).length)} delta="em andamento" trend="neutral" icon={<Ic.Briefcase size={14} />} />
          <KPI label="Em análise" valor={String(counts("analise"))} delta="—" trend="neutral" icon={<Ic.Search size={14} />} />
          <KPI label="Em contato" valor={String(counts(["contato","honorarios"]))} delta="—" trend="neutral" icon={<Ic.Whats size={14} />} />
          <KPI label="Liberados" valor={String(counts("liberado"))} delta="resolvidos" trend="up" icon={<Ic.CheckCircle size={14} />} />
        </div>
      </div>

      {overdue.length > 0 && (
        <div style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "12px 16px",
          background: "linear-gradient(180deg, var(--rose-soft), oklch(0.96 0.02 25))",
          border: "1px solid oklch(0.85 0.05 25)",
          borderRadius: 6,
        }}>
          <span style={{
            width: 32, height: 32, borderRadius: 6,
            background: "oklch(0.93 0.06 25)", color: "var(--rose)",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
          }}><Ic.Warn size={16} /></span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{overdue.length} casos parados há mais de 5 dias</div>
            <div style={{ fontSize: 12, color: "var(--ink-2)", marginTop: 2 }}>
              {overdue.slice(0, 3).map(c => `${c.id.slice(0,8)} · ${c.lead?.empresa ?? "—"}`).join(" · ")}
            </div>
          </div>
        </div>
      )}

      <div className="toolbar-row" style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "10px 12px",
        background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 6,
      }}>
        <Input icon={<Ic.Search size={13} />} placeholder="Buscar por cliente…" value="" onChange={()=>{}} />
        <div style={{ marginLeft: "auto", fontSize: 11.5, color: "var(--ink-3)", display: "inline-flex", alignItems: "center", gap: 4 }}>
          <Ic.Info size={11} /> Arraste cards entre colunas para atualizar status.
        </div>
      </div>

      <AdvKanban onOpenCaso={onOpenCaso} casos={casos} />
    </div>
  );
}

function AdvKanban({ onOpenCaso, casos }: { onOpenCaso: (c: UiCaso) => void; casos: UiCaso[] | null }) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  const handleDrop = async (newStatus: CasoStatus, casoId: string) => {
    await updateCaso(casoId, { status: newStatus });
  };

  if (casos === null) {
    return <div style={{ padding: 40, textAlign: "center", color: "var(--ink-3)", fontSize: 13 }}>Carregando casos…</div>;
  }

  if (casos.length === 0) {
    return (
      <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 6 }}>
        <Empty icon={<Ic.Scale size={20} />} title="Nenhum caso atribuído ainda" hint="Quando representantes indicarem clientes via 'Desbloquear Cliente', os casos aparecem aqui após atribuição do Admin." />
      </div>
    );
  }

  const visibleCols = PIPELINE_JURIDICO.filter(c => VISIBLE_COLS.includes(c.id as CasoStatus));
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${visibleCols.length}, minmax(240px, 1fr))`, gap: 10, overflowX: "auto" }}>
      {visibleCols.map(col => {
        const items = casos.filter(c => c.status === col.id);
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
              const id = e.dataTransfer.getData("text/caso-id");
              if (id) handleDrop(col.id as CasoStatus, id);
              setDragId(null); setDropTarget(null);
            }}
            style={{
              background: isTarget ? "var(--gold-soft)" : "var(--surface-2)",
              border: `1px ${isTarget ? "dashed" : "solid"} ${isTarget ? "var(--gold-border)" : "var(--line)"}`,
              borderRadius: 6,
              display: "flex", flexDirection: "column",
              minHeight: 380, maxHeight: "calc(100vh - 360px)",
              transition: "background 100ms, border-color 100ms",
            }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderBottom: "1px solid var(--line)" }}>
              <span style={{ width: 6, height: 6, borderRadius: 99, background: col.color }} />
              <span style={{ fontSize: 12, fontWeight: 600 }}>{col.label}</span>
              <span style={{ fontSize: 11, color: "var(--ink-4)" }}>{items.length}</span>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: 8, display: "flex", flexDirection: "column", gap: 8 }}>
              {items.map(c => (
                <CasoCard key={c.id} caso={c} onClick={() => onOpenCaso(c)}
                  onDragStart={e => {
                    e.dataTransfer.setData("text/caso-id", c.id);
                    e.dataTransfer.effectAllowed = "move";
                    setDragId(c.id);
                  }}
                  onDragEnd={() => { setDragId(null); setDropTarget(null); }}
                  isDragging={dragId === c.id}
                />
              ))}
              {items.length === 0 && <div style={{ padding: 20, fontSize: 11.5, color: "var(--ink-4)", textAlign: "center" }}>{isTarget ? "Solte aqui" : "Vazio"}</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CasoCard({ caso, onClick, onDragStart, onDragEnd, isDragging }: {
  caso: UiCaso;
  onClick: () => void;
  onDragStart?: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragEnd?: () => void;
  isDragging?: boolean;
}) {
  const overdue = caso.sla_dias > 5;
  return (
    <div
      onClick={onClick}
      draggable={!!onDragStart}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className="grab"
      style={{
        background: "var(--surface)",
        border: `1px solid ${overdue ? "oklch(0.80 0.08 25)" : "var(--line)"}`,
        borderRadius: 5, padding: "10px 11px",
        display: "flex", flexDirection: "column", gap: 7,
        cursor: onDragStart ? "grab" : "pointer",
        opacity: isDragging ? 0.4 : 1,
        transition: "box-shadow 80ms, opacity 100ms",
      }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span className="mono" style={{ fontSize: 10.5, color: "var(--ink-3)", fontWeight: 500 }}>{caso.id.slice(0, 8)}</span>
        {caso.lead?.operadora && <OperadoraTag op={caso.lead.operadora} />}
      </div>
      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{caso.lead?.empresa ?? "—"}</div>
      <div style={{ fontSize: 11.5, color: "var(--ink-3)" }}>{caso.lead?.contato}{caso.lead?.uf ? ` · ${caso.lead.uf}` : ""}</div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 6, borderTop: "1px dashed var(--line)", marginTop: 2 }}>
        <span style={{ fontSize: 11, color: overdue ? "var(--rose)" : "var(--ink-3)", display: "inline-flex", alignItems: "center", gap: 4, fontWeight: overdue ? 500 : 400 }}>
          <Ic.Clock size={10} /> {caso.dias_indicacao}d desde indicação
        </span>
        <span className="mono" style={{ fontSize: 11, color: "var(--ink-3)" }}>{fmtBRL(Number(caso.multa || 0))}</span>
      </div>
    </div>
  );
}

/* === Caso detail === */
export function AdvCasoDetail({ caso: casoProp, onBack }: { caso: UiCaso; onBack: () => void }) {
  const [tab, setTab] = useState("timeline");
  const [caso, setCaso] = useState<UiCaso>(casoProp);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const ch = supabase.channel(`caso-detail-${caso.id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "casos", filter: `id=eq.${caso.id}` }, (payload) => {
        setCaso(prev => ({ ...prev, ...(payload.new as UiCaso) }));
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [caso.id]);

  const changeStatus = async (s: CasoStatus) => {
    setBusy(true);
    await updateCaso(caso.id, { status: s });
    setBusy(false);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ padding: "12px 18px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", gap: 10, background: "var(--surface-2)" }}>
        <button onClick={onBack} style={{ background: "transparent", border: 0, color: "var(--ink-2)", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5, padding: 4, fontSize: 12.5 }}>
          <Ic.ArrowLeft size={13} /> Pipeline
        </button>
        <span style={{ color: "var(--ink-4)" }}>/</span>
        <span className="mono" style={{ fontSize: 12, color: "var(--ink-3)" }}>{caso.id.slice(0, 8)}</span>
        <span style={{ color: "var(--ink-4)" }}>·</span>
        <span style={{ fontSize: 13, color: "var(--ink)" }}>{caso.lead?.empresa ?? "—"}</span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: 11.5, color: "var(--ink-3)" }}>SLA atual</span>
          <span style={{
            fontSize: 12, fontWeight: 600,
            color: caso.sla_dias > 5 ? "var(--rose)" : "var(--ink)",
            padding: "3px 8px",
            background: caso.sla_dias > 5 ? "var(--rose-soft)" : "var(--surface-3)",
            border: `1px solid ${caso.sla_dias > 5 ? "oklch(0.85 0.05 25)" : "var(--line)"}`,
            borderRadius: 4,
          }} className="mono">{caso.sla_dias}d no status</span>
        </div>
      </div>

      <div className="grid-detail" style={{ display: "grid", gridTemplateColumns: "1fr 360px", flex: 1, overflow: "hidden" }}>
        <div style={{ overflow: "auto", padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 8 }}>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, letterSpacing: "-0.015em" }}>{caso.lead?.empresa ?? "—"}</h1>
              <span className="mono" style={{ fontSize: 12, color: "var(--ink-4)" }}>{caso.id.slice(0, 8)}</span>
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <StatusPill stage={caso.status} pipeline={PIPELINE_JURIDICO_DB} />
              {caso.lead?.operadora && <OperadoraTag op={caso.lead.operadora} />}
              <Badge>{caso.tipo}</Badge>
              <span style={{ fontSize: 12.5, color: "var(--ink-2)" }}>Multa estimada: <span className="mono" style={{ fontWeight: 600 }}>{fmtBRL(Number(caso.multa || 0))}</span></span>
            </div>
          </div>

          {/* Status update */}
          <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 6, padding: 14 }}>
            <div style={{ fontSize: 12, color: "var(--ink-3)", marginBottom: 8, fontWeight: 500 }}>Atualizar status</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {VISIBLE_COLS.concat(["naoliberado","recusou"] as CasoStatus[]).map(s => {
                const stage = PIPELINE_JURIDICO_DB.find(p => p.id === s)!;
                const isCurrent = caso.status === s;
                return (
                  <button key={s} disabled={busy || isCurrent} onClick={() => changeStatus(s)} style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    padding: "5px 10px",
                    border: `1px solid ${isCurrent ? "var(--navy)" : "var(--line-2)"}`,
                    background: isCurrent ? "var(--navy)" : "var(--surface)",
                    color: isCurrent ? "var(--navy-ink)" : "var(--ink)",
                    borderRadius: 5,
                    fontSize: 11.5, fontWeight: 500, cursor: isCurrent ? "default" : "pointer",
                  }}>
                    <span style={{ width: 6, height: 6, borderRadius: 99, background: stage.color }} />
                    {stage.label}
                  </button>
                );
              })}
            </div>
          </div>

          <Tabs active={tab} onChange={setTab} tabs={[
            { id: "timeline", label: "Timeline", icon: <Ic.Clock size={13} /> },
            { id: "documentos", label: "Documentos", icon: <Ic.Doc size={13} /> },
            { id: "honorarios", label: "Honorários", icon: <Ic.Money size={13} /> },
          ]} />

          {tab === "timeline" && <CasoNotas casoId={caso.id} />}
          {tab === "documentos" && <DocumentosLista parent={{ kind: "caso", id: caso.id }} />}
          {tab === "honorarios" && (
            <div className="grid-2col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <Section title="Honorários iniciais" dense>
                <KV k="Valor" v={caso.valor_honorarios ? fmtBRL(Number(caso.valor_honorarios)) : "Não definido"} mono />
                <KV k="Devido por" v="Cliente final" />
              </Section>
              <Section title="Honorários de êxito" dense>
                <KV k="Percentual" v="20% sobre êxito (config futura)" />
                <KV k="Valor estimado" v={fmtBRL(Number(caso.multa || 0) * 0.20)} mono />
              </Section>
            </div>
          )}
        </div>

        <aside style={{ borderLeft: "1px solid var(--line)", background: "var(--surface-2)", overflow: "auto" }}>
          <SidebarBlock title="Cliente final">
            <KV k="Empresa" v={caso.lead?.empresa ?? "—"} />
            <KV k="Contato" v={caso.lead?.contato ?? "—"} />
            <KV k="Localização" v={`${caso.lead?.cidade ?? ""}${caso.lead?.uf ? `/${caso.lead.uf}` : ""}`} />
          </SidebarBlock>
          <SidebarBlock title="SLA">
            <KV k="Status atual" v={<span className="mono">{caso.sla_dias}d</span>} />
            <KV k="Total do caso" v={<span className="mono">{caso.dias_indicacao}d</span>} />
            <KV k="Aberto em" v={new Date(caso.created_at).toLocaleDateString("pt-BR")} />
          </SidebarBlock>
        </aside>
      </div>
    </div>
  );
}

function CasoNotas({ casoId }: { casoId: string }) {
  const { profile } = useAuth();
  const [notas, setNotas] = useState<Array<{ id: string; texto: string; tipo: string; interno: boolean; created_at: string; autor: { nome: string } | null }> | null>(null);
  const [novo, setNovo] = useState("");
  const [interno, setInterno] = useState(true);

  const load = async () => {
    const { data } = await supabase.from("notas").select("id, texto, tipo, interno, created_at, autor:profiles!notas_autor_id_fkey(nome)")
      .eq("caso_id", casoId).order("created_at", { ascending: false });
    setNotas((data ?? []) as never);
  };
  useEffect(() => { load(); }, [casoId]);
  useEffect(() => {
    const ch = supabase.channel(`notas-caso-${casoId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "notas", filter: `caso_id=eq.${casoId}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [casoId]);

  const submit = async () => {
    if (!novo.trim() || !profile?.id) return;
    await supabase.from("notas").insert({ caso_id: casoId, autor_id: profile.id, texto: novo.trim(), tipo: "nota", interno } as never);
    setNovo("");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 6, padding: 12 }}>
        <textarea value={novo} onChange={e=>setNovo(e.target.value)} placeholder="Adicionar nota…"
          style={{ width: "100%", minHeight: 56, border: 0, outline: 0, resize: "vertical", fontFamily: "inherit", fontSize: 13, lineHeight: 1.5, background: "transparent" }} />
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
          <label style={{ fontSize: 11.5, color: "var(--ink-2)", display: "inline-flex", alignItems: "center", gap: 5 }}>
            <input type="checkbox" checked={interno} onChange={e=>setInterno(e.target.checked)} /> Nota interna (só visível para o time jurídico)
          </label>
          <Btn variant="primary" size="sm" style={{ marginLeft: "auto" }} onClick={submit} disabled={!novo.trim()}>Adicionar</Btn>
        </div>
      </div>
      <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 6 }}>
        {notas === null ? <div style={{ padding: 20, textAlign: "center", color: "var(--ink-3)", fontSize: 12.5 }}>Carregando…</div>
          : notas.length === 0 ? <Empty icon={<Ic.Clock size={18} />} title="Sem notas ainda" />
          : notas.map((n, i) => (
            <div key={n.id} style={{ display: "flex", gap: 12, padding: "12px 14px", borderBottom: i < notas.length - 1 ? "1px solid var(--line)" : 0, background: n.interno ? "oklch(0.97 0.03 80 / 0.5)" : "transparent" }}>
              <span style={{ width: 22, height: 22, borderRadius: 99, background: n.interno ? "var(--gold-soft)" : "var(--surface-3)", border: "1px solid var(--line)", display: "inline-flex", alignItems: "center", justifyContent: "center", color: n.interno ? "var(--gold-deep)" : "var(--ink-2)" }}>
                <Ic.Pin size={11} />
              </span>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
                  <span style={{ fontSize: 12.5, fontWeight: 500 }}>{n.autor?.nome ?? "—"}</span>
                  <span style={{ fontSize: 11, color: "var(--ink-4)" }}>{new Date(n.created_at).toLocaleString("pt-BR")}</span>
                  {n.interno && <Badge bg="var(--gold-soft)" border="var(--gold-border)" color="var(--gold-deep)">Interno</Badge>}
                </div>
                <div style={{ fontSize: 12.5, color: "var(--ink-2)", lineHeight: 1.5, marginTop: 3 }}>{n.texto}</div>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}

/* === Prazos === */
export function AdvPrazos() {
  const { profile } = useAuth();
  const [prazos, setPrazos] = useState<Array<{ id: string; tipo: string; descricao: string | null; data: string; local: string | null; status: string; caso_id: string }> | null>(null);

  useEffect(() => {
    if (!profile?.id) return;
    // Prazos dos casos do advogado logado
    supabase.from("prazos").select("id, tipo, descricao, data, local, status, caso_id, caso:casos!prazos_caso_id_fkey(advogado_id)")
      .order("data", { ascending: true })
      .then(({ data }) => {
        type Row = { id: string; tipo: string; descricao: string | null; data: string; local: string | null; status: string; caso_id: string; caso: { advogado_id: string | null } | null };
        const rows = (data ?? []) as unknown as Row[];
        const meus = rows.filter(p => p.caso?.advogado_id === profile.id);
        setPrazos(meus);
      });
  }, [profile?.id]);

  return (
    <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 16 }}>
      <header>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, letterSpacing: "-0.015em" }}>Prazos</h1>
        <div style={{ fontSize: 13, color: "var(--ink-3)", marginTop: 4 }}>{prazos === null ? "Carregando…" : `${prazos.length} prazos vinculados aos seus casos`}</div>
      </header>

      {prazos === null ? <div style={{ padding: 40, textAlign: "center", color: "var(--ink-3)", fontSize: 13 }}>Carregando…</div>
        : prazos.length === 0 ? (
          <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 6 }}>
            <Empty icon={<Ic.Calendar size={20} />} title="Nenhum prazo ainda" hint="Prazos podem ser cadastrados no detalhe de cada caso (em breve)." />
          </div>
        ) : (
          <Section title="Próximos prazos" noPad>
            {prazos.map((p, i) => (
              <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 16px", borderBottom: i < prazos.length - 1 ? "1px solid var(--line)" : 0 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 6,
                  background: "var(--surface-3)", border: "1px solid var(--line)",
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                }}>
                  <span style={{ fontSize: 14, fontWeight: 700 }} className="mono">{new Date(p.data).getDate()}</span>
                  <span style={{ fontSize: 9, textTransform: "uppercase" }}>{["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"][new Date(p.data).getMonth()]}</span>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{p.tipo}</div>
                  <div style={{ fontSize: 11.5, color: "var(--ink-3)", marginTop: 3 }}>
                    <span className="mono">{p.caso_id.slice(0, 8)}</span> {p.local && `· ${p.local}`}
                  </div>
                </div>
                <Badge>{p.status}</Badge>
              </div>
            ))}
          </Section>
        )}
    </div>
  );
}
