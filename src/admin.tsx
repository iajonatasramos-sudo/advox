import React, { useState, useEffect } from "react";
import { Ic } from "./icons";
import {
  Btn, Badge, StatusPill, Avatar, KPI, Input, OperadoraTag, Section, MiniBars, BrazilHeatmap, Empty,
  Field,
} from "./ui";
import { RepLista } from "./rep";
import {
  ADVOGADOS, REPRESENTANTES, AUDITORIA, HEATMAP, TOP_REPS, TOP_ADV,
  KPIS_ADMIN, PIPELINE_JURIDICO, PIPELINE_COMERCIAL, fmtBRL,
  type Caso, type Stage,
} from "./data";
import { useStore } from "./store";
import { supabase } from "./lib/supabase";
import type { ContaStatus } from "./lib/database.types";
import { useLiveLeads, useLiveCasos, useLiveAuditoria, type UiLead, type UiCaso } from "./lib/data-live";
import { ConvidarModal } from "./invite-modal";

type RepRow = {
  id: string;
  nome: string;
  email: string;
  status: ContaStatus;
  uf: string | null;
  cidade: string | null;
  whats: string | null;
  created_at: string;
  revenda: { nome: string } | null;
};

const STATUS_LABEL: Record<ContaStatus, string> = {
  ativo: "Ativo",
  pendente: "Pendente",
  suspenso: "Suspenso",
  recusado: "Recusado",
};
const STATUS_COLOR: Record<ContaStatus, string> = {
  ativo: "var(--green)",
  pendente: "var(--amber)",
  suspenso: "var(--rose)",
  recusado: "var(--ink-3)",
};
const FMT_DATE = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
};

export function AdminDashboard() {
  const [periodo, setPeriodo] = useState("mes");
  return (
    <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 16 }}>
      <header style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, letterSpacing: "-0.015em" }}>Visão Geral</h1>
          <div style={{ fontSize: 13, color: "var(--ink-3)", marginTop: 4 }}>Panorama operacional do escritório e da rede de representantes</div>
        </div>
        <div style={{ display: "inline-flex", background: "var(--surface-3)", border: "1px solid var(--line)", borderRadius: 5, padding: 2 }}>
          {[["hoje","Hoje"],["semana","Semana"],["mes","Mês"],["custom","Personalizado"]].map(([id, l]) => (
            <button key={id} onClick={() => setPeriodo(id)} style={{
              padding: "5px 11px", fontSize: 12, fontWeight: 500, border: 0,
              background: periodo === id ? "var(--surface)" : "transparent",
              color: periodo === id ? "var(--ink)" : "var(--ink-3)",
              borderRadius: 4, cursor: "pointer",
              boxShadow: periodo === id ? "var(--shadow-sm)" : "none",
            }}>{l}</button>
          ))}
        </div>
      </header>

      <div className="grid-kpi" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        {KPIS_ADMIN.map(k => <KPI key={k.label} {...k}
          icon={k.label.includes("recebidos") ? <Ic.Briefcase size={14} /> :
                k.label.includes("liberados") ? <Ic.CheckCircle size={14} /> :
                k.label.includes("Tempo") ? <Ic.Clock size={14} /> :
                <Ic.Money size={14} />} />)}
      </div>

      <div className="grid-2col" style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 14 }}>
        <Section title="Funil — Pipeline Jurídico" subtitle="Maio/2026" right={<Btn variant="ghost" size="sm" icon={<Ic.Download size={12} />}>CSV</Btn>}>
          <Funil />
        </Section>
        <Section title="Evolução temporal" subtitle="casos / dia" right={<Btn variant="ghost" size="sm">Semana</Btn>}>
          <Evolucao />
        </Section>
      </div>

      <div className="grid-3col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
        <Section title="Top representantes" subtitle="indicações no mês">
          <RankList items={TOP_REPS.map(r => ({
            avatar: r.nome, titulo: r.nome, sub: r.revenda, valor: r.ind, suffix: `ind. · ${r.conv}% conv. · ${fmtBRL(r.valor)}`,
          }))} />
        </Section>
        <Section title="Top advogados" subtitle="casos resolvidos no mês">
          <RankList items={TOP_ADV.map(a => ({
            avatar: a.nome, titulo: a.nome, sub: `tempo médio ${a.tempo}d`, valor: a.resolvidos, suffix: "casos",
          }))} />
        </Section>
        <Section title="Casos por estado" subtitle="volume mensal">
          <BrazilHeatmap data={HEATMAP} />
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 14, fontSize: 11, color: "var(--ink-3)" }}>
            <span>Menos</span>
            {[0,0.25,0.5,0.75,1].map(i => (
              <span key={i} style={{ width: 16, height: 12, borderRadius: 2, border: "1px solid var(--line)", background: i === 0 ? "var(--surface-3)" : `oklch(${0.95 - i * 0.55} ${0.04 + i * 0.08} 255)` }} />
            ))}
            <span>Mais</span>
          </div>
        </Section>
      </div>

      <div className="grid-2col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <Section title="Cadastros pendentes" subtitle="2 aguardando aprovação" right={<Btn variant="ghost" size="sm">Ver todos</Btn>} noPad>
          {REPRESENTANTES.filter(r => r.status === "Pendente").map(r => (
            <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderBottom: "1px solid var(--line)" }}>
              <Avatar name={r.nome} size={32} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12.5, fontWeight: 500 }}>{r.nome}</div>
                <div style={{ fontSize: 11.5, color: "var(--ink-3)" }}>{r.revenda || "Sem revenda"} · {r.cidade}/{r.uf} · {r.operadoras.join(", ")}</div>
              </div>
              <span style={{ fontSize: 11, color: "var(--ink-4)" }}>solicitado {r.desde}</span>
              <Btn variant="default" size="sm" icon={<Ic.Eye size={12} />}>Ver</Btn>
              <Btn variant="primary" size="sm" icon={<Ic.Check size={12} />}>Aprovar</Btn>
              <Btn variant="danger" size="sm" icon={<Ic.X size={12} />}>Recusar</Btn>
            </div>
          ))}
        </Section>
        <Section title="Auditoria recente" subtitle="últimas ações no sistema" right={<Btn variant="ghost" size="sm">Abrir auditoria</Btn>} noPad>
          {AUDITORIA.slice(0, 5).map((a, i) => (
            <div key={a.id} style={{ display: "flex", gap: 10, padding: "10px 14px", borderBottom: i < 4 ? "1px solid var(--line)" : 0, fontSize: 12 }}>
              <Avatar name={a.quem} size={24} />
              <div style={{ flex: 1 }}>
                <div><strong>{a.quem}</strong> <span style={{ color: "var(--ink-2)" }}>{a.acao}</span></div>
                <div style={{ fontSize: 11.5, color: "var(--ink-3)" }}>{a.alvo}</div>
              </div>
              <span style={{ fontSize: 11, color: "var(--ink-4)" }}>{a.quando}</span>
            </div>
          ))}
        </Section>
      </div>
    </div>
  );
}

