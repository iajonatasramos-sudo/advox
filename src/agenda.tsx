// Minha Agenda (layout do BuildClinic): guias Agenda · Notas · Etiquetas.
// - Agenda: calendário Dia / Semana / Mês / Atrasadas das atividades (tabela
//   `tarefas`), com etiquetas = tipo da atividade (Ligação, WhatsApp, …).
// - Notas: anotações pessoais (tabela `anotacoes`, só o dono vê).
// - Etiquetas: atividades pendentes agrupadas por tipo, com concluir.
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { Ic } from "./icons";
import { Btn, Empty, Field, Input, Tabs } from "./ui";
import { useAuth } from "./auth";
import { supabase } from "./lib/supabase";
import { sbx } from "./lib/db-extra";
import {
  useLiveLeads, useLiveTarefas, toggleTarefa, TIPOS_ATIVIDADE,
  type UiLead, type UiTarefa,
  ehGestor,
} from "./lib/data-live";
import type { TipoAtividade } from "./lib/database.types";

/* ───────────── utilidades de data ───────────── */

const DIAS = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];
const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

const inicioDia = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const somaDias = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const mesmoDia = (a: Date, b: Date) => a.toDateString() === b.toDateString();
const inicioSemana = (d: Date) => somaDias(inicioDia(d), -d.getDay());
const ddmm = (d: Date) => `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
const hhmm = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
const temHora = (iso: string) => { const d = new Date(iso); return !(d.getHours() === 0 && d.getMinutes() === 0); };
const paraInputData = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Cor de cada tipo (a "etiqueta" da atividade). */
export const COR_TIPO: Record<TipoAtividade, string> = {
  ligacao: "var(--blue)",
  whatsapp: "var(--green)",
  visita: "var(--violet)",
  reuniao: "var(--amber)",
  email: "var(--teal)",
  tarefa: "var(--ink-3)",
};
const rotuloTipo = (t: TipoAtividade) => TIPOS_ATIVIDADE.find(x => x.id === t)?.label ?? t;

type Visao = "dia" | "semana" | "mes" | "atrasadas";

/* ───────────── tela ───────────── */

export function MinhaAgenda({ onOpenLead }: { onOpenLead: (l: UiLead) => void }) {
  const [aba, setAba] = useState("agenda");
  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100%" }}>
      <div style={{ padding: "0 18px", background: "var(--surface)" }}>
        <Tabs
          tabs={[
            { id: "agenda", label: "Agenda", icon: <Ic.Calendar size={13} /> },
            { id: "notas", label: "Notas", icon: <Ic.Doc size={13} /> },
            { id: "etiquetas", label: "Etiquetas", icon: <Ic.Tag size={13} /> },
          ]}
          active={aba}
          onChange={setAba}
        />
      </div>
      {aba === "agenda" && <AgendaCalendario onOpenLead={onOpenLead} />}
      {aba === "notas" && <NotasPanel />}
      {aba === "etiquetas" && <EtiquetasView onOpenLead={onOpenLead} />}
    </div>
  );
}

/** Tarefas do usuário (coord pode ver as do time). */
function useMinhasTarefas(escopo: "eu" | "time") {
  const { profile } = useAuth();
  const ehCoord = ehGestor(profile?.papel);
  const filtro = escopo === "time" && ehCoord ? {} : { autorId: profile?.id };
  return useLiveTarefas(filtro);
}

export function AgendaCalendario({ onOpenLead }: { onOpenLead: (l: UiLead) => void }) {
  const { profile } = useAuth();
  const ehCoord = ehGestor(profile?.papel);
  const [escopo, setEscopo] = useState<"eu" | "time">("eu");
  const { tarefas, refresh } = useMinhasTarefas(escopo);
  // No celular a semana não cabe (7 colunas): abre no Dia.
  const [visao, setVisao] = useState<Visao>(() => (typeof window !== "undefined" && window.innerWidth <= 768 ? "dia" : "semana"));
  const [ref, setRef] = useState(() => inicioDia(new Date()));
  const [busca, setBusca] = useState("");
  const [buscaCliente, setBuscaCliente] = useState("");
  const [tipos, setTipos] = useState<TipoAtividade[]>([]);
  const [nova, setNova] = useState<Date | null>(null);
  const [aberta, setAberta] = useState<UiTarefa | null>(null);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const qc = buscaCliente.trim().toLowerCase();
    return (tarefas ?? []).filter(t =>
      (!tipos.length || tipos.includes(t.tipo)) &&
      (!q || t.descricao.toLowerCase().includes(q)) &&
      (!qc || (t.lead?.empresa ?? "").toLowerCase().includes(qc) || (t.lead?.contato ?? "").toLowerCase().includes(qc)),
    );
  }, [tarefas, busca, buscaCliente, tipos]);

  const atrasadas = useMemo(
    () => filtradas.filter(t => !t.completed && t.quando && new Date(t.quando) < new Date()),
    [filtradas],
  );

  const doDia = useCallback(
    (d: Date) => filtradas.filter(t => t.quando && mesmoDia(new Date(t.quando), d))
      .sort((a, b) => (a.quando ?? "").localeCompare(b.quando ?? "")),
    [filtradas],
  );

  const navegar = (dir: -1 | 1) => {
    if (visao === "dia") setRef(r => somaDias(r, dir));
    else if (visao === "mes") setRef(r => new Date(r.getFullYear(), r.getMonth() + dir, 1));
    else setRef(r => somaDias(r, 7 * dir));
  };

  const rotuloPeriodo = (() => {
    if (visao === "dia") return ref.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" });
    if (visao === "mes") return `${MESES[ref.getMonth()]} ${ref.getFullYear()}`;
    const ini = inicioSemana(ref);
    return `${ddmm(ini)} – ${ddmm(somaDias(ini, 6))}/${somaDias(ini, 6).getFullYear()}`;
  })();

  const total = (tarefas ?? []).filter(t => !t.completed).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      {/* Linha 1: busca por cliente + pessoa + total */}
      <div className="agenda-barra" style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 18px", background: "var(--surface-2)", borderBottom: "1px solid var(--line)", flexWrap: "wrap" }}>
        <div style={{ width: 240, maxWidth: "100%" }}>
          <Input full size="sm" icon={<Ic.Search size={13} />} value={buscaCliente} onChange={e => setBuscaCliente(e.target.value)} placeholder="Buscar por cliente ou empresa…" />
        </div>
        {ehCoord && (
          <select value={escopo} onChange={e => setEscopo(e.target.value as "eu" | "time")} style={selectChip}>
            <option value="eu">{profile?.nome} (eu)</option>
            <option value="time">Todo o time</option>
          </select>
        )}
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 12, color: "var(--ink-3)" }}><b style={{ color: "var(--ink)" }}>{total}</b> atividades pendentes</span>
      </div>

      {/* Linha 2: visão + período + busca + nova */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 18px 6px", flexWrap: "wrap" }}>
        <div style={segBox}>
          {(["dia", "semana", "mes"] as Visao[]).map(v => (
            <button key={v} onClick={() => setVisao(v)} style={segBtn(visao === v)}>{v === "dia" ? "Dia" : v === "semana" ? "Semana" : "Mês"}</button>
          ))}
          <button onClick={() => setVisao("atrasadas")} style={segBtn(visao === "atrasadas")}>
            <Ic.Warn size={12} /> Atrasadas {atrasadas.length > 0 && <span style={{ color: visao === "atrasadas" ? "inherit" : "var(--rose)", fontWeight: 700 }}>{atrasadas.length}</span>}
          </button>
        </div>
        {visao !== "atrasadas" && (
          <div style={{ ...segBox, alignItems: "center" }}>
            <button onClick={() => navegar(-1)} style={segBtn(false)} aria-label="Anterior"><Ic.ArrowLeft size={12} /></button>
            <span style={{ fontSize: 12.5, fontWeight: 600, padding: "0 10px", minWidth: 150, textAlign: "center", textTransform: visao === "dia" ? "capitalize" : undefined }}>{rotuloPeriodo}</span>
            <button onClick={() => navegar(1)} style={segBtn(false)} aria-label="Próximo"><Ic.ArrowRight size={12} /></button>
          </div>
        )}
        {visao !== "atrasadas" && <Btn size="sm" onClick={() => setRef(inicioDia(new Date()))}>Hoje</Btn>}
        <div style={{ flex: 1 }} />
        <div style={{ width: 200 }}>
          <Input full size="sm" icon={<Ic.Search size={13} />} value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar atividades…" />
        </div>
        <Btn size="sm" variant="primary" icon={<Ic.Plus size={13} />} onClick={() => setNova(visao === "dia" ? ref : inicioDia(new Date()))}>Nova atividade</Btn>
      </div>

      {/* Etiquetas (tipos) */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "2px 18px 10px", flexWrap: "wrap" }}>
        <span style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: "0.06em", color: "var(--ink-4)" }}>ETIQUETAS:</span>
        <button onClick={() => setTipos([])} style={chip(tipos.length === 0, "var(--navy)")}>Todas</button>
        {TIPOS_ATIVIDADE.map(t => {
          const on = tipos.includes(t.id);
          return (
            <button key={t.id} onClick={() => setTipos(on ? tipos.filter(x => x !== t.id) : [...tipos, t.id])} style={chip(on, COR_TIPO[t.id])}>
              <span style={{ width: 7, height: 7, borderRadius: 99, background: on ? "white" : COR_TIPO[t.id] }} />{t.label}
            </button>
          );
        })}
      </div>

      <div style={{ flex: 1, minHeight: 0, borderTop: "1px solid var(--line)", background: "var(--surface)" }}>
        {tarefas === null ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--ink-3)", fontSize: 13 }}>Carregando…</div>
        ) : visao === "semana" ? (
          <Semana inicio={inicioSemana(ref)} doDia={doDia} onNova={setNova} onAbrir={setAberta} />
        ) : visao === "mes" ? (
          <Mes ref_={ref} doDia={doDia} onNova={setNova} onAbrir={setAberta} onDia={(d) => { setRef(d); setVisao("dia"); }} />
        ) : visao === "dia" ? (
          <Lista itens={doDia(ref)} vazio="Nenhuma atividade neste dia." onAbrir={setAberta} onMudou={refresh} onNova={() => setNova(ref)} />
        ) : (
          <Lista itens={[...atrasadas].sort((a, b) => (a.quando ?? "").localeCompare(b.quando ?? ""))} vazio="Nenhuma atividade atrasada. 🎉" onAbrir={setAberta} onMudou={refresh} mostrarData />
        )}
      </div>

      {nova && <AtividadeModal dia={nova} onClose={() => { setNova(null); refresh(); }} />}
      {aberta && (
        <AtividadeModal
          tarefa={aberta}
          onClose={() => { setAberta(null); refresh(); }}
          onOpenLead={aberta.lead_id ? async () => {
            const { data } = await supabase.from("leads").select("*, rep:profiles!leads_rep_id_fkey(id, nome, email), revenda:revendas!leads_revenda_id_fkey(id, nome), advox_caso:casos!leads_advox_caso_fk(id, status)").eq("id", aberta.lead_id!).maybeSingle();
            if (data) { setAberta(null); onOpenLead(data as unknown as UiLead); }
          } : undefined}
        />
      )}
    </div>
  );
}

/* ───────────── visões ───────────── */

function Semana({ inicio, doDia, onNova, onAbrir }: { inicio: Date; doDia: (d: Date) => UiTarefa[]; onNova: (d: Date) => void; onAbrir: (t: UiTarefa) => void }) {
  const hoje = inicioDia(new Date());
  const dias = Array.from({ length: 7 }, (_, i) => somaDias(inicio, i));
  return (
    <div className="agenda-semana" style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(120px, 1fr))", overflowX: "auto", minHeight: 480, height: "100%" }}>
      {dias.map((d, i) => {
        const eHoje = mesmoDia(d, hoje);
        return (
          <div key={i} style={{ borderRight: i < 6 ? "1px solid var(--line)" : 0, display: "flex", flexDirection: "column", minWidth: 0, background: eHoje ? "color-mix(in oklch, var(--navy) 3%, var(--surface))" : undefined }}>
            <div style={{ textAlign: "center", padding: "10px 4px 8px", borderBottom: "1px solid var(--line)", background: eHoje ? "var(--navy-soft)" : "var(--surface-2)" }}>
              <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: "0.06em", color: eHoje ? "var(--navy)" : "var(--ink-3)" }}>{DIAS[d.getDay()]}</div>
              <div style={{ fontSize: 19, fontWeight: 700, color: eHoje ? "var(--navy)" : "var(--ink)" }}>{d.getDate()}</div>
            </div>
            <div style={{ padding: 6, display: "flex", flexDirection: "column", gap: 5, flex: 1 }}>
              <button onClick={() => onNova(d)} title="Nova atividade neste dia" style={{ border: "1px dashed var(--line-2)", background: "transparent", borderRadius: 6, color: "var(--ink-4)", cursor: "pointer", padding: "2px 0", fontSize: 13 }}>+</button>
              {doDia(d).map(t => <CartaoTarefa key={t.id} t={t} onClick={() => onAbrir(t)} />)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Mes({ ref_, doDia, onNova, onAbrir, onDia }: { ref_: Date; doDia: (d: Date) => UiTarefa[]; onNova: (d: Date) => void; onAbrir: (t: UiTarefa) => void; onDia: (d: Date) => void }) {
  const primeiro = new Date(ref_.getFullYear(), ref_.getMonth(), 1);
  const ini = inicioSemana(primeiro);
  const hoje = inicioDia(new Date());
  const celulas = Array.from({ length: 42 }, (_, i) => somaDias(ini, i));
  return (
    <div style={{ overflowX: "auto" }}>
      <div className="agenda-mes-cab" style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(110px, 1fr))", borderBottom: "1px solid var(--line)", background: "var(--surface-2)" }}>
        {DIAS.map(d => <div key={d} style={{ textAlign: "center", padding: "8px 0", fontSize: 10.5, fontWeight: 600, letterSpacing: "0.06em", color: "var(--ink-3)" }}>{d}</div>)}
      </div>
      <div className="agenda-mes-grade" style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(110px, 1fr))" }}>
        {celulas.map((d, i) => {
          const doMes = d.getMonth() === ref_.getMonth();
          const itens = doDia(d);
          const eHoje = mesmoDia(d, hoje);
          return (
            <div key={i} onDoubleClick={() => onNova(d)} style={{
              minHeight: 108, padding: 6, borderRight: (i % 7) < 6 ? "1px solid var(--line)" : 0, borderBottom: "1px solid var(--line)",
              background: eHoje ? "var(--navy-soft)" : doMes ? "var(--surface)" : "var(--surface-2)", display: "flex", flexDirection: "column", gap: 3,
            }}>
              <button onClick={() => onDia(d)} style={{
                alignSelf: "flex-start", border: 0, cursor: "pointer", fontSize: 11.5, fontWeight: 600, borderRadius: 99, minWidth: 22, height: 22,
                background: eHoje ? "var(--navy)" : "transparent", color: eHoje ? "var(--navy-ink)" : doMes ? "var(--ink-2)" : "var(--ink-4)",
              }}>{d.getDate()}</button>
              {itens.slice(0, 3).map(t => <CartaoTarefa key={t.id} t={t} compacto onClick={() => onAbrir(t)} />)}
              {itens.length > 3 && <button onClick={() => onDia(d)} style={{ border: 0, background: "transparent", fontSize: 11, color: "var(--navy)", cursor: "pointer", textAlign: "left", padding: 0 }}>+{itens.length - 3} mais</button>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Lista({ itens, vazio, onAbrir, onMudou, onNova, mostrarData }: { itens: UiTarefa[]; vazio: string; onAbrir: (t: UiTarefa) => void; onMudou: () => void; onNova?: () => void; mostrarData?: boolean }) {
  if (!itens.length) {
    return <Empty icon={<Ic.Calendar size={20} />} title={vazio} action={onNova ? <Btn size="sm" icon={<Ic.Plus size={12} />} onClick={onNova}>Nova atividade</Btn> : undefined} />;
  }
  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "14px 18px", display: "flex", flexDirection: "column", gap: 8 }}>
      {itens.map(t => <LinhaTarefa key={t.id} t={t} onAbrir={() => onAbrir(t)} onMudou={onMudou} mostrarData={mostrarData} />)}
    </div>
  );
}

function CartaoTarefa({ t, onClick, compacto }: { t: UiTarefa; onClick: () => void; compacto?: boolean }) {
  const atrasada = !t.completed && !!t.quando && new Date(t.quando) < new Date();
  const cor = COR_TIPO[t.tipo];
  return (
    <button onClick={onClick} title={`${rotuloTipo(t.tipo)} · ${t.descricao}${t.lead ? ` — ${t.lead.empresa}` : ""}`} className={compacto ? "card-hover tarefa-compacta" : "card-hover"} style={{
      textAlign: "left", cursor: "pointer", border: "1px solid var(--line)", borderLeft: `3px solid ${cor}`,
      background: t.completed ? "var(--surface-2)" : "var(--surface)", borderRadius: 6, padding: compacto ? "2px 6px" : "5px 7px",
      display: "flex", flexDirection: "column", gap: 1, minWidth: 0, opacity: t.completed ? 0.6 : 1,
    }}>
      <span style={{ fontSize: compacto ? 11 : 11.5, fontWeight: 600, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textDecoration: t.completed ? "line-through" : undefined }}>
        {t.quando && temHora(t.quando) && <span style={{ color: atrasada ? "var(--rose)" : "var(--ink-3)", fontWeight: 600, marginRight: 4 }}>{hhmm(t.quando)}</span>}
        {t.descricao}
      </span>
      {!compacto && t.lead && <span style={{ fontSize: 10.5, color: "var(--ink-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.lead.empresa}</span>}
    </button>
  );
}

function LinhaTarefa({ t, onAbrir, onMudou, mostrarData }: { t: UiTarefa; onAbrir: () => void; onMudou: () => void; mostrarData?: boolean }) {
  const atrasada = !t.completed && !!t.quando && new Date(t.quando) < new Date();
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 12px", border: "1px solid var(--line)", borderRadius: 10, background: "var(--surface)" }}>
      <button
        onClick={async () => { await toggleTarefa(t.id, !t.completed); onMudou(); }}
        title={t.completed ? "Reabrir" : "Concluir"}
        style={{ width: 20, height: 20, borderRadius: 99, flexShrink: 0, marginTop: 1, cursor: "pointer", border: `1.5px solid ${t.completed ? "var(--green)" : "var(--line-strong)"}`, background: t.completed ? "var(--green)" : "transparent", color: "white", display: "inline-flex", alignItems: "center", justifyContent: "center" }}
      >{t.completed && <Ic.Check size={11} />}</button>
      <button onClick={onAbrir} style={{ flex: 1, minWidth: 0, textAlign: "left", border: 0, background: "transparent", cursor: "pointer", padding: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", textDecoration: t.completed ? "line-through" : undefined }}>{t.descricao}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 3, fontSize: 11.5, color: "var(--ink-3)" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: COR_TIPO[t.tipo], fontWeight: 600 }}>
            <span style={{ width: 7, height: 7, borderRadius: 99, background: COR_TIPO[t.tipo] }} />{rotuloTipo(t.tipo)}
          </span>
          {t.quando && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 3, color: atrasada ? "var(--rose)" : undefined, fontWeight: atrasada ? 600 : 400 }}>
              <Ic.Clock size={11} />{mostrarData ? ddmm(new Date(t.quando)) + " " : ""}{temHora(t.quando) ? hhmm(t.quando) : mostrarData ? "" : "dia todo"}
            </span>
          )}
          {t.lead && <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}><Ic.Briefcase size={11} />{t.lead.empresa}</span>}
          {t.autor && <span>· {t.autor.nome}</span>}
        </div>
      </button>
    </div>
  );
}

/* ───────────── modal criar / editar ───────────── */

function AtividadeModal({ dia, tarefa, onClose, onOpenLead }: { dia?: Date; tarefa?: UiTarefa; onClose: () => void; onOpenLead?: () => void }) {
  const { profile } = useAuth();
  const ehCoord = ehGestor(profile?.papel);
  const { leads } = useLiveLeads(ehCoord ? {} : { repId: profile?.id });
  const ini = tarefa?.quando ? new Date(tarefa.quando) : dia ?? new Date();
  const [descricao, setDescricao] = useState(tarefa?.descricao ?? "");
  const [tipo, setTipo] = useState<TipoAtividade>(tarefa?.tipo ?? "ligacao");
  const [data, setData] = useState(paraInputData(ini));
  const [hora, setHora] = useState(tarefa?.quando && temHora(tarefa.quando) ? hhmm(tarefa.quando) : "");
  const [leadId, setLeadId] = useState<string>(tarefa?.lead_id ?? "");
  const [buscaLead, setBuscaLead] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const meu = !tarefa || tarefa.autor_id === profile?.id;

  const leadsFiltrados = useMemo(() => {
    const q = buscaLead.trim().toLowerCase();
    return (leads ?? []).filter(l => !q || l.empresa.toLowerCase().includes(q) || l.contato.toLowerCase().includes(q)).slice(0, 40);
  }, [leads, buscaLead]);
  const leadSel = (leads ?? []).find(l => l.id === leadId);

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.id || !descricao.trim()) { setErr("Dê um título à atividade."); return; }
    setBusy(true); setErr(null);
    const [y, m, d] = data.split("-").map(Number);
    const [hh, mm] = hora ? hora.split(":").map(Number) : [0, 0];
    const quando = data ? new Date(y, m - 1, d, hh, mm).toISOString() : null;
    const campos = { descricao: descricao.trim(), tipo, quando, lead_id: leadId || null };
    const { error } = tarefa
      ? await supabase.from("tarefas").update(campos as never).eq("id", tarefa.id)
      : await supabase.from("tarefas").insert({ ...campos, autor_id: profile.id, prioridade: "media", urgencia: "hoje" } as never);
    setBusy(false);
    if (error) { setErr(error.message); return; }
    onClose();
  };

  const excluir = async () => {
    if (!tarefa || !window.confirm(`Excluir a atividade "${tarefa.descricao}"?`)) return;
    const { error } = await supabase.from("tarefas").delete().eq("id", tarefa.id);
    if (error) { setErr(error.message); return; }
    onClose();
  };

  return (
    <div onClick={onClose} className="modal-backdrop" style={backdrop}>
      <div onClick={e => e.stopPropagation()} className="modal-shell fade-up" style={{ ...shell, width: 540 }}>
        <div style={modalHead}>
          <span style={{ ...iconeHead, background: COR_TIPO[tipo] }}><Ic.Calendar size={15} /></span>
          <div style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>{tarefa ? "Atividade" : "Nova atividade"}</div>
          {tarefa && (
            <Btn size="sm" variant={tarefa.completed ? "default" : "soft"} icon={<Ic.Check size={12} />} onClick={async () => { await toggleTarefa(tarefa.id, !tarefa.completed); onClose(); }}>
              {tarefa.completed ? "Reabrir" : "Concluir"}
            </Btn>
          )}
          <button onClick={onClose} style={xBtn}><Ic.X size={16} /></button>
        </div>
        <form onSubmit={salvar} style={{ padding: 18, display: "flex", flexDirection: "column", gap: 12, overflowY: "auto" }}>
          {err && <div style={erroBox}>{err}</div>}
          <Field label="Cliente">
            {leadSel ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8, border: "1px solid var(--line)", borderRadius: 8, padding: "8px 10px", background: "var(--surface-2)" }}>
                <Ic.Briefcase size={13} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{leadSel.empresa}</div>
                  <div style={{ fontSize: 11.5, color: "var(--ink-3)" }}>{leadSel.contato}</div>
                </div>
                {onOpenLead && <Btn size="sm" variant="link" onClick={onOpenLead}>Abrir ficha</Btn>}
                {meu && <Btn size="sm" variant="ghost" onClick={() => setLeadId("")}>Trocar</Btn>}
              </div>
            ) : (
              <div style={{ border: "1px solid var(--line)", borderRadius: 8, overflow: "hidden" }}>
                <div style={{ padding: "7px 10px", fontSize: 12, color: "var(--amber-text)", background: "var(--amber-soft)", display: "flex", alignItems: "center", gap: 6 }}>
                  <Ic.Briefcase size={12} /> Atividade sem cliente <span style={{ marginLeft: "auto", fontSize: 11 }}>(escolha abaixo para vincular)</span>
                </div>
                <div style={{ padding: 8, borderTop: "1px solid var(--line)" }}>
                  <Input full size="sm" icon={<Ic.Search size={12} />} value={buscaLead} onChange={e => setBuscaLead(e.target.value)} placeholder="Buscar cliente por empresa ou contato…" />
                </div>
                <div style={{ maxHeight: 150, overflowY: "auto", borderTop: "1px solid var(--line)" }}>
                  {leadsFiltrados.map(l => (
                    <button key={l.id} type="button" onClick={() => setLeadId(l.id)} className="nav-item" style={{ display: "flex", width: "100%", gap: 8, padding: "6px 10px", border: 0, background: "transparent", cursor: "pointer", textAlign: "left", fontSize: 12.5 }}>
                      <span style={{ fontWeight: 600 }}>{l.empresa}</span><span style={{ color: "var(--ink-3)" }}>{l.contato}</span>
                    </button>
                  ))}
                  {leadsFiltrados.length === 0 && <div style={{ padding: 10, fontSize: 12, color: "var(--ink-3)" }}>Nenhum cliente encontrado.</div>}
                </div>
              </div>
            )}
          </Field>
          <Field label="Título">
            <Input full autoFocus={!tarefa} value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Ex.: ligar para o cliente, enviar proposta…" />
          </Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field label="Data"><Input full type="date" value={data} onChange={e => setData(e.target.value)} /></Field>
            <Field label="Hora (opcional)"><Input full type="time" value={hora} onChange={e => setHora(e.target.value)} /></Field>
          </div>
          <Field label="Etiqueta">
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {TIPOS_ATIVIDADE.map(t => (
                <button type="button" key={t.id} onClick={() => setTipo(t.id)} style={chip(tipo === t.id, COR_TIPO[t.id])}>
                  <span style={{ width: 7, height: 7, borderRadius: 99, background: tipo === t.id ? "white" : COR_TIPO[t.id] }} />{t.label}
                </button>
              ))}
            </div>
          </Field>
          {tarefa?.autor && !meu && <div style={{ fontSize: 12, color: "var(--ink-3)" }}>Atividade de {tarefa.autor.nome} — só quem criou pode editar.</div>}
          <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 4 }}>
            {tarefa && meu && <Btn variant="danger" size="sm" icon={<Ic.Trash size={12} />} onClick={excluir}>Excluir</Btn>}
            <div style={{ flex: 1 }} />
            <Btn onClick={onClose}>Cancelar</Btn>
            {meu && <Btn type="submit" variant="primary" disabled={busy} icon={<Ic.Check size={13} />}>{busy ? "Salvando…" : tarefa ? "Salvar" : "Criar atividade"}</Btn>}
          </div>
        </form>
      </div>
    </div>
  );
}

/* ───────────── Etiquetas: pendentes agrupadas por tipo ───────────── */

function EtiquetasView({ onOpenLead }: { onOpenLead: (l: UiLead) => void }) {
  const { tarefas, refresh } = useMinhasTarefas("eu");
  const [concluidas, setConcluidas] = useState(false);
  const [fechados, setFechados] = useState<Set<string>>(new Set());
  const [busca, setBusca] = useState("");
  const [aberta, setAberta] = useState<UiTarefa | null>(null);

  const lista = (tarefas ?? []).filter(t => (concluidas || !t.completed) && (!busca.trim() || `${t.descricao} ${t.lead?.empresa ?? ""}`.toLowerCase().includes(busca.toLowerCase())));
  const pendentes = (tarefas ?? []).filter(t => !t.completed).length;

  return (
    <div style={{ padding: "14px 18px" }}>
      <div style={{ maxWidth: 760, margin: "0 auto", display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12.5, color: "var(--ink-3)" }}><b style={{ color: "var(--ink)" }}>{pendentes}</b> atividades pendentes</span>
          <div style={{ flex: 1 }} />
          <div style={{ width: 220 }}><Input full size="sm" icon={<Ic.Search size={12} />} value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar…" /></div>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--ink-2)", cursor: "pointer" }}>
            <input type="checkbox" checked={concluidas} onChange={e => setConcluidas(e.target.checked)} /> Mostrar concluídas
          </label>
        </div>
        {tarefas === null ? <div style={{ padding: 30, textAlign: "center", color: "var(--ink-3)" }}>Carregando…</div> : TIPOS_ATIVIDADE.map(tp => {
          const itens = lista.filter(t => t.tipo === tp.id).sort((a, b) => (a.quando ?? "9").localeCompare(b.quando ?? "9"));
          if (!itens.length) return null;
          const fechado = fechados.has(tp.id);
          return (
            <div key={tp.id}>
              <button onClick={() => setFechados(s => { const n = new Set(s); n.has(tp.id) ? n.delete(tp.id) : n.add(tp.id); return n; })}
                style={{ display: "flex", alignItems: "center", gap: 7, border: 0, background: "transparent", cursor: "pointer", padding: "4px 0", fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>
                <span style={{ display: "inline-flex", transform: fechado ? "rotate(-90deg)" : undefined, transition: "transform .15s" }}><Ic.ChevronDown size={13} /></span>
                <span style={{ width: 8, height: 8, borderRadius: 99, background: COR_TIPO[tp.id] }} />{tp.label}
                <span style={{ fontSize: 11, color: "var(--ink-4)", fontWeight: 500 }}>{itens.length}</span>
              </button>
              {!fechado && (
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
                  {itens.map(t => <LinhaTarefa key={t.id} t={t} onAbrir={() => setAberta(t)} onMudou={refresh} mostrarData />)}
                </div>
              )}
            </div>
          );
        })}
        {tarefas && lista.length === 0 && <Empty icon={<Ic.Tag size={20} />} title="Nada por aqui" hint="As atividades criadas na agenda, no lead ou na extensão do WhatsApp aparecem agrupadas por etiqueta." />}
      </div>
      {aberta && (
        <AtividadeModal tarefa={aberta} onClose={() => { setAberta(null); refresh(); }}
          onOpenLead={aberta.lead_id ? async () => {
            const { data } = await supabase.from("leads").select("*, rep:profiles!leads_rep_id_fkey(id, nome, email), revenda:revendas!leads_revenda_id_fkey(id, nome), advox_caso:casos!leads_advox_caso_fk(id, status)").eq("id", aberta.lead_id!).maybeSingle();
            if (data) { setAberta(null); onOpenLead(data as unknown as UiLead); }
          } : undefined} />
      )}
    </div>
  );
}

/* ───────────── Notas pessoais ───────────── */

type Anotacao = { id: string; titulo: string; conteudo: string; categoria: string | null; updated_at: string };

function NotasPanel() {
  const { profile } = useAuth();
  const [notas, setNotas] = useState<Anotacao[] | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [cat, setCat] = useState<string | null>(null);
  const [editando, setEditando] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [conteudo, setConteudo] = useState("");
  const [categoria, setCategoria] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    const { data, error } = await sbx.from("anotacoes").select("id, titulo, conteudo, categoria, updated_at").order("updated_at", { ascending: false });
    if (error) { console.error("[Advox] anotacoes", error); setNotas([]); return; }
    setNotas((data ?? []) as unknown as Anotacao[]);
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  const categorias = [...new Set((notas ?? []).map(n => n.categoria).filter(Boolean) as string[])].sort();
  const filtradas = (notas ?? []).filter(n =>
    (cat === null || (cat === "" ? !n.categoria : n.categoria === cat)) &&
    (!busca.trim() || `${n.titulo} ${n.conteudo} ${n.categoria ?? ""}`.toLowerCase().includes(busca.toLowerCase())));
  const atual = (notas ?? []).find(n => n.id === sel) ?? null;

  useEffect(() => { if (!sel && filtradas.length) setSel(filtradas[0].id); }, [notas]);

  const comecarEdicao = (n: Anotacao | null) => {
    setTitulo(n?.titulo ?? ""); setConteudo(n?.conteudo ?? ""); setCategoria(n?.categoria ?? ""); setErr(null);
    setEditando(true);
    if (!n) setSel(null);
  };

  const salvar = async () => {
    if (!titulo.trim()) { setErr("Dê um título à nota."); return; }
    const campos = { titulo: titulo.trim(), conteudo, categoria: categoria.trim() || null };
    const r = atual && sel
      ? await sbx.from("anotacoes").update(campos as never).eq("id", sel).select("id").single()
      : await sbx.from("anotacoes").insert({ ...campos, dono_id: profile?.id }).select("id").single();
    if (r.error) { setErr(r.error.message); return; }
    setEditando(false);
    setSel((r.data as unknown as { id: string }).id);
    carregar();
  };

  const excluir = async () => {
    if (!atual || !window.confirm(`Excluir a nota "${atual.titulo}"?`)) return;
    await sbx.from("anotacoes").delete().eq("id", atual.id);
    setSel(null); carregar();
  };

  return (
    <div className="notas-grid" style={{ display: "grid", gridTemplateColumns: "280px 1fr", flex: 1, minHeight: 520 }}>
      <aside style={{ borderRight: "1px solid var(--line)", background: "var(--surface)", padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
        <Input full size="sm" icon={<Ic.Search size={12} />} value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por título, categoria ou texto…" />
        <Btn variant="primary" size="sm" icon={<Ic.Plus size={12} />} onClick={() => comecarEdicao(null)} style={{ justifyContent: "center" }}>Nova nota</Btn>
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
          <button onClick={() => setCat(null)} style={chip(cat === null, "var(--navy)")}>Tudo</button>
          {categorias.map(c => <button key={c} onClick={() => setCat(c)} style={chip(cat === c, "var(--navy)")}>{c}</button>)}
          {(notas ?? []).some(n => !n.categoria) && <button onClick={() => setCat("")} style={chip(cat === "", "var(--navy)")}>Sem categoria</button>}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 2, overflowY: "auto" }}>
          {notas === null ? <div style={{ fontSize: 12, color: "var(--ink-3)", padding: 8 }}>Carregando…</div>
            : filtradas.length === 0 ? <div style={{ fontSize: 12, color: "var(--ink-3)", padding: 8 }}>Nenhuma nota.</div>
            : filtradas.map(n => (
              <button key={n.id} onClick={() => { setSel(n.id); setEditando(false); }} className={sel === n.id ? undefined : "nav-item"} style={{
                textAlign: "left", border: sel === n.id ? "1px solid var(--navy)" : "1px solid transparent", background: sel === n.id ? "var(--navy-soft)" : "transparent",
                borderRadius: 8, padding: "7px 9px", cursor: "pointer", display: "flex", gap: 7,
              }}>
                <Ic.Doc size={13} />
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.titulo}</span>
                  {n.categoria && <span style={{ fontSize: 11, color: "var(--ink-3)" }}>{n.categoria}</span>}
                </span>
              </button>
            ))}
        </div>
      </aside>
      <section style={{ padding: "20px 28px", background: "var(--surface)", minWidth: 0 }}>
        {editando ? (
          <div style={{ maxWidth: 760, display: "flex", flexDirection: "column", gap: 10 }}>
            {err && <div style={erroBox}>{err}</div>}
            <Input full autoFocus value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Título da nota" />
            <Input full size="sm" value={categoria} onChange={e => setCategoria(e.target.value)} placeholder="Categoria (opcional) — ex.: Reunião, Ideias" />
            <textarea value={conteudo} onChange={e => setConteudo(e.target.value)} rows={18} placeholder="Escreva aqui…" style={{
              width: "100%", resize: "vertical", border: "1px solid var(--line)", borderRadius: 8, padding: 12, fontFamily: "inherit", fontSize: 13.5, lineHeight: 1.6, color: "var(--ink)", background: "var(--surface)",
            }} />
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <Btn onClick={() => setEditando(false)}>Cancelar</Btn>
              <Btn variant="primary" icon={<Ic.Check size={13} />} onClick={salvar}>Salvar nota</Btn>
            </div>
          </div>
        ) : atual ? (
          <div style={{ maxWidth: 760 }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
              <div style={{ flex: 1 }}>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, letterSpacing: "-0.01em" }}>{atual.titulo}</h2>
                <div style={{ fontSize: 11.5, color: "var(--ink-4)", marginTop: 4, display: "flex", gap: 8 }}>
                  <span>Atualizada em {new Date(atual.updated_at).toLocaleDateString("pt-BR")}</span>
                  {atual.categoria && <span>· {atual.categoria}</span>}
                </div>
              </div>
              <Btn size="sm" icon={<Ic.Edit size={12} />} onClick={() => comecarEdicao(atual)}>Editar</Btn>
              <Btn size="sm" variant="danger" icon={<Ic.Trash size={12} />} onClick={excluir} />
            </div>
            <div style={{ marginTop: 20, fontSize: 14, lineHeight: 1.7, color: "var(--ink-2)", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
              {atual.conteudo ? linkificar(atual.conteudo) : <span style={{ color: "var(--ink-4)" }}>Nota vazia.</span>}
            </div>
          </div>
        ) : (
          <Empty icon={<Ic.Doc size={20} />} title="Suas notas" hint="Anotações pessoais — só você vê. Crie uma nota para começar." action={<Btn size="sm" variant="primary" icon={<Ic.Plus size={12} />} onClick={() => comecarEdicao(null)}>Nova nota</Btn>} />
        )}
      </section>
    </div>
  );
}

function linkificar(texto: string) {
  return texto.split(/(https?:\/\/\S+)/g).map((p, i) =>
    /^https?:\/\//.test(p) ? <a key={i} href={p} target="_blank" rel="noopener noreferrer" style={{ color: "var(--navy)" }}>{p}</a> : <React.Fragment key={i}>{p}</React.Fragment>);
}

/* ───────────── estilos ───────────── */

const segBox: React.CSSProperties = { display: "inline-flex", gap: 2, padding: 2, background: "var(--surface-2)", border: "1px solid var(--line)", borderRadius: 8 };
const segBtn = (on: boolean): React.CSSProperties => ({
  display: "inline-flex", alignItems: "center", gap: 5, border: 0, cursor: "pointer", borderRadius: 6, padding: "5px 11px", fontSize: 12, fontWeight: 600,
  background: on ? "var(--navy)" : "transparent", color: on ? "var(--navy-ink)" : "var(--ink-2)",
});
export const chip = (on: boolean, cor: string): React.CSSProperties => ({
  display: "inline-flex", alignItems: "center", gap: 5, cursor: "pointer", borderRadius: 99, padding: "3px 10px", fontSize: 11.5, fontWeight: 600,
  border: `1px solid ${on ? cor : "var(--line)"}`, background: on ? cor : "var(--surface)", color: on ? "white" : "var(--ink-2)",
});
const selectChip: React.CSSProperties = { border: "1px solid var(--navy)", color: "var(--navy)", background: "var(--navy-soft)", borderRadius: 8, padding: "5px 8px", fontSize: 12, fontWeight: 600, fontFamily: "inherit" };
export const backdrop: React.CSSProperties = { position: "fixed", inset: 0, zIndex: 100, background: "oklch(0.10 0.04 250 / 0.45)", backdropFilter: "blur(2px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 };
export const shell: React.CSSProperties = { maxWidth: "100%", maxHeight: "90vh", background: "var(--surface)", border: "1px solid var(--line-2)", borderRadius: 14, boxShadow: "var(--shadow-lg)", display: "flex", flexDirection: "column", overflow: "hidden" };
export const modalHead: React.CSSProperties = { padding: "14px 18px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", gap: 12 };
export const iconeHead: React.CSSProperties = { width: 28, height: 28, borderRadius: 8, background: "var(--navy)", color: "white", display: "inline-flex", alignItems: "center", justifyContent: "center" };
export const xBtn: React.CSSProperties = { background: "transparent", border: 0, color: "var(--ink-3)", cursor: "pointer", padding: 6 };
export const erroBox: React.CSSProperties = { background: "var(--rose-soft)", border: "1px solid var(--rose-border)", color: "var(--rose)", padding: "9px 12px", borderRadius: 8, fontSize: 12.5 };
