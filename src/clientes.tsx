// Clientes (layout do BuildClinic): faixa de KPIs clicáveis no topo, busca e
// filtros, contador "N de M", ordenação e grade de cartões ou lista. Clicar
// no cartão abre a ficha completa do lead.
import React, { useMemo, useState } from "react";
import { Ic } from "./icons";
import { Avatar, Empty, OperadoraTag } from "./ui";
import { useAuth } from "./auth";
import {
  useLiveLeads, fmtBRL, fmtTelefone, parseDateOnly, OPERADORAS_LIST, PIPELINE_COMERCIAL_DB, type UiLead,
  ehGestor,
} from "./lib/data-live";

type Faixa = "todos" | "negociacao" | "juridico" | "fechados" | "perdidos" | "fidelidade";
type Ordem = "recentes" | "az" | "valor" | "fidelidade";

const ABERTOS = ["novo", "contato", "proposta", "negociacao"];
const NO_JURIDICO = ["travado", "aguardando"];

const corEtapa = (s: string) => PIPELINE_COMERCIAL_DB.find(p => p.id === s)?.color ?? "var(--ink-4)";
const rotuloEtapa = (s: string) => PIPELINE_COMERCIAL_DB.find(p => p.id === s)?.label ?? s;

function diasFidelidade(fim: string | null | undefined): number | null {
  if (!fim) return null;
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  return Math.round((parseDateOnly(fim).getTime() - hoje.getTime()) / 86400000);
}