function Funil() {
  const stages = [
    { id: "recebido", label: "Recebido", v: 84 },
    { id: "analise", label: "Em Análise", v: 76 },
    { id: "contato", label: "Contato Inicial", v: 68 },
    { id: "honorarios", label: "Proposta Honorários", v: 54 },
    { id: "contratou", label: "Cliente Contratou", v: 48 },
    { id: "documentacao", label: "Documentação", v: 47 },
    { id: "extrajudicial", label: "Extrajudicial / Judicial", v: 47 },
    { id: "liberado", label: "Liberado", v: 47 },
  ];
  const max = stages[0].v;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {stages.map((s, i) => {
        const pct = (s.v / max) * 100;
        const conv = i === 0 ? 100 : Math.round((s.v / stages[i-1].v) * 100);
        const c = PIPELINE_JURIDICO.find(p => p.id === s.id)!;
        return (
          <div key={s.id} style={{ display: "grid", gridTemplateColumns: "180px 1fr 70px 60px", gap: 8, alignItems: "center", fontSize: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 6, height: 6, borderRadius: 99, background: c.color }} />
              <span style={{ color: "var(--ink-2)" }}>{s.label}</span>
            </div>
            <div style={{ height: 22, background: "var(--surface-3)", borderRadius: 3, border: "1px solid var(--line)", overflow: "hidden", position: "relative" }}>
              <div style={{ width: `${pct}%`, height: "100%", background: `linear-gradient(90deg, ${c.color}, ${c.color})`, opacity: 0.85 }} />
            </div>
            <span className="mono" style={{ textAlign: "right", fontWeight: 500 }}>{s.v}</span>
            <span style={{ fontSize: 11, color: i === 0 ? "var(--ink-4)" : (conv >= 80 ? "var(--green)" : "var(--ink-3)"), textAlign: "right" }} className="mono">
              {i === 0 ? "—" : `${conv}%`}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function Evolucao() {
  const data = [
    { k: "S1", v: 12 }, { k: "S2", v: 16 }, { k: "S3", v: 21 }, { k: "S4", v: 18 }, { k: "S5", v: 23 }, { k: "S6", v: 27 }, { k: "S7", v: 24 },
    { k: "S8", v: 30 }, { k: "S9", v: 28 }, { k: "S10", v: 32 }, { k: "S11", v: 35 }, { k: "S12", v: 31 },
  ];
  return (
    <div>
      <MiniBars data={data} height={120} color="var(--navy)" />
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--ink-4)", marginTop: 4 }} className="mono">
        {data.map(d => <span key={d.k} style={{ flex: 1, textAlign: "center" }}>{d.k}</span>)}
      </div>
    </div>
  );
}

type RankItem = { avatar: string; titulo: string; sub: string; valor: number; suffix: string };
function RankList({ items }: { items: RankItem[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {items.map((it, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span className="mono" style={{ fontSize: 11, color: "var(--ink-4)", width: 14 }}>{i + 1}</span>
          <Avatar name={it.avatar} size={26} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12.5, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{it.titulo}</div>
            <div style={{ fontSize: 11, color: "var(--ink-3)" }}>{it.sub}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 13, fontWeight: 600 }} className="mono">{it.valor}</div>
            <div style={{ fontSize: 10.5, color: "var(--ink-4)" }}>{it.suffix}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* === Representantes (Supabase real) === */
export function AdminRepresentantes() {
  const [reps, setReps] = useState<RepRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null); // id em ação
  const [f, setF] = useState<"Todos" | ContaStatus>("Todos");
  const [search, setSearch] = useState("");
  const [showInvite, setShowInvite] = useState(false);

  const load = async () => {
    setError(null);
    const { data, error } = await supabase
      .from("profiles")
      .select("id, nome, email, status, uf, cidade, whats, created_at, revenda:revendas!profiles_revenda_id_fkey(nome)")
      .eq("papel", "rep")
      .order("created_at", { ascending: false });
    if (error) { setError(error.message); return; }
    setReps((data ?? []) as unknown as RepRow[]);
  };

  useEffect(() => { load(); }, []);

  // Realtime: qualquer mudança em profiles refresca a lista
  useEffect(() => {
    const channel = supabase
      .channel("admin-reps-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const setStatus = async (id: string, status: ContaStatus) => {
    setBusy(id);
    const { error } = await supabase.from("profiles").update({ status } as never).eq("id", id);
    setBusy(null);
    if (error) alert("Erro ao atualizar: " + error.message);
    // realtime cuida do refresh
  };

  const all = reps ?? [];
  const visible = all
    .filter(r => f === "Todos" || r.status === f)
    .filter(r => {
      if (!search) return true;
      const s = search.toLowerCase();
      return (
        r.nome.toLowerCase().includes(s) ||
        r.email.toLowerCase().includes(s) ||
        (r.revenda?.nome.toLowerCase().includes(s) ?? false) ||
        (r.cidade?.toLowerCase().includes(s) ?? false)
      );
    });

  const pendentesCount = all.filter(r => r.status === "pendente").length;
  const ativosCount = all.filter(r => r.status === "ativo").length;

  return (
    <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 16 }}>
      <header style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, letterSpacing: "-0.015em" }}>Representantes</h1>
          <div style={{ fontSize: 13, color: "var(--ink-3)", marginTop: 4 }}>
            {reps === null ? "Carregando…" : `${all.length} contas · ${pendentesCount} pendentes · ${ativosCount} ativas`}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Btn variant="soft" size="sm" icon={<Ic.Download size={13} />}>Exportar</Btn>
          <Btn variant="primary" size="sm" icon={<Ic.Plus size={13} />} onClick={() => setShowInvite(true)}>Convidar representante</Btn>
        </div>
      </header>

      {showInvite && <ConvidarModal open={showInvite} onClose={() => setShowInvite(false)} papelFixo="rep" titulo="Convidar Representante" />}

      <div className="toolbar-row" style={{
        display: "flex", gap: 8, alignItems: "center",
        padding: "10px 12px", background: "var(--surface)",
        border: "1px solid var(--line)", borderRadius: 6,
      }}>
        <Input icon={<Ic.Search size={13} />} placeholder="Buscar por nome, email, revenda, cidade" value={search} onChange={e=>setSearch(e.target.value)} style={{ minWidth: 320 }} />
        <div style={{ display: "inline-flex", background: "var(--surface-3)", border: "1px solid var(--line)", borderRadius: 5, padding: 2 }}>
          {(["Todos","ativo","pendente","suspenso","recusado"] as const).map(s => (
            <button key={s} onClick={() => setF(s)} style={{
              padding: "4px 10px", fontSize: 12, fontWeight: 500, border: 0,
              background: f === s ? "var(--surface)" : "transparent",
              color: f === s ? "var(--ink)" : "var(--ink-3)",
              borderRadius: 4, cursor: "pointer", boxShadow: f === s ? "var(--shadow-sm)" : "none",
              textTransform: "capitalize",
            }}>{s === "Todos" ? "Todos" : STATUS_LABEL[s]}</button>
          ))}
        </div>
      </div>

      {error && (
        <div style={{ background: "var(--rose-soft)", border: "1px solid var(--rose-border)", color: "var(--rose)", padding: "10px 14px", borderRadius: 5, fontSize: 12.5 }}>
          Erro ao carregar: {error}
        </div>
      )}

      <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 6, overflow: "hidden" }}>
        {reps === null ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--ink-3)", fontSize: 13 }}>Carregando representantes…</div>
        ) : visible.length === 0 ? (
          <Empty icon={<Ic.Users size={20} />} title={f === "Todos" && !search ? "Nenhum representante cadastrado ainda" : "Nenhum representante para esse filtro"} hint={f === "Todos" && !search ? "Eles aparecem aqui após se cadastrarem pelo app." : "Tente outro filtro ou busca."} />
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: "var(--surface-2)", borderBottom: "1px solid var(--line)" }}>
                {["Representante", "Email", "Revenda", "Local", "Status", "Desde", ""].map(h => (
                  <th key={h} style={{ textAlign: "left", padding: "9px 12px", fontWeight: 500, color: "var(--ink-3)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map(r => (
                <tr key={r.id} style={{ borderBottom: "1px solid var(--line)" }}>
                  <td style={{ padding: "10px 12px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <Avatar name={r.nome} size={26} />
                      <div>
                        <div style={{ fontWeight: 500 }}>{r.nome}</div>
                        <div style={{ fontSize: 11, color: "var(--ink-4)" }} className="mono">{r.id.slice(0, 8)}…</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: "10px 12px", color: "var(--ink-2)" }}>{r.email}</td>
                  <td style={{ padding: "10px 12px", color: "var(--ink-2)" }}>{r.revenda?.nome ?? "—"}</td>
                  <td style={{ padding: "10px 12px", color: "var(--ink-2)" }}>
                    {r.cidade ? `${r.cidade}${r.uf ? `/${r.uf}` : ""}` : (r.uf ?? "—")}
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    <Badge dotColor={STATUS_COLOR[r.status]}>{STATUS_LABEL[r.status]}</Badge>
                  </td>
                  <td style={{ padding: "10px 12px", color: "var(--ink-3)" }} className="mono">{FMT_DATE(r.created_at)}</td>
                  <td style={{ padding: "10px 12px", textAlign: "right" }}>
                    <RowActions row={r} busy={busy === r.id} onAction={setStatus} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function RowActions({ row, busy, onAction }: { row: RepRow; busy: boolean; onAction: (id: string, status: ContaStatus) => void }) {
  if (row.status === "pendente") {
    return (
      <div style={{ display: "inline-flex", gap: 4 }}>
        <Btn variant="primary" size="sm" disabled={busy} onClick={() => onAction(row.id, "ativo")} icon={<Ic.Check size={12} />}>Aprovar</Btn>
        <Btn variant="danger" size="sm" disabled={busy} onClick={() => onAction(row.id, "recusado")} icon={<Ic.X size={12} />}>Recusar</Btn>
      </div>
    );
  }
  if (row.status === "ativo") {
    return (
      <div style={{ display: "inline-flex", gap: 4 }}>
        <Btn variant="ghost" size="sm" disabled={busy} onClick={() => onAction(row.id, "suspenso")}>Suspender</Btn>
      </div>
    );
  }
  // suspenso / recusado
  return (
    <Btn variant="ghost" size="sm" disabled={busy} onClick={() => onAction(row.id, "ativo")}>Reativar</Btn>
  );
}

/* === Revendas (Admin) === */
type RevendaRow = {
  id: string;
  nome: string;
  cnpj: string | null;
  status: ContaStatus;
  created_at: string;
  coord: { nome: string; email: string } | null;
};

export function AdminRevendas() {
  const [list, setList] = useState<RevendaRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showNew, setShowNew] = useState(false);

  const load = async () => {
    setError(null);
    const { data, error } = await supabase
      .from("revendas")
      .select("id, nome, cnpj, status, created_at, coord:profiles!revendas_coord_fk(nome, email)")
      .order("created_at", { ascending: false });
    if (error) { setError(error.message); return; }
    setList((data ?? []) as unknown as RevendaRow[]);
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const ch = supabase.channel("admin-revendas")
      .on("postgres_changes", { event: "*", schema: "public", table: "revendas" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const setStatus = async (id: string, status: ContaStatus) => {
    setBusy(id);
    const { error } = await supabase.from("revendas").update({ status } as never).eq("id", id);
    setBusy(null);
    if (error) alert("Erro: " + error.message);
  };

  const all = list ?? [];
  const visible = !search ? all : all.filter(r =>
    r.nome.toLowerCase().includes(search.toLowerCase()) ||
    (r.coord?.nome.toLowerCase().includes(search.toLowerCase()) ?? false)
  );

  return (
    <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 16 }}>
      <header style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, letterSpacing: "-0.015em" }}>Revendas</h1>
          <div style={{ fontSize: 13, color: "var(--ink-3)", marginTop: 4 }}>
            {list === null ? "Carregando…" : `${all.length} cadastradas · ${all.filter(r=>r.status==="ativo").length} ativas`}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Btn variant="soft" size="sm" icon={<Ic.Download size={13} />}>Exportar</Btn>
          <Btn variant="primary" size="sm" icon={<Ic.Plus size={13} />} onClick={() => setShowNew(true)}>Nova revenda</Btn>
        </div>
      </header>

      <div className="toolbar-row" style={{ display: "flex", gap: 8, alignItems: "center", padding: "10px 12px", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 6 }}>
        <Input icon={<Ic.Search size={13} />} placeholder="Buscar por nome ou coordenador" value={search} onChange={e=>setSearch(e.target.value)} style={{ minWidth: 320 }} />
      </div>

      {error && (
        <div style={{ background: "var(--rose-soft)", border: "1px solid var(--rose-border)", color: "var(--rose)", padding: "10px 14px", borderRadius: 5, fontSize: 12.5 }}>
          {error}
        </div>
      )}

      <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 6, overflow: "hidden" }}>
        {list === null ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--ink-3)", fontSize: 13 }}>Carregando…</div>
        ) : visible.length === 0 ? (
          <Empty
            icon={<Ic.Building size={20} />}
            title="Nenhuma revenda cadastrada"
            hint="Clique em 'Nova revenda' para criar a primeira."
            action={<Btn variant="primary" size="sm" icon={<Ic.Plus size={12} />} onClick={() => setShowNew(true)}>Nova revenda</Btn>}
          />
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: "var(--surface-2)", borderBottom: "1px solid var(--line)" }}>
                {["Revenda", "CNPJ", "Coordenador", "Status", "Desde", ""].map(h => (
                  <th key={h} style={{ textAlign: "left", padding: "9px 12px", fontWeight: 500, color: "var(--ink-3)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map(r => (
                <tr key={r.id} style={{ borderBottom: "1px solid var(--line)" }}>
                  <td style={{ padding: "10px 12px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ width: 28, height: 28, borderRadius: 5, background: "var(--surface-3)", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "var(--ink-3)" }}>
                        <Ic.Building size={14} />
                      </span>
                      <div style={{ fontWeight: 500 }}>{r.nome}</div>
                    </div>
                  </td>
                  <td style={{ padding: "10px 12px", color: "var(--ink-2)" }} className="mono">{r.cnpj ?? "—"}</td>
                  <td style={{ padding: "10px 12px" }}>
                    {r.coord ? (
                      <div>
                        <div style={{ fontSize: 12.5, color: "var(--ink)" }}>{r.coord.nome}</div>
                        <div style={{ fontSize: 11, color: "var(--ink-4)" }}>{r.coord.email}</div>
                      </div>
                    ) : (
                      <span style={{ color: "var(--ink-4)", fontStyle: "italic" }}>Sem coord</span>
                    )}
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    <Badge dotColor={STATUS_COLOR[r.status]}>{STATUS_LABEL[r.status]}</Badge>
                  </td>
                  <td style={{ padding: "10px 12px", color: "var(--ink-3)" }} className="mono">{FMT_DATE(r.created_at)}</td>
                  <td style={{ padding: "10px 12px", textAlign: "right" }}>
                    {r.status === "ativo" ? (
                      <Btn variant="ghost" size="sm" disabled={busy === r.id} onClick={() => setStatus(r.id, "suspenso")}>Suspender</Btn>
                    ) : (
                      <Btn variant="ghost" size="sm" disabled={busy === r.id} onClick={() => setStatus(r.id, "ativo")}>Reativar</Btn>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showNew && <NovaRevendaModal onClose={() => setShowNew(false)} />}
    </div>
  );
}

function NovaRevendaModal({ onClose }: { onClose: () => void }) {
  const [nome, setNome] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    const payload = { nome: nome.trim(), cnpj: cnpj.trim() || null, status: "ativo" as ContaStatus };
    const { error } = await supabase.from("revendas").insert(payload as never);
    setBusy(false);
    if (error) {
      setErr(error.message.includes("duplicate") ? "Já existe uma revenda com esse nome." : error.message);
      return;
    }
    onClose();
  };

  return (
    <div onClick={onClose} className="modal-backdrop" style={{
      position: "fixed", inset: 0, zIndex: 100,
      background: "oklch(0.10 0.04 250 / 0.45)",
      backdropFilter: "blur(2px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 24,
    }}>
      <div onClick={e=>e.stopPropagation()} className="modal-shell fade-up" style={{
        width: 480, maxWidth: "100%",
        background: "var(--surface)", border: "1px solid var(--line-2)",
        borderRadius: 8, boxShadow: "var(--shadow-lg)",
        display: "flex", flexDirection: "column", overflow: "hidden",
      }}>
        <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ width: 28, height: 28, borderRadius: 5, background: "var(--navy)", color: "var(--navy-ink)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
            <Ic.Building size={15} />
          </span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>Nova revenda</div>
            <div style={{ fontSize: 11.5, color: "var(--ink-3)" }}>Será listada na tela de cadastro de Representantes</div>
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: 0, color: "var(--ink-3)", cursor: "pointer", padding: 6 }}>
            <Ic.X size={16} />
          </button>
        </div>

        <form onSubmit={submit} style={{ padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
          {err && (
            <div style={{ background: "var(--rose-soft)", border: "1px solid var(--rose-border)", color: "var(--rose)", padding: "9px 12px", borderRadius: 5, fontSize: 12.5 }}>
              {err}
            </div>
          )}
          <Field label="Nome da revenda">
            <Input full value={nome} onChange={e=>setNome(e.target.value)} placeholder="Konecta" autoFocus />
          </Field>
          <Field label="CNPJ (opcional)">
            <Input full value={cnpj} onChange={e=>setCnpj(e.target.value)} placeholder="00.000.000/0001-00" />
          </Field>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 6 }}>
            <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
            <Btn variant="primary" type="submit" disabled={busy || !nome.trim()}>
              {busy ? "Criando…" : "Criar revenda"}
            </Btn>
          </div>
        </form>
      </div>
    </div>
  );
}

/* === Advogados (Supabase real) === */
type AdvogadoRow = {
  id: string;
  nome: string;
  email: string;
  oab: string | null;
  uf: string | null;
  status: ContaStatus;
  created_at: string;
};

export function AdminAdvogados() {
  const [list, setList] = useState<AdvogadoRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [showInvite, setShowInvite] = useState(false);

  const load = async () => {
    setError(null);
    const { data, error } = await supabase
      .from("profiles")
      .select("id, nome, email, oab, uf, status, created_at")
      .eq("papel", "advogado")
      .order("created_at", { ascending: false });
    if (error) { setError(error.message); return; }
    setList((data ?? []) as unknown as AdvogadoRow[]);
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const ch = supabase.channel("admin-advogados")
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const setStatus = async (id: string, status: ContaStatus) => {
    setBusy(id);
    const { error } = await supabase.from("profiles").update({ status } as never).eq("id", id);
    setBusy(null);
    if (error) alert("Erro: " + error.message);
  };

  const all = list ?? [];
  const ativos = all.filter(a => a.status === "ativo").length;
  const pendentes = all.filter(a => a.status === "pendente").length;

  return (
    <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 16 }}>
      <header style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, letterSpacing: "-0.015em" }}>Advogados</h1>
          <div style={{ fontSize: 13, color: "var(--ink-3)", marginTop: 4 }}>
            {list === null ? "Carregando…" : `${all.length} colaboradores · ${ativos} ativos · ${pendentes} pendentes`}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Btn variant="primary" size="sm" icon={<Ic.Plus size={13} />} onClick={() => setShowInvite(true)}>Convidar advogado</Btn>
        </div>
      </header>

      {showInvite && <ConvidarModal open={showInvite} onClose={() => setShowInvite(false)} papelFixo="advogado" revendaIdFixa={null} titulo="Convidar Advogado" />}

      {error && (
        <div style={{ background: "var(--rose-soft)", border: "1px solid var(--rose-border)", color: "var(--rose)", padding: "10px 14px", borderRadius: 5, fontSize: 12.5 }}>
          {error}
        </div>
      )}

      {list === null ? (
        <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 6, padding: 40, textAlign: "center", color: "var(--ink-3)", fontSize: 13 }}>
          Carregando advogados…
        </div>
      ) : all.length === 0 ? (
        <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 6 }}>
          <Empty
            icon={<Ic.Gavel size={20} />}
            title="Nenhum advogado cadastrado ainda"
            hint="Advogados entram apenas por convite do Admin. A tela de convites estará disponível na Fase 5. Por enquanto, crie via SQL atualizando um profile existente para papel='advogado'."
          />
        </div>
      ) : (
        <div className="grid-2col" style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
          {all.map(a => (
            <div key={a.id} style={{
              background: "var(--surface)", border: "1px solid var(--line)",
              borderRadius: 6, padding: 16,
              display: "flex", flexDirection: "column", gap: 12,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <Avatar name={a.nome} size={44} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{a.nome}</div>
                  <div style={{ fontSize: 11.5, color: "var(--ink-3)" }} className="mono">
                    {a.oab ?? "OAB não informada"}{a.uf ? ` · ${a.uf}` : ""}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--ink-4)", marginTop: 2 }}>{a.email}</div>
                </div>
                <Badge dotColor={STATUS_COLOR[a.status]}>{STATUS_LABEL[a.status]}</Badge>
              </div>

              {/* Stats virão da tabela casos quando integrarmos casos */}
              <div className="grid-3col" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, opacity: 0.6 }}>
                <Stat label="Atribuídos" v="—" />
                <Stat label="Resolvidos no mês" v="—" />
                <Stat label="Tempo médio" v="—" />
              </div>
              <div style={{ fontSize: 10.5, color: "var(--ink-4)", marginTop: -6 }}>
                Estatísticas reais virão quando casos forem migrados.
              </div>

              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {a.status === "pendente" && (
                  <>
                    <Btn variant="primary" size="sm" disabled={busy === a.id} onClick={() => setStatus(a.id, "ativo")} icon={<Ic.Check size={12} />}>Aprovar</Btn>
                    <Btn variant="danger" size="sm" disabled={busy === a.id} onClick={() => setStatus(a.id, "recusado")} icon={<Ic.X size={12} />}>Recusar</Btn>
                  </>
                )}
                {a.status === "ativo" && (
                  <Btn variant="ghost" size="sm" disabled={busy === a.id} onClick={() => setStatus(a.id, "suspenso")}>Suspender</Btn>
                )}
                {(a.status === "suspenso" || a.status === "recusado") && (
                  <Btn variant="ghost" size="sm" disabled={busy === a.id} onClick={() => setStatus(a.id, "ativo")}>Reativar</Btn>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, v }: { label: string; v: number | string }) {
  return (
    <div style={{ background: "var(--surface-2)", border: "1px solid var(--line)", borderRadius: 5, padding: "8px 10px" }}>
      <div style={{ fontSize: 10.5, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
      <div style={{ fontSize: 17, fontWeight: 600, marginTop: 2 }} className="mono">{v}</div>
    </div>
  );
}

/* === Auditoria (Supabase real) === */
export function AdminAuditoria() {
  const [open, setOpen] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const { items, error } = useLiveAuditoria(300);

  const filtered = !search ? items ?? [] : (items ?? []).filter(a =>
    (a.actor?.nome?.toLowerCase().includes(search.toLowerCase())) ||
    (a.action.toLowerCase().includes(search.toLowerCase())) ||
    (a.entity_type.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 16 }}>
      <header style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, letterSpacing: "-0.015em" }}>Auditoria</h1>
          <div style={{ fontSize: 13, color: "var(--ink-3)", marginTop: 4 }}>
            {items === null ? "Carregando…" : `${items.length} eventos · rastreabilidade de todas as ações`}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Input icon={<Ic.Search size={13} />} placeholder="Buscar ação, ator, entidade" value={search} onChange={e=>setSearch(e.target.value)} />
          <Btn variant="ghost" size="sm" icon={<Ic.Download size={13} />} onClick={() => {
            const blob = new Blob([JSON.stringify(items ?? [], null, 2)], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a"); a.href = url; a.download = `auditoria-${new Date().toISOString().split("T")[0]}.json`; a.click();
            URL.revokeObjectURL(url);
          }}>Exportar JSON</Btn>
        </div>
      </header>

      {error && <div style={{ background: "var(--rose-soft)", border: "1px solid var(--rose-border)", color: "var(--rose)", padding: "10px 14px", borderRadius: 5, fontSize: 12.5 }}>{error}</div>}

      <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 6, overflow: "hidden" }}>
        {items === null ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--ink-3)", fontSize: 13 }}>Carregando auditoria…</div>
        ) : filtered.length === 0 ? (
          <Empty icon={<Ic.Audit size={20} />} title="Nenhum evento ainda" hint="Eventos aparecem automaticamente quando alguém cria/edita leads, casos, profiles ou revendas." />
        ) : filtered.map((a, i) => {
          const isOpen = open === a.id;
          return (
            <div key={a.id} style={{ borderBottom: i < filtered.length - 1 ? "1px solid var(--line)" : 0 }}>
              <div onClick={() => setOpen(isOpen ? null : a.id)} className="audit-row" style={{
                display: "grid", gridTemplateColumns: "100px 200px 1fr 160px 16px", gap: 12,
                padding: "11px 14px",
                alignItems: "center", fontSize: 12.5, cursor: "pointer",
              }}
                onMouseEnter={e=>e.currentTarget.style.background="var(--hover)"}
                onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                <span className="mono" style={{ color: "var(--ink-4)", fontSize: 11 }}>{a.id.slice(0, 8)}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <Avatar name={a.actor?.nome ?? "Sistema"} size={22} />
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 500 }}>{a.actor?.nome ?? "Sistema"}</div>
                    <div style={{ fontSize: 10.5, color: "var(--ink-4)" }}>{a.actor?.papel ?? "—"}</div>
                  </div>
                </div>
                <div>
                  <span style={{ color: "var(--ink-2)" }}>{a.action}</span>{" "}
                  <span style={{ color: "var(--ink)" }} className="mono">{a.entity_id?.slice(0, 8) ?? "—"}</span>
                </div>
                <span style={{ fontSize: 11, color: "var(--ink-3)", textAlign: "right" }} className="mono">{new Date(a.created_at).toLocaleString("pt-BR")}</span>
                <span style={{ color: "var(--ink-4)", transform: `rotate(${isOpen ? 90 : 0}deg)`, transition: "transform 120ms" }}>
                  <Ic.Chevron size={13} />
                </span>
              </div>
              {isOpen && (
                <div style={{ padding: "12px 14px 16px 124px", background: "var(--surface-2)", borderTop: "1px solid var(--line)" }}>
                  <div style={{ fontSize: 11, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6, fontWeight: 500 }}>Detalhes</div>
                  <pre className="mono" style={{ margin: 0, fontSize: 11.5, color: "var(--ink-2)", whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{JSON.stringify(a.details ?? {}, null, 2)}</pre>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* === Todos leads (Supabase real) === */
export function AdminTodosLeads({ onOpenLead }: { onOpenLead: (l: UiLead) => void }) {
  const [search, setSearch] = useState("");
  const { leads, error } = useLiveLeads();
  return (
    <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 16 }}>
      <header>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, letterSpacing: "-0.015em" }}>Todos os Leads</h1>
        <div style={{ fontSize: 13, color: "var(--ink-3)", marginTop: 4 }}>
          {leads === null ? "Carregando…" : `Universo de leads do sistema · ${leads.length} totais`}
        </div>
      </header>
      <div className="toolbar-row" style={{ display: "flex", gap: 8, padding: "10px 12px", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 6 }}>
        <Input icon={<Ic.Search size={13} />} placeholder="Buscar lead" value={search} onChange={e=>setSearch(e.target.value)} style={{ minWidth: 320 }} />
        <Btn variant="ghost" size="sm" icon={<Ic.Download size={13} />} style={{ marginLeft: "auto" }}>Exportar</Btn>
      </div>
      {error && <div style={{ background: "var(--rose-soft)", border: "1px solid var(--rose-border)", color: "var(--rose)", padding: "10px 14px", borderRadius: 5, fontSize: 12.5 }}>{error}</div>}
      <RepLista filter={search} onOpenLead={onOpenLead} leads={leads} />
    </div>
  );
}

/* === Reatribuir advogado modal === */
function ReatribuirModal({ caso, onClose }: { caso: UiCaso; onClose: () => void }) {
  const [advogados, setAdvogados] = useState<Array<{ id: string; nome: string; oab: string | null }>>([]);
  const [selectedId, setSelectedId] = useState<string>(caso.advogado_id ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    supabase.from("profiles").select("id, nome, oab").eq("papel", "advogado").eq("status", "ativo").order("nome")
      .then(({ data }) => setAdvogados((data ?? []) as unknown as Array<{ id: string; nome: string; oab: string | null }>));
  }, []);

  const submit = async () => {
    setBusy(true); setErr(null);
    const { error } = await supabase.from("casos").update({ advogado_id: selectedId || null } as never).eq("id", caso.id);
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
        width: 480, maxWidth: "100%",
        background: "var(--surface)", border: "1px solid var(--line-2)",
        borderRadius: 8, boxShadow: "var(--shadow-lg)",
      }}>
        <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ width: 28, height: 28, borderRadius: 5, background: "var(--navy)", color: "var(--navy-ink)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
            <Ic.Pipeline size={15} />
          </span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>Reatribuir advogado</div>
            <div style={{ fontSize: 11.5, color: "var(--ink-3)" }}>Caso {caso.id.slice(0, 8)} · {caso.lead?.empresa ?? "—"}</div>
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: 0, color: "var(--ink-3)", cursor: "pointer", padding: 6 }}>
            <Ic.X size={16} />
          </button>
        </div>
        <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
          {err && <div style={{ background: "var(--rose-soft)", border: "1px solid var(--rose-border)", color: "var(--rose)", padding: "9px 12px", borderRadius: 5, fontSize: 12.5 }}>{err}</div>}
          <Field label="Advogado responsável">
            <div style={{ position: "relative" }}>
              <select value={selectedId} onChange={e=>setSelectedId(e.target.value)} style={{
                width: "100%", padding: "8px 28px 8px 10px",
                border: "1px solid var(--line-2)", borderRadius: 5,
                background: "var(--surface)", fontSize: 13, color: "var(--ink)", appearance: "none", cursor: "pointer",
              }}>
                <option value="">Sem advogado atribuído</option>
                {advogados.map(a => <option key={a.id} value={a.id}>{a.nome}{a.oab ? ` — ${a.oab}` : ""}</option>)}
              </select>
              <span style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "var(--ink-4)" }}>
                <Ic.ChevronDown size={14} />
              </span>
            </div>
          </Field>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 6 }}>
            <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
            <Btn variant="primary" onClick={submit} disabled={busy}>{busy ? "Salvando…" : "Reatribuir"}</Btn>
          </div>
        </div>
      </div>
    </div>
  );
}

/* === Todos casos (Supabase real) === */
export function AdminTodosCasos({ onOpenCaso }: { onOpenCaso: (c: UiCaso) => void }) {
  const { casos } = useLiveCasos();
  const [reatribuir, setReatribuir] = useState<UiCaso | null>(null);
  return (
    <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 16 }}>
      <header>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, letterSpacing: "-0.015em" }}>Todos os Casos</h1>
        <div style={{ fontSize: 13, color: "var(--ink-3)", marginTop: 4 }}>
          {casos === null ? "Carregando…" : `Universo de casos jurídicos · ${casos.length} totais`}
        </div>
      </header>
      <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 6, overflow: "hidden" }}>
        {casos === null ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--ink-3)", fontSize: 13 }}>Carregando…</div>
        ) : casos.length === 0 ? (
          <Empty icon={<Ic.Scale size={20} />} title="Nenhum caso jurídico ainda" hint="Os casos aparecem aqui quando os representantes usarem 'Desbloquear Cliente' para indicá-los." />
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: "var(--surface-2)", borderBottom: "1px solid var(--line)" }}>
                {["Caso", "Cliente", "Advogado", "Status", "Multa", "Dias", ""].map(h => (
                  <th key={h} style={{ textAlign: "left", padding: "9px 12px", fontWeight: 500, color: "var(--ink-3)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {casos.map(c => (
                <tr key={c.id} style={{ borderBottom: "1px solid var(--line)" }}
                  onMouseEnter={e=>e.currentTarget.style.background="var(--hover)"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                  <td style={{ padding: "10px 12px", cursor: "pointer" }} onClick={() => onOpenCaso(c)} className="mono"><span style={{ fontWeight: 500 }}>{c.id.slice(0, 8)}</span></td>
                  <td style={{ padding: "10px 12px", cursor: "pointer" }} onClick={() => onOpenCaso(c)}>
                    <div style={{ fontWeight: 500 }}>{c.lead?.empresa ?? "—"}</div>
                    <div style={{ fontSize: 11, color: "var(--ink-3)" }}>{c.lead?.contato ?? ""}{c.lead?.uf ? ` · ${c.lead.uf}` : ""}</div>
                  </td>
                  <td style={{ padding: "10px 12px" }}>{c.advogado?.nome ?? <span style={{ color: "var(--ink-4)", fontStyle: "italic" }}>Aguardando atribuição</span>}</td>
                  <td style={{ padding: "10px 12px", cursor: "pointer" }} onClick={() => onOpenCaso(c)}><StatusPill stage={c.status} pipeline={PIPELINE_JURIDICO} size="sm" /></td>
                  <td style={{ padding: "10px 12px" }} className="mono">{fmtBRL(Number(c.multa || 0))}</td>
                  <td style={{ padding: "10px 12px" }} className="mono">{c.dias_indicacao}d</td>
                  <td style={{ padding: "10px 12px", textAlign: "right" }}>
                    <Btn variant="ghost" size="sm" icon={<Ic.Pipeline size={12} />} onClick={(e) => { e.stopPropagation(); setReatribuir(c); }}>Reatribuir</Btn>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {reatribuir && <ReatribuirModal caso={reatribuir} onClose={() => setReatribuir(null)} />}
    </div>
  );
}

/* === Configurações === */
export function AdminConfig() {
  const [sub, setSub] = useState("geral");
  return (
    <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 14, maxWidth: 1100 }}>
      <header>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, letterSpacing: "-0.015em" }}>Configurações</h1>
        <div style={{ fontSize: 13, color: "var(--ink-3)", marginTop: 4 }}>Ajustes administrativos do sistema</div>
      </header>

      <div className="grid-config" style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 16 }}>
        <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {([
            ["geral", "Geral", <Ic.Settings size={14} />],
            ["pipeline-c", "Pipeline Comercial", <Ic.Pipeline size={14} />],
            ["pipeline-j", "Pipeline Jurídico", <Ic.Scale size={14} />],
            ["emails", "Templates de Email", <Ic.Mail size={14} />],
            ["webhooks", "Webhooks", <Ic.Globe size={14} />],
            ["perms", "Permissões", <Ic.Lock size={14} />],
          ] as const).map(([id, l, ic]) => (
            <button key={id} onClick={() => setSub(id)} style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              padding: "8px 10px",
              fontSize: 12.5, fontWeight: 500,
              background: sub === id ? "var(--surface)" : "transparent",
              border: sub === id ? "1px solid var(--line-2)" : "1px solid transparent",
              color: sub === id ? "var(--ink)" : "var(--ink-2)",
              textAlign: "left", cursor: "pointer", borderRadius: 5,
            }}>{ic}{l}</button>
          ))}
        </nav>

        <div>
          {sub === "geral" && (
            <Section title="Geral">
              <div className="grid-2col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <Field label="Nome do escritório"><Input full value="Advox Sociedade de Advogados" onChange={()=>{}} /></Field>
                <Field label="OAB do escritório"><Input full value="OAB/SP 12.044" onChange={()=>{}} /></Field>
                <Field label="Email de contato"><Input full value="contato@advox.adv.br" onChange={()=>{}} /></Field>
                <Field label="WhatsApp"><Input full value="(11) 99001-0001" onChange={()=>{}} /></Field>
                <Field label="Logo"><div style={{ padding: "12px 14px", border: "1px dashed var(--line-2)", borderRadius: 5, color: "var(--ink-3)", fontSize: 12 }}>Solte arquivo .svg ou .png aqui · 240×60px</div></Field>
                <Field label="Cor primária"><div style={{ display: "flex", gap: 6 }}>{["var(--navy)","oklch(0.30 0.05 250)","oklch(0.25 0.07 280)","oklch(0.32 0.06 200)"].map((c,i)=> <span key={i} style={{ width: 28, height: 28, borderRadius: 5, background: c, border: `1px solid ${i===0?"var(--ink)":"var(--line)"}` }} />)}</div></Field>
              </div>
            </Section>
          )}
          {sub === "pipeline-c" && (
            <Section title="Pipeline Comercial">
              <PipelineEditor pipeline={PIPELINE_COMERCIAL} />
            </Section>
          )}
          {sub === "pipeline-j" && (
            <Section title="Pipeline Jurídico">
              <PipelineEditor pipeline={PIPELINE_JURIDICO} />
            </Section>
          )}
          {sub === "emails" && (
            <Section title="Templates de email transacional">
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[
                  "Cadastro recebido",
                  "Cadastro aprovado",
                  "Novo caso atribuído (Advogado)",
                  "Caso liberado (Representante)",
                  "Tarefa vencendo",
                  "Recuperação de senha",
                ].map(n => (
                  <div key={n} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", border: "1px solid var(--line)", borderRadius: 5 }}>
                    <Ic.Mail size={14} color="var(--ink-3)" />
                    <span style={{ flex: 1, fontSize: 12.5 }}>{n}</span>
                    <Btn variant="ghost" size="sm" icon={<Ic.Edit size={12} />}>Editar</Btn>
                  </div>
                ))}
              </div>
            </Section>
          )}
          {sub === "webhooks" && (
            <Section title="Webhooks">
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[
                  { url: "https://hooks.zapier.com/hooks/catch/881234/abc", events: "lead.created, caso.liberado", logs: "200 OK · 2 min" },
                  { url: "https://crm.example.com/api/advox-webhook", events: "caso.* (todos)", logs: "200 OK · 1h" },
                ].map((w, i) => (
                  <div key={i} style={{ padding: "11px 14px", border: "1px solid var(--line)", borderRadius: 5 }}>
                    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      <span className="mono" style={{ fontSize: 11.5, color: "var(--ink-2)" }}>{w.url}</span>
                      <Badge dotColor="var(--green)">Ativo</Badge>
                    </div>
                    <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 4 }}>Eventos: {w.events} · Última entrega: {w.logs}</div>
                  </div>
                ))}
                <Btn variant="soft" size="sm" icon={<Ic.Plus size={12} />} style={{ alignSelf: "flex-start" }}>Novo webhook</Btn>
              </div>
            </Section>
          )}
          {sub === "perms" && (
            <Section title="Permissões">
              <p style={{ margin: 0, fontSize: 12.5, color: "var(--ink-2)", lineHeight: 1.6 }}>
                Os perfis padrão (Representante, Advogado, Admin) já cobrem os acessos previstos no fluxo.
                Permissões granulares estão preparadas como gancho futuro — entre em contato com o suporte
                caso precise habilitar exceções específicas.
              </p>
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}

function PipelineEditor({ pipeline }: { pipeline: Stage[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {pipeline.map((s, i) => (
        <div key={s.id} style={{
          display: "grid", gridTemplateColumns: "30px 1fr 200px 70px 70px",
          alignItems: "center", gap: 10,
          padding: "10px 12px",
          background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 5,
        }}>
          <span style={{ cursor: "grab", color: "var(--ink-4)", textAlign: "center" }}>⋮⋮</span>
          <Input full value={s.label} onChange={()=>{}} />
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 16, height: 16, borderRadius: 3, background: s.color }} />
            <span className="mono" style={{ fontSize: 11, color: "var(--ink-3)" }}>{s.color}</span>
          </span>
          <span className="mono" style={{ fontSize: 11, color: "var(--ink-4)", textAlign: "center" }}>#{i + 1}</span>
          <button style={{ background: "transparent", border: 0, color: "var(--ink-3)", cursor: "pointer", justifySelf: "end" }}>
            <Ic.Trash size={13} />
          </button>
        </div>
      ))}
      <Btn variant="soft" size="sm" icon={<Ic.Plus size={12} />} style={{ alignSelf: "flex-start", marginTop: 4 }}>Adicionar etapa</Btn>
    </div>
  );
}