export function Clientes({ onOpenLead }: { onOpenLead: (l: UiLead) => void }) {
  const { profile } = useAuth();
  const ehCoord = ehGestor(profile?.papel);
  const { leads } = useLiveLeads(ehCoord ? {} : { repId: profile?.id });
  const [faixa, setFaixa] = useState<Faixa>("todos");
  const [busca, setBusca] = useState("");
  const [operadora, setOperadora] = useState("");
  const [etapa, setEtapa] = useState("");
  const [rep, setRep] = useState("");
  const [ordem, setOrdem] = useState<Ordem>("recentes");
  const [modo, setModo] = useState<"grade" | "lista">("grade");

  const todos = leads ?? [];
  const contagem = useMemo(() => ({
    todos: todos.length,
    negociacao: todos.filter(l => ABERTOS.includes(l.status)).length,
    juridico: todos.filter(l => NO_JURIDICO.includes(l.status) || !!l.advox_caso_id).length,
    fechados: todos.filter(l => l.status === "fechado").length,
    perdidos: todos.filter(l => l.status === "perdido").length,
    fidelidade: todos.filter(l => { const d = diasFidelidade(l.fim_fidelidade); return d !== null && d <= 60 && !["fechado", "perdido"].includes(l.status); }).length,
  }), [todos]);

  const reps = useMemo(() => {
    const m = new Map<string, string>();
    todos.forEach(l => l.rep && m.set(l.rep.id, l.rep.nome));
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1], "pt-BR"));
  }, [todos]);

  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const dig = q.replace(/\D/g, "");
    const r = todos.filter(l => {
      if (faixa === "negociacao" && !ABERTOS.includes(l.status)) return false;
      if (faixa === "juridico" && !(NO_JURIDICO.includes(l.status) || l.advox_caso_id)) return false;
      if (faixa === "fechados" && l.status !== "fechado") return false;
      if (faixa === "perdidos" && l.status !== "perdido") return false;
      if (faixa === "fidelidade") { const d = diasFidelidade(l.fim_fidelidade); if (d === null || d > 60 || ["fechado", "perdido"].includes(l.status)) return false; }
      if (operadora && l.operadora !== operadora) return false;
      if (etapa && l.status !== etapa) return false;
      if (rep && l.rep_id !== rep) return false;
      if (q) {
        const texto = `${l.empresa} ${l.contato} ${l.cidade ?? ""} ${l.email ?? ""} ${l.rep?.nome ?? ""}`.toLowerCase();
        if (!texto.includes(q) && !(dig.length >= 4 && (l.telefone ?? "").includes(dig))) return false;
      }
      return true;
    });
    const ord = [...r];
    if (ordem === "az") ord.sort((a, b) => a.empresa.localeCompare(b.empresa, "pt-BR"));
    else if (ordem === "valor") ord.sort((a, b) => Number(b.valor || 0) - Number(a.valor || 0));
    else if (ordem === "fidelidade") ord.sort((a, b) => (diasFidelidade(a.fim_fidelidade) ?? 9e9) - (diasFidelidade(b.fim_fidelidade) ?? 9e9));
    return ord;
  }, [todos, faixa, busca, operadora, etapa, rep, ordem]);

  const KPIS: { id: Faixa; label: string; icon: React.ReactNode; cor?: string }[] = [
    { id: "todos", label: "Total", icon: <Ic.Users size={14} /> },
    { id: "negociacao", label: "Em negociação", icon: <Ic.Pipeline size={14} /> },
    { id: "juridico", label: "No jurídico", icon: <Ic.Scale size={14} />, cor: "var(--gold)" },
    { id: "fechados", label: "Fechados", icon: <Ic.CheckCircle size={14} />, cor: "var(--green)" },
    { id: "perdidos", label: "Perdidos", icon: <Ic.X size={14} />, cor: "var(--rose)" },
    { id: "fidelidade", label: "Fidelidade ≤ 60d", icon: <Ic.Clock size={14} />, cor: "var(--amber)" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100%" }}>
      {/* KPIs */}
      <div className="clientes-kpis" style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(0, 1fr))", gap: 10, padding: "14px 18px", background: "var(--surface)", borderBottom: "1px solid var(--line)" }}>
        {KPIS.map(k => {
          const on = faixa === k.id;
          const cor = k.cor ?? "var(--navy)";
          return (
            <button key={k.id} onClick={() => setFaixa(on && k.id !== "todos" ? "todos" : k.id)} aria-pressed={on} style={{
              display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 0, padding: "8px 12px", cursor: "pointer", textAlign: "left",
              borderRadius: 8, border: `1px solid ${on ? cor : "var(--line)"}`, background: on ? `color-mix(in oklch, ${cor} 7%, var(--surface))` : "var(--surface)",
              minWidth: 0, font: "inherit",
            }}>
              <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 500, color: "var(--ink-3)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" }}>
                {k.id !== "todos" && <span style={{ width: 8, height: 8, borderRadius: 2, background: cor, flexShrink: 0 }} />}{k.label}
              </span>
              <span className="titulo mono" style={{ fontSize: 24, fontWeight: 600, color: "var(--ink)", lineHeight: 1.15 }}>{contagem[k.id]}</span>
            </button>
          );
        })}
      </div>

      {/* Busca e filtros */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 18px", flexWrap: "wrap", background: "var(--surface-2)", borderBottom: "1px solid var(--line)" }}>
        <div className="ring-focus" style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "6px 10px", border: "1px solid var(--line)", background: "var(--surface)", borderRadius: 8, width: 260, maxWidth: "100%" }}>
          <Ic.Search size={13} color="var(--ink-4)" />
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por empresa, contato, cidade ou telefone…" style={{ border: 0, outline: 0, background: "transparent", fontSize: 12.5, width: "100%", color: "var(--ink)" }} />
        </div>
        <Filtro valor={operadora} onChange={setOperadora} vazio="Todas operadoras" opcoes={OPERADORAS_LIST.map(o => [o, o])} />
        <Filtro valor={etapa} onChange={setEtapa} vazio="Todas etapas" opcoes={PIPELINE_COMERCIAL_DB.map(p => [p.id, p.label])} />
        {ehCoord && <Filtro valor={rep} onChange={setRep} vazio="Todos representantes" opcoes={reps} />}
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 12, color: "var(--ink-3)" }}><b style={{ color: "var(--ink)" }}>{lista.length}</b> de {todos.length}</span>
        <select value={ordem} onChange={e => setOrdem(e.target.value as Ordem)} style={selectCls}>
          <option value="recentes">Ordenar: recentes</option>
          <option value="az">Ordenar: A–Z</option>
          <option value="valor">Ordenar: maior valor</option>
          <option value="fidelidade">Ordenar: fidelidade</option>
        </select>
        <div style={{ display: "inline-flex", border: "1px solid var(--line)", borderRadius: 8, overflow: "hidden" }}>
          {(["grade", "lista"] as const).map(m => (
            <button key={m} onClick={() => setModo(m)} title={m === "grade" ? "Cartões" : "Lista"} style={{
              border: 0, cursor: "pointer", padding: "6px 9px", display: "inline-flex",
              background: modo === m ? "var(--navy-soft)" : "var(--surface)", color: modo === m ? "var(--navy)" : "var(--ink-3)",
            }}>{m === "grade" ? <Ic.Kanban size={14} /> : <Ic.List size={14} />}</button>
          ))}
        </div>
      </div>

      <div style={{ padding: 18 }}>
        {leads === null ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--ink-3)", fontSize: 13 }}>Carregando…</div>
        ) : lista.length === 0 ? (
          <Empty icon={<Ic.Users size={20} />} title={todos.length ? "Nenhum cliente com esses filtros" : "Nenhum cliente ainda"} hint={todos.length ? "Limpe a busca ou troque o filtro." : "Os leads que você cadastrar (no app ou pela extensão do WhatsApp) aparecem aqui."} />
        ) : modo === "grade" ? (
          <div className="clientes-grade" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: 12 }}>
            {lista.map(l => <CartaoCliente key={l.id} l={l} onClick={() => onOpenLead(l)} />)}
          </div>
        ) : (
          <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12, overflow: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
              <thead>
                <tr style={{ background: "var(--surface-2)", borderBottom: "1px solid var(--line)", textAlign: "left" }}>
                  {["Empresa", "Contato", "Operadora", "Etapa", "Valor", "Fidelidade", ehCoord ? "Consultor" : "WhatsApp", "Criado"].map(h => (
                    <th key={h} style={{ padding: "9px 12px", fontSize: 13.5, fontWeight: 600, color: "var(--ink-3)", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lista.map(l => {
                  const d = diasFidelidade(l.fim_fidelidade);
                  return (
                    <tr key={l.id} onClick={() => onOpenLead(l)} className="nav-item" style={{ borderBottom: "1px solid var(--line)", cursor: "pointer" }}>
                      <td style={{ padding: "9px 12px", fontWeight: 600 }}>{l.empresa}</td>
                      <td style={{ padding: "9px 12px", color: "var(--ink-2)" }}>{l.contato}</td>
                      <td style={{ padding: "9px 12px" }}><OperadoraTag op={l.operadora} /></td>
                      <td style={{ padding: "9px 12px" }}><EtapaTag s={l.status} /></td>
                      <td style={{ padding: "9px 12px", fontVariantNumeric: "tabular-nums" }}>{fmtBRL(Number(l.valor || 0))}</td>
                      <td style={{ padding: "9px 12px", color: d !== null && d <= 60 ? "var(--amber-text)" : "var(--ink-3)" }}>{l.fim_fidelidade ? parseDateOnly(l.fim_fidelidade).toLocaleDateString("pt-BR") : "—"}</td>
                      <td style={{ padding: "9px 12px", color: "var(--ink-2)" }}>{ehCoord ? l.rep?.nome ?? "—" : l.telefone ? fmtTelefone(l.telefone) : "—"}</td>
                      <td style={{ padding: "9px 12px", color: "var(--ink-3)" }}>{new Date(l.created_at).toLocaleDateString("pt-BR")}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function CartaoCliente({ l, onClick }: { l: UiLead; onClick: () => void }) {
  const cor = corEtapa(l.status);
  const fechado = l.status === "fechado";
  const d = diasFidelidade(l.fim_fidelidade);
  const aberto = !["fechado", "perdido"].includes(l.status);
  const sub = l.status === "perdido" && l.motivo_perda ? `Perdido · ${l.motivo_perda}`
    : l.advox_caso_id ? "No jurídico"
    : aberto && d !== null && d <= 60 ? (d < 0 ? "Fidelidade vencida, sem multa" : `Fidelidade vence em ${d}d`)
    : l.contato;
  return (
    <button onClick={onClick} className="card-hover" style={{
      textAlign: "left", cursor: "pointer", display: "flex", flexDirection: "column", gap: 4, minWidth: 0,
      border: `1px solid ${fechado ? "color-mix(in oklch, var(--green) 45%, var(--line))" : "var(--line)"}`, borderTop: `3px solid ${cor}`,
      borderRadius: 12, padding: "12px 14px", boxShadow: "var(--shadow-sm)",
      background: fechado ? "color-mix(in oklch, var(--green) 12%, var(--surface))" : "var(--surface)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <OperadoraTag op={l.operadora} />
        <div style={{ flex: 1 }} />
        <EtapaTag s={l.status} />
      </div>
      <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.empresa}</div>
      <div style={{ fontSize: 12, color: aberto && d !== null && d <= 60 && !l.advox_caso_id ? "var(--amber-text)" : "var(--ink-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sub}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 10, fontSize: 11.5, color: "var(--ink-3)" }}>
        {l.rep ? <><Avatar name={l.rep.nome} size={22} /><span style={{ color: "var(--ink-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.rep.nome.split(" ")[0]}</span></> : <span>—</span>}
        <span style={{ marginLeft: "auto", fontVariantNumeric: "tabular-nums", fontWeight: 600, color: "var(--ink-2)" }}>{fmtBRL(Number(l.valor || 0))}</span>
        <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 11 }}>{new Date(l.created_at).toLocaleDateString("pt-BR")}</span>
      </div>
    </button>
  );
}

function EtapaTag({ s }: { s: string }) {
  const cor = corEtapa(s);
  return (
    <span style={{
      fontSize: 13, fontWeight: 600, padding: "2px 8px", borderRadius: 99, whiteSpace: "nowrap",
      color: `color-mix(in oklch, ${cor} 75%, black)`, background: `color-mix(in oklch, ${cor} 13%, var(--surface))`,
    }}>{rotuloEtapa(s).replace(" (Advox)", "")}</span>
  );
}

function Filtro({ valor, onChange, vazio, opcoes }: { valor: string; onChange: (v: string) => void; vazio: string; opcoes: [string, string][] }) {
  return (
    <select value={valor} onChange={e => onChange(e.target.value)} style={{ ...selectCls, borderColor: valor ? "var(--navy)" : "var(--line)", color: valor ? "var(--navy)" : "var(--ink-2)" }}>
      <option value="">{vazio}</option>
      {opcoes.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );
}

const selectCls: React.CSSProperties = { border: "1px solid var(--line)", borderRadius: 8, padding: "6px 8px", fontSize: 12, background: "var(--surface)", color: "var(--ink-2)", fontFamily: "inherit", cursor: "pointer" };
