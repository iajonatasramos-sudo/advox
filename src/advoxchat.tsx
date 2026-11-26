// Painel AdvoxChat (layout do Painel BuildChat do BuildClinic): o "lado web"
// da extensão do WhatsApp. Mesmos dados, mesmo login — o que muda aqui aparece
// na extensão na hora (realtime) e vice-versa.
// Guias: Contatos · Mensagens · Agenda · Pastas · Usuários (coord) · Instalar
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Ic } from "./icons";
import { Avatar, Btn, Empty, Field, Input, Tabs } from "./ui";
import { useAuth } from "./auth";
import { supabase } from "./lib/supabase";
import { fmtTelefone, normalizaTelefone, useLiveLeads, ehGestor, rotuloPapel, type UiLead } from "./lib/data-live";
import {
  sbx, observarTabelas, CORES_PASTA,
  type WaContato, type WaPasta, type WaPastaConversa, type MsgCategoria, type MsgRapida,
} from "./lib/db-extra";
import { AgendaCalendario, backdrop, shell, modalHead, iconeHead, xBtn, erroBox, chip } from "./agenda";

type Aba = "contatos" | "mensagens" | "agenda" | "pastas" | "usuarios" | "instalar";

export function PainelAdvoxChat({ onOpenLead, abaInicial }: { onOpenLead: (l: UiLead) => void; abaInicial?: string }) {
  const { profile } = useAuth();
  const ehCoord = ehGestor(profile?.papel);
  const [aba, setAba] = useState<Aba>((abaInicial as Aba) || "contatos");
  const abas = [
    { id: "contatos", label: "Contatos", icon: <Ic.User size={13} /> },
    { id: "mensagens", label: "Mensagens", icon: <Ic.Whats size={13} /> },
    { id: "agenda", label: "Agenda", icon: <Ic.Calendar size={13} /> },
    { id: "pastas", label: "Pastas", icon: <Ic.Tag size={13} /> },
    ...(ehCoord ? [{ id: "usuarios", label: "Usuários", icon: <Ic.Users size={13} /> }] : []),
    { id: "instalar", label: "Instalar", icon: <Ic.Download size={13} /> },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100%" }}>
      <div style={{ padding: "0 18px", background: "var(--surface)" }}>
        <Tabs tabs={abas} active={aba} onChange={(id) => setAba(id as Aba)} />
      </div>
      {aba === "contatos" && <Contatos onOpenLead={onOpenLead} />}
      {aba === "mensagens" && <Mensagens />}
      {aba === "agenda" && <AgendaCalendario onOpenLead={onOpenLead} />}
      {aba === "pastas" && <Pastas />}
      {aba === "usuarios" && ehCoord && <Usuarios />}
      {aba === "instalar" && <Instalar />}
    </div>
  );
}

/* ═════════════ hooks de dados ═════════════ */

function usePastas() {
  const [pastas, setPastas] = useState<WaPasta[] | null>(null);
  const [conversas, setConversas] = useState<WaPastaConversa[]>([]);
  const carregar = useCallback(async () => {
    const [p, c] = await Promise.all([
      sbx.from("wa_pastas").select("id, nome, cor, ordem").order("ordem").order("created_at"),
      sbx.from("wa_pasta_conversas").select("pasta_id, chat_id, telefone, nome"),
    ]);
    setPastas((p.data ?? []) as WaPasta[]);
    setConversas((c.data ?? []) as WaPastaConversa[]);
  }, []);
  useEffect(() => { carregar(); return observarTabelas(["wa_pastas", "wa_pasta_conversas"], carregar); }, [carregar]);
  return { pastas, conversas, recarregar: carregar };
}

const dig = (s: string | null | undefined) => (s ?? "").replace(/\D/g, "");

/* ═════════════ Contatos ═════════════ */

function Contatos({ onOpenLead }: { onOpenLead: (l: UiLead) => void }) {
  const { profile } = useAuth();
  const ehCoord = ehGestor(profile?.papel);
  const [contatos, setContatos] = useState<WaContato[] | null>(null);
  const { pastas, conversas } = usePastas();
  const { leads } = useLiveLeads(ehCoord ? {} : { repId: profile?.id });
  const [busca, setBusca] = useState("");
  const [pasta, setPasta] = useState("");
  const [novo, setNovo] = useState(false);
  const [editando, setEditando] = useState<WaContato | null>(null);

  const carregar = useCallback(async () => {
    const { data, error } = await sbx.from("wa_contatos")
      .select("id, dono_id, chat_id, telefone, nome, interesses, ultimo_contato, created_at, dono:profiles!wa_contatos_dono_id_fkey(id, nome)")
      .order("ultimo_contato", { ascending: false }).limit(2000);
    if (error) console.error("[Advox] wa_contatos", error);
    setContatos((data ?? []) as unknown as WaContato[]);
  }, []);
  useEffect(() => { carregar(); return observarTabelas(["wa_contatos"], carregar); }, [carregar]);

  const leadDe = useCallback((c: WaContato) => {
    const d = dig(c.telefone);
    if (d.length < 8) return null;
    return (leads ?? []).find(l => { const ld = dig(l.telefone); return ld && (ld === d || ld.slice(-8) === d.slice(-8)); }) ?? null;
  }, [leads]);

  const pastasDe = useCallback((c: WaContato) => {
    const d = dig(c.telefone);
    const ids = new Set(conversas.filter(v => v.chat_id === c.chat_id || (d.length >= 8 && dig(v.telefone) === d)).map(v => v.pasta_id));
    return (pastas ?? []).filter(p => ids.has(p.id));
  }, [conversas, pastas]);

  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const qd = q.replace(/\D/g, "");
    return (contatos ?? []).filter(c => {
      if (pasta && !pastasDe(c).some(p => p.id === pasta)) return false;
      if (!q) return true;
      return `${c.nome ?? ""} ${c.interesses ?? ""} ${c.dono?.nome ?? ""}`.toLowerCase().includes(q) || (qd.length >= 3 && dig(c.telefone).includes(qd));
    });
  }, [contatos, busca, pasta, pastasDe]);

  return (
    <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <div style={{ width: 260, maxWidth: "100%" }}>
          <Input full size="sm" icon={<Ic.Search size={12} />} value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por nome, telefone, interesse…" />
        </div>
        <select value={pasta} onChange={e => setPasta(e.target.value)} style={selectCls}>
          <option value="">Todas as pastas</option>
          {(pastas ?? []).map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
        </select>
        <Btn size="sm" variant="primary" icon={<Ic.Plus size={12} />} onClick={() => setNovo(true)}>Novo contato</Btn>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 12, color: "var(--ink-3)" }}><b style={{ color: "var(--ink)" }}>{lista.length}</b> de {(contatos ?? []).length}</span>
      </div>

      <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12, overflow: "auto" }}>
        {contatos === null ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--ink-3)", fontSize: 13 }}>Carregando…</div>
        ) : lista.length === 0 ? (
          <Empty icon={<Ic.Whats size={20} />} title={contatos.length ? "Nenhum contato com esse filtro" : "Nenhum contato ainda"}
            hint={contatos.length ? undefined : "Toda conversa que você abre no WhatsApp Web com a extensão AdvoxChat vira contato aqui."} />
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: "var(--surface-2)", borderBottom: "1px solid var(--line)", textAlign: "left" }}>
                {["Contato", "Telefone", "Pastas", "Lead no Advox", "Interesses", ...(ehCoord ? ["Consultor"] : []), "Últ. contato"].map(h => (
                  <th key={h} style={th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lista.map(c => {
                const lead = leadDe(c);
                const ps = pastasDe(c);
                return (
                  <tr key={c.id} className="nav-item" style={{ borderBottom: "1px solid var(--line)", cursor: "pointer" }} onClick={() => setEditando(c)}>
                    <td style={{ ...td, fontWeight: 600 }}>{c.nome || (c.telefone ? fmtTelefone(c.telefone) : c.chat_id)}</td>
                    <td style={{ ...td, color: "var(--ink-2)", fontVariantNumeric: "tabular-nums" }}>{c.telefone ? fmtTelefone(c.telefone) : "—"}</td>
                    <td style={td}>
                      {ps.length ? <span style={{ display: "inline-flex", gap: 4, flexWrap: "wrap" }}>{ps.map(p => <span key={p.id} style={{ background: p.cor, color: "white", fontSize: 10.5, fontWeight: 700, padding: "1px 7px", borderRadius: 5 }}>{p.nome}</span>)}</span> : <span style={{ color: "var(--ink-4)" }}>—</span>}
                    </td>
                    <td style={td}>
                      {lead ? (
                        <button onClick={(e) => { e.stopPropagation(); onOpenLead(lead); }} style={{ border: 0, background: "var(--navy-soft)", color: "var(--navy)", borderRadius: 6, padding: "2px 8px", fontSize: 11.5, fontWeight: 600, cursor: "pointer" }}>
                          {lead.empresa}
                        </button>
                      ) : <span style={{ color: "var(--ink-4)" }}>—</span>}
                    </td>
                    <td style={{ ...td, color: "var(--ink-2)", maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.interesses || <span style={{ color: "var(--ink-4)" }}>—</span>}</td>
                    {ehCoord && <td style={{ ...td, color: "var(--ink-2)" }}>{c.dono?.nome ?? "—"}</td>}
                    <td style={{ ...td, color: "var(--ink-3)", whiteSpace: "nowrap" }}>{new Date(c.ultimo_contato).toLocaleDateString("pt-BR")}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {(novo || editando) && (
        <ContatoModal contato={editando} podeEditar={!editando || editando.dono_id === profile?.id}
          onClose={() => { setNovo(false); setEditando(null); carregar(); }} />
      )}
    </div>
  );
}

function ContatoModal({ contato, podeEditar, onClose }: { contato: WaContato | null; podeEditar: boolean; onClose: () => void }) {
  const { profile } = useAuth();
  const [nome, setNome] = useState(contato?.nome ?? "");
  const [telefone, setTelefone] = useState(contato?.telefone ? fmtTelefone(contato.telefone) : "");
  const [interesses, setInteresses] = useState(contato?.interesses ?? "");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    const tel = normalizaTelefone(telefone);
    if (!contato && (!tel || tel.length < 12)) { setErr("Informe o WhatsApp com DDD."); return; }
    setBusy(true); setErr(null);
    const { error } = contato
      ? await sbx.from("wa_contatos").update({ nome: nome.trim() || null, interesses: interesses.trim() || null }).eq("id", contato.id)
      : await sbx.from("wa_contatos").upsert({ dono_id: profile?.id, chat_id: `${tel}@c.us`, telefone: tel, nome: nome.trim() || null, interesses: interesses.trim() || null }, { onConflict: "dono_id,chat_id" });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    onClose();
  };

  const excluir = async () => {
    if (!contato || !window.confirm(`Remover "${contato.nome || contato.telefone}" da lista de contatos? A conversa no WhatsApp não é apagada.`)) return;
    await sbx.from("wa_contatos").delete().eq("id", contato.id);
    onClose();
  };

  return (
    <div onClick={onClose} className="modal-backdrop" style={backdrop}>
      <div onClick={e => e.stopPropagation()} className="modal-shell fade-up" style={{ ...shell, width: 460 }}>
        <div style={modalHead}>
          <span style={{ ...iconeHead, background: "var(--green)" }}><Ic.Whats size={15} /></span>
          <div style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>{contato ? "Contato" : "Novo contato"}</div>
          <button onClick={onClose} style={xBtn}><Ic.X size={16} /></button>
        </div>
        <form onSubmit={salvar} style={{ padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
          {err && <div style={erroBox}>{err}</div>}
          <Field label="Nome"><Input full autoFocus value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome do contato" /></Field>
          <Field label="WhatsApp">
            {contato ? <div style={{ fontSize: 13, padding: "6px 0" }}>{telefone || contato.chat_id}</div>
              : <Input full value={telefone} onChange={e => setTelefone(e.target.value)} placeholder="(11) 99999-0000" />}
          </Field>
          <Field label="Interesses">
            <textarea value={interesses} onChange={e => setInteresses(e.target.value)} rows={3} disabled={!podeEditar} placeholder="Ex.: 12 linhas Vivo, quer portabilidade, proposta enviada em 12/08"
              style={{ width: "100%", resize: "vertical", border: "1px solid var(--line)", borderRadius: 8, padding: 10, fontFamily: "inherit", fontSize: 13, background: "var(--surface)", color: "var(--ink)" }} />
          </Field>
          {contato?.telefone && (
            <a href={`https://web.whatsapp.com/send?phone=${contato.telefone}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12.5, color: "var(--green)", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 6 }}>
              <Ic.Whats size={13} /> Abrir conversa no WhatsApp Web
            </a>
          )}
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {contato && podeEditar && <Btn size="sm" variant="danger" icon={<Ic.Trash size={12} />} onClick={excluir}>Remover</Btn>}
            <div style={{ flex: 1 }} />
            <Btn onClick={onClose}>Fechar</Btn>
            {podeEditar && <Btn type="submit" variant="primary" disabled={busy}>{busy ? "Salvando…" : "Salvar"}</Btn>}
          </div>
        </form>
      </div>
    </div>
  );
}

/* ═════════════ Mensagens rápidas ═════════════ */

const VARIAVEIS = ["{{nome}}", "{{empresa}}", "{{operadora}}", "{{eu}}"];

function Mensagens() {
  const { profile } = useAuth();
  const [cats, setCats] = useState<MsgCategoria[]>([]);
  const [msgs, setMsgs] = useState<MsgRapida[] | null>(null);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<"tudo" | "avulsas" | "usadas" | "equipe">("tudo");
  const [abertas, setAbertas] = useState<Set<string>>(new Set());
  const [dlgMsg, setDlgMsg] = useState<MsgRapida | "nova" | null>(null);
  const [dlgCat, setDlgCat] = useState<MsgCategoria | "nova" | null>(null);

  const carregar = useCallback(async () => {
    const [c, m] = await Promise.all([
      sbx.from("mensagens_categorias").select("id, dono_id, revenda_id, nome, cor, ordem").order("ordem").order("nome"),
      sbx.from("mensagens_rapidas").select("id, dono_id, revenda_id, categoria_id, titulo, atalho, texto, ordem, usos").order("ordem").order("titulo"),
    ]);
    setCats((c.data ?? []) as MsgCategoria[]);
    setMsgs((m.data ?? []) as MsgRapida[]);
  }, []);
  useEffect(() => { carregar(); return observarTabelas(["mensagens_categorias", "mensagens_rapidas"], carregar); }, [carregar]);

  const grupos = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const ms = (msgs ?? []).filter(m => !q || `${m.titulo} ${m.atalho ?? ""} ${m.texto}`.toLowerCase().includes(q));
    if (filtro === "usadas") return [{ id: "usadas", nome: "MAIS USADAS", cor: "#ec4899", cat: null as MsgCategoria | null, itens: ms.filter(m => m.usos > 0).sort((a, b) => b.usos - a.usos).slice(0, 10) }];
    if (filtro === "avulsas") return [{ id: "sem", nome: "SEM CATEGORIA", cor: "#6366f1", cat: null, itens: ms.filter(m => !m.categoria_id) }];
    if (filtro === "equipe") return [{ id: "equipe", nome: "DA EQUIPE (REVENDA)", cor: "#14b8a6", cat: null, itens: ms.filter(m => m.revenda_id) }];
    const conhecidas = new Set(cats.map(c => c.id));
    const out = cats.map(c => ({ id: c.id, nome: c.nome.toUpperCase(), cor: c.cor, cat: c as MsgCategoria | null, itens: ms.filter(m => m.categoria_id === c.id) }));
    const sem = ms.filter(m => !m.categoria_id || !conhecidas.has(m.categoria_id));
    if (sem.length) out.push({ id: "sem", nome: "SEM CATEGORIA", cor: "#6366f1", cat: null, itens: sem });
    return q ? out.filter(g => g.itens.length) : out;
  }, [cats, msgs, busca, filtro]);

  const total = (msgs ?? []).length;

  return (
    <div style={{ padding: 18 }}>
      <div style={{ maxWidth: 620, margin: "0 auto", display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ flex: 1 }}><Input full size="sm" icon={<Ic.Search size={12} />} value={busca} onChange={e => setBusca(e.target.value)} placeholder="Pesquisar resposta rápida" /></div>
          <Btn size="sm" icon={<Ic.Tag size={12} />} onClick={() => setDlgCat("nova")}>Categorias</Btn>
          <Btn size="sm" variant="primary" icon={<Ic.Plus size={13} />} onClick={() => setDlgMsg("nova")} title="Nova resposta rápida" />
        </div>
        <div style={{ display: "flex", gap: 2, padding: 2, background: "var(--surface-2)", border: "1px solid var(--line)", borderRadius: 8 }}>
          {([["tudo", "Tudo"], ["avulsas", "Avulsas"], ["usadas", "Usadas"], ["equipe", "Equipe"]] as const).map(([v, l]) => (
            <button key={v} onClick={() => setFiltro(v)} style={{ flex: 1, border: 0, cursor: "pointer", borderRadius: 6, padding: "5px 0", fontSize: 12, fontWeight: 600, background: filtro === v ? "var(--surface)" : "transparent", color: filtro === v ? "var(--navy)" : "var(--ink-3)", boxShadow: filtro === v ? "var(--shadow-sm)" : undefined }}>{l}</button>
          ))}
        </div>
        {msgs === null ? <div style={{ padding: 30, textAlign: "center", color: "var(--ink-3)" }}>Carregando…</div>
          : grupos.length === 0 ? <Empty icon={<Ic.Whats size={20} />} title="Nenhuma resposta rápida" hint="O que você criar aqui também aparece na extensão do WhatsApp." action={<Btn size="sm" variant="primary" onClick={() => setDlgMsg("nova")}>Criar a primeira</Btn>} />
          : grupos.map(g => {
            const aberta = abertas.has(g.id) || !!busca.trim() || filtro !== "tudo";
            const podeEditarCat = g.cat && g.cat.dono_id === profile?.id;
            return (
              <div key={g.id} style={{ border: `1px solid color-mix(in oklab, ${g.cor} 55%, transparent)`, background: `color-mix(in oklab, ${g.cor} 8%, var(--surface))`, borderRadius: 10, overflow: "hidden" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: `color-mix(in oklab, ${g.cor} 18%, var(--surface))` }}>
                  <button onClick={() => setAbertas(s => { const n = new Set(s); n.has(g.id) ? n.delete(g.id) : n.add(g.id); return n; })} style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, border: 0, background: "transparent", cursor: "pointer", textAlign: "left", padding: 0, minWidth: 0 }}>
                    <Ic.Sparkles size={13} color={g.cor} />
                    <span style={{ flex: 1, fontSize: 12, fontWeight: 700, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.nome}</span>
                    {g.cat?.revenda_id && <Ic.Users size={12} color="var(--ink-3)" />}
                    <span style={{ background: g.cor, color: "white", fontSize: 10.5, fontWeight: 700, borderRadius: 5, padding: "0 6px", minWidth: 18, textAlign: "center" }}>{g.itens.length}</span>
                  </button>
                  {podeEditarCat && <button onClick={() => setDlgCat(g.cat!)} title="Editar categoria" style={{ ...xBtn, padding: 2 }}><Ic.Edit size={13} /></button>}
                  <span style={{ display: "inline-flex", transform: aberta ? undefined : "rotate(-90deg)", color: "var(--ink-3)" }}><Ic.ChevronDown size={14} /></span>
                </div>
                {aberta && g.itens.map(m => (
                  <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderTop: `1px solid color-mix(in oklab, ${g.cor} 25%, transparent)` }}>
                    <span style={{ width: 26, height: 26, borderRadius: 6, display: "inline-flex", alignItems: "center", justifyContent: "center", background: `color-mix(in oklab, ${g.cor} 25%, transparent)`, color: g.cor, flexShrink: 0 }}><Ic.Doc size={13} /></span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>
                        {m.titulo}
                        {m.atalho && <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 11, color: "var(--ink-3)", marginLeft: 6 }}>/{m.atalho}</span>}
                        {m.usos > 0 && <span style={{ fontSize: 11, color: "var(--ink-4)", marginLeft: 6 }}>· {m.usos} usos</span>}
                      </div>
                      <div style={{ fontSize: 11.5, color: "var(--ink-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.texto}</div>
                    </div>
                    {m.dono_id === profile?.id && <button onClick={() => setDlgMsg(m)} title="Editar" style={xBtn}><Ic.Edit size={14} /></button>}
                  </div>
                ))}
                {aberta && g.itens.length === 0 && <div style={{ padding: "8px 12px", fontSize: 12, color: "var(--ink-3)", borderTop: `1px solid color-mix(in oklab, ${g.cor} 25%, transparent)` }}>Nenhuma mensagem nesta categoria.</div>}
              </div>
            );
          })}
        <div style={{ textAlign: "right", fontSize: 11.5, color: "var(--ink-3)" }}><b>{grupos.reduce((s, g) => s + g.itens.length, 0)}</b> de {total}</div>
      </div>
      {dlgMsg && <MensagemModal msg={dlgMsg === "nova" ? null : dlgMsg} cats={cats} onClose={() => { setDlgMsg(null); carregar(); }} />}
      {dlgCat && <CategoriaModal cat={dlgCat === "nova" ? null : dlgCat} total={cats.length} onClose={() => { setDlgCat(null); carregar(); }} />}
    </div>
  );
}

function MensagemModal({ msg, cats, onClose }: { msg: MsgRapida | null; cats: MsgCategoria[]; onClose: () => void }) {
  const { profile } = useAuth();
  const coord = ehGestor(profile?.papel) && !!profile?.revenda_id;
  const [titulo, setTitulo] = useState(msg?.titulo ?? "");
  const [atalho, setAtalho] = useState(msg?.atalho ?? "");
  const [categoria, setCategoria] = useState(msg?.categoria_id ?? "");
  const [texto, setTexto] = useState(msg?.texto ?? "");
  const [equipe, setEquipe] = useState(!!msg?.revenda_id);
  const [err, setErr] = useState<string | null>(null);

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titulo.trim() || !texto.trim()) { setErr("Preencha o título e o texto."); return; }
    const campos = { titulo: titulo.trim(), atalho: atalho.trim() || null, texto, categoria_id: categoria || null, revenda_id: coord && equipe ? profile!.revenda_id : null };
    const { error } = msg ? await sbx.from("mensagens_rapidas").update(campos).eq("id", msg.id) : await sbx.from("mensagens_rapidas").insert(campos);
    if (error) { setErr(/check/i.test(error.message) ? "Atalho inválido: só letras minúsculas, números, - ou _." : error.message); return; }
    onClose();
  };
  const excluir = async () => {
    if (!msg || !window.confirm(`Excluir "${msg.titulo}"?`)) return;
    await sbx.from("mensagens_rapidas").delete().eq("id", msg.id);
    onClose();
  };

  return (
    <div onClick={onClose} className="modal-backdrop" style={backdrop}>
      <div onClick={e => e.stopPropagation()} className="modal-shell fade-up" style={{ ...shell, width: 520 }}>
        <div style={modalHead}>
          <span style={iconeHead}><Ic.Whats size={15} /></span>
          <div style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>{msg ? "Editar resposta rápida" : "Nova resposta rápida"}</div>
          <button onClick={onClose} style={xBtn}><Ic.X size={16} /></button>
        </div>
        <form onSubmit={salvar} style={{ padding: 18, display: "flex", flexDirection: "column", gap: 12, overflowY: "auto" }}>
          {err && <div style={erroBox}>{err}</div>}
          <Field label="Título"><Input full autoFocus value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Ex.: Primeiro contato" /></Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field label="Atalho (/)"><Input full value={atalho} onChange={e => setAtalho(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""))} placeholder="oi" /></Field>
            <Field label="Categoria">
              <select value={categoria} onChange={e => setCategoria(e.target.value)} style={{ ...selectCls, width: "100%", padding: "8px" }}>
                <option value="">Sem categoria</option>
                {cats.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Texto">
            <textarea value={texto} onChange={e => setTexto(e.target.value)} rows={6} placeholder="Olá {{nome}}, tudo bem?" style={{ width: "100%", resize: "vertical", border: "1px solid var(--line)", borderRadius: 8, padding: 10, fontFamily: "inherit", fontSize: 13, background: "var(--surface)", color: "var(--ink)" }} />
          </Field>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {VARIAVEIS.map(v => <button type="button" key={v} onClick={() => setTexto(t => t + v)} style={{ ...chip(false, "var(--navy)"), fontFamily: "ui-monospace, monospace", color: "var(--navy)" }}>{v}</button>)}
          </div>
          {coord && (
            <label style={{ display: "flex", gap: 8, fontSize: 12.5, color: "var(--ink-2)", cursor: "pointer", background: "var(--surface-2)", border: "1px solid var(--line)", borderRadius: 8, padding: 10 }}>
              <input type="checkbox" checked={equipe} onChange={e => setEquipe(e.target.checked)} /> Compartilhar com a revenda (todos os consultores veem e usam)
            </label>
          )}
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {msg && <Btn size="sm" variant="danger" icon={<Ic.Trash size={12} />} onClick={excluir}>Excluir</Btn>}
            <div style={{ flex: 1 }} />
            <Btn onClick={onClose}>Cancelar</Btn>
            <Btn type="submit" variant="primary">Salvar</Btn>
          </div>
        </form>
      </div>
    </div>
  );
}

function CategoriaModal({ cat, total, onClose }: { cat: MsgCategoria | null; total: number; onClose: () => void }) {
  const { profile } = useAuth();
  const coord = ehGestor(profile?.papel) && !!profile?.revenda_id;
  const [nome, setNome] = useState(cat?.nome ?? "");
  const [cor, setCor] = useState(cat?.cor ?? CORES_PASTA[total % CORES_PASTA.length]);
  const [equipe, setEquipe] = useState(!!cat?.revenda_id);
  const [err, setErr] = useState<string | null>(null);
  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) { setErr("Dê um nome à categoria."); return; }
    const campos = { nome: nome.trim(), cor, revenda_id: coord && equipe ? profile!.revenda_id : null };
    const { error } = cat ? await sbx.from("mensagens_categorias").update(campos).eq("id", cat.id) : await sbx.from("mensagens_categorias").insert({ ...campos, ordem: total });
    if (error) { setErr(error.message); return; }
    onClose();
  };
  const excluir = async () => {
    if (!cat || !window.confirm(`Excluir a categoria "${cat.nome}"? As mensagens ficam sem categoria.`)) return;
    await sbx.from("mensagens_categorias").delete().eq("id", cat.id);
    onClose();
  };
  return (
    <div onClick={onClose} className="modal-backdrop" style={backdrop}>
      <div onClick={e => e.stopPropagation()} className="modal-shell fade-up" style={{ ...shell, width: 420 }}>
        <div style={modalHead}>
          <span style={{ ...iconeHead, background: cor }}><Ic.Tag size={15} /></span>
          <div style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>{cat ? "Editar categoria" : "Nova categoria"}</div>
          <button onClick={onClose} style={xBtn}><Ic.X size={16} /></button>
        </div>
        <form onSubmit={salvar} style={{ padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
          {err && <div style={erroBox}>{err}</div>}
          <Field label="Nome"><Input full autoFocus value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex.: Saudação" /></Field>
          <Field label="Cor">
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input type="color" value={cor} onChange={e => setCor(e.target.value)} style={{ width: 40, height: 30, border: "1px solid var(--line)", borderRadius: 6, padding: 2, background: "var(--surface)" }} />
              {CORES_PASTA.map(c => <button type="button" key={c} onClick={() => setCor(c)} style={{ width: 22, height: 22, borderRadius: 99, background: c, border: 0, cursor: "pointer", outline: cor === c ? "2px solid var(--ink)" : "none", outlineOffset: 2 }} />)}
            </div>
          </Field>
          {coord && (
            <label style={{ display: "flex", gap: 8, fontSize: 12.5, color: "var(--ink-2)", cursor: "pointer" }}>
              <input type="checkbox" checked={equipe} onChange={e => setEquipe(e.target.checked)} /> Categoria da revenda (aparece para todo o time)
            </label>
          )}
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {cat && <Btn size="sm" variant="danger" icon={<Ic.Trash size={12} />} onClick={excluir}>Excluir</Btn>}
            <div style={{ flex: 1 }} />
            <Btn onClick={onClose}>Cancelar</Btn>
            <Btn type="submit" variant="primary">Salvar</Btn>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ═════════════ Pastas ═════════════ */

function Pastas() {
  const { pastas, conversas, recarregar } = usePastas();
  const [editando, setEditando] = useState<WaPasta | "nova" | null>(null);
  const contagem = (id: string) => conversas.filter(c => c.pasta_id === id).length;

  const mover = async (i: number, d: -1 | 1) => {
    const a = pastas![i], b = pastas![i + d];
    if (!a || !b) return;
    await Promise.all([sbx.from("wa_pastas").update({ ordem: i + d }).eq("id", a.id), sbx.from("wa_pastas").update({ ordem: i }).eq("id", b.id)]);
    recarregar();
  };
  const excluir = async (p: WaPasta) => {
    if (!window.confirm(`Apagar a pasta "${p.nome}"? As conversas continuam no WhatsApp, só saem da pasta.`)) return;
    await sbx.from("wa_pastas").delete().eq("id", p.id);
    recarregar();
  };

  return (
    <div style={{ padding: 18 }}>
      <div style={{ maxWidth: 620, margin: "0 auto", display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ flex: 1, fontSize: 12.5, color: "var(--ink-3)" }}>As pastas organizam as conversas no WhatsApp (chips no topo da extensão). A ordem aqui é a ordem lá.</div>
          <Btn size="sm" variant="primary" icon={<Ic.Plus size={12} />} onClick={() => setEditando("nova")}>Nova pasta</Btn>
        </div>
        <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12, overflow: "hidden" }}>
          {pastas === null ? <div style={{ padding: 30, textAlign: "center", color: "var(--ink-3)" }}>Carregando…</div>
            : pastas.length === 0 ? <Empty icon={<Ic.Tag size={20} />} title="Nenhuma pasta ainda" hint="Crie aqui ou pelo + na barra da extensão." />
            : pastas.map((p, i) => (
              <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderBottom: i < pastas.length - 1 ? "1px solid var(--line)" : 0 }}>
                <span style={{ width: 12, height: 12, borderRadius: 99, background: p.cor, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{p.nome}</div>
                  <div style={{ fontSize: 11.5, color: "var(--ink-3)" }}>{contagem(p.id)} conversa(s)</div>
                </div>
                <button disabled={i === 0} onClick={() => mover(i, -1)} title="Subir" style={{ ...xBtn, opacity: i === 0 ? 0.3 : 1 }}><Ic.ArrowUp size={13} /></button>
                <button disabled={i === pastas.length - 1} onClick={() => mover(i, 1)} title="Descer" style={{ ...xBtn, opacity: i === pastas.length - 1 ? 0.3 : 1 }}><Ic.ArrowDown size={13} /></button>
                <button onClick={() => setEditando(p)} title="Editar" style={xBtn}><Ic.Edit size={13} /></button>
                <button onClick={() => excluir(p)} title="Apagar" style={{ ...xBtn, color: "var(--rose)" }}><Ic.Trash size={13} /></button>
              </div>
            ))}
        </div>
      </div>
      {editando && <PastaModal pasta={editando === "nova" ? null : editando} total={pastas?.length ?? 0} onClose={() => { setEditando(null); recarregar(); }} />}
    </div>
  );
}

function PastaModal({ pasta, total, onClose }: { pasta: WaPasta | null; total: number; onClose: () => void }) {
  const [nome, setNome] = useState(pasta?.nome ?? "");
  const [cor, setCor] = useState(pasta?.cor ?? CORES_PASTA[total % CORES_PASTA.length]);
  const [err, setErr] = useState<string | null>(null);
  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) { setErr("Dê um nome à pasta."); return; }
    const { error } = pasta ? await sbx.from("wa_pastas").update({ nome: nome.trim(), cor }).eq("id", pasta.id) : await sbx.from("wa_pastas").insert({ nome: nome.trim(), cor, ordem: total });
    if (error) { setErr(error.message); return; }
    onClose();
  };
  return (
    <div onClick={onClose} className="modal-backdrop" style={backdrop}>
      <div onClick={e => e.stopPropagation()} className="modal-shell fade-up" style={{ ...shell, width: 400 }}>
        <div style={modalHead}>
          <span style={{ ...iconeHead, background: cor }}><Ic.Tag size={15} /></span>
          <div style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>{pasta ? "Editar pasta" : "Nova pasta"}</div>
          <button onClick={onClose} style={xBtn}><Ic.X size={16} /></button>
        </div>
        <form onSubmit={salvar} style={{ padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
          {err && <div style={erroBox}>{err}</div>}
          <Field label="Nome"><Input full autoFocus value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex.: Clientes quentes" /></Field>
          <Field label="Cor">
            <div style={{ display: "flex", gap: 8 }}>
              {CORES_PASTA.map(c => <button type="button" key={c} onClick={() => setCor(c)} style={{ width: 24, height: 24, borderRadius: 99, background: c, border: 0, cursor: "pointer", outline: cor === c ? "2px solid var(--ink)" : "none", outlineOffset: 2 }} />)}
            </div>
          </Field>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <Btn onClick={onClose}>Cancelar</Btn>
            <Btn type="submit" variant="primary">Salvar</Btn>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ═════════════ Usuários (coord) ═════════════ */

type Membro = { id: string; nome: string; email: string; papel: string; status: string };

function Usuarios() {
  const { profile } = useAuth();
  const [membros, setMembros] = useState<Membro[] | null>(null);
  const [uso, setUso] = useState<Record<string, { contatos: number; ultimo: string | null }>>({});

  useEffect(() => {
    if (!profile?.id) return;
    (async () => {
      // O banco já limita à equipe de quem está vendo.
      const { data } = await supabase.from("profiles").select("id, nome, email, papel, status").in("papel", ["proprietario", "gerente", "coord", "rep"]).order("nome");
      setMembros((data ?? []) as unknown as Membro[]);
      const { data: cs } = await sbx.from("wa_contatos").select("dono_id, ultimo_contato");
      const m: Record<string, { contatos: number; ultimo: string | null }> = {};
      for (const c of (cs ?? []) as { dono_id: string; ultimo_contato: string }[]) {
        const a = m[c.dono_id] ?? { contatos: 0, ultimo: null };
        a.contatos++;
        if (!a.ultimo || c.ultimo_contato > a.ultimo) a.ultimo = c.ultimo_contato;
        m[c.dono_id] = a;
      }
      setUso(m);
    })();
  }, [profile?.id]);

  return (
    <div style={{ padding: 18 }}>
      <div style={{ maxWidth: 760, margin: "0 auto", display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ fontSize: 12.5, color: "var(--ink-3)" }}>
          Quem faz parte da revenda usa a extensão com o próprio login do Advox. Para adicionar alguém, convide pela tela <b>Meu time</b>.
        </div>
        <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12, overflow: "hidden" }}>
          {membros === null ? <div style={{ padding: 30, textAlign: "center", color: "var(--ink-3)" }}>Carregando…</div>
            : membros.map((m, i) => {
              const u = uso[m.id];
              return (
                <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderBottom: i < membros.length - 1 ? "1px solid var(--line)" : 0, opacity: m.status === "ativo" ? 1 : 0.55 }}>
                  <Avatar name={m.nome} size={30} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{m.nome}</div>
                    <div style={{ fontSize: 11.5, color: "var(--ink-3)" }}>{m.email}</div>
                  </div>
                  <span style={{ fontSize: 11, color: "var(--ink-3)" }}>{rotuloPapel(m.papel)}{m.status !== "ativo" ? ` · ${m.status}` : ""}</span>
                  <span style={{ minWidth: 150, textAlign: "right", fontSize: 11.5 }}>
                    {u ? <span style={{ color: "var(--green)", fontWeight: 600 }}>● usa a extensão · {u.contatos} contatos</span> : <span style={{ color: "var(--ink-4)" }}>ainda não usou a extensão</span>}
                    {u?.ultimo && <span style={{ display: "block", color: "var(--ink-4)", fontSize: 10.5 }}>último em {new Date(u.ultimo).toLocaleDateString("pt-BR")}</span>}
                  </span>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}

/* ═════════════ Instalar ═════════════ */

type ConfigExt = { zip_url: string | null; versao: string | null; notas: string | null };

function Instalar() {
  const { profile } = useAuth();
  const admin = profile?.papel === "admin";
  const [cfg, setCfg] = useState<ConfigExt | null>(null);
  const [embutida, setEmbutida] = useState<string | null>(null);
  const [form, setForm] = useState<ConfigExt>({ zip_url: "", versao: "", notas: "" });
  const [salvo, setSalvo] = useState(false);

  useEffect(() => {
    sbx.from("config_extensao").select("zip_url, versao, notas").maybeSingle().then(({ data }) => {
      const c = (data ?? { zip_url: null, versao: null, notas: null }) as ConfigExt;
      setCfg(c);
      setForm({ zip_url: c.zip_url ?? "", versao: c.versao ?? "", notas: c.notas ?? "" });
    });
    fetch("/advox-whatsapp.json").then(r => r.ok ? r.json() : null).then(j => setEmbutida(j?.versao ?? null)).catch(() => {});
  }, []);

  const link = cfg?.zip_url || "/advox-whatsapp.zip";
  const versao = cfg?.versao || embutida;

  const PASSOS = [
    "Baixe o arquivo .zip da extensão no botão acima e descompacte numa pasta fixa (não apague depois).",
    "Abra o Chrome em chrome://extensions.",
    "Ligue o \"Modo do desenvolvedor\" (canto superior direito).",
    "Clique em \"Carregar sem compactação\" e selecione a pasta descompactada.",
    "Abra o WhatsApp Web (web.whatsapp.com). A barra do AdvoxChat aparece no topo.",
    "Entre com a sua conta do Advox (o mesmo login do sistema).",
  ];

  return (
    <div style={{ padding: 18 }}>
      <div style={{ maxWidth: 620, margin: "0 auto", display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={card}>
          <div style={{ display: "flex", gap: 14 }}>
            <span style={{ ...iconeHead, width: 40, height: 40, borderRadius: 10, background: "linear-gradient(135deg, var(--navy), var(--gold))" }}><Ic.Whats size={19} /></span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>Extensão AdvoxChat para o Chrome</div>
              <div style={{ fontSize: 12.5, color: "var(--ink-3)", marginTop: 3 }}>
                Roda dentro do WhatsApp Web: pastas, mensagens rápidas, ficha do lead, atividades e indicação ao jurídico.
                {versao && <> Versão atual: <b>{versao}</b>.</>}
              </div>
              <a href={link} download style={{ marginTop: 12, display: "inline-flex", alignItems: "center", gap: 7, background: "var(--navy)", color: "var(--navy-ink)", textDecoration: "none", padding: "9px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600 }}>
                <Ic.Download size={14} /> Baixar extensão (.zip)
              </a>
            </div>
          </div>
        </div>
        <div style={card}>
          <div style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)", marginBottom: 10 }}>Como instalar</div>
          <ol style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 10 }}>
            {PASSOS.map((p, i) => (
              <li key={i} style={{ display: "flex", gap: 10, fontSize: 13, color: "var(--ink-2)" }}>
                <span style={{ width: 20, height: 20, flexShrink: 0, borderRadius: 99, background: "var(--navy-soft)", color: "var(--navy)", fontSize: 11, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{i + 1}</span>{p}
              </li>
            ))}
          </ol>
          <div style={{ marginTop: 14, fontSize: 12, color: "var(--ink-3)", background: "var(--surface-2)", border: "1px solid var(--line)", borderRadius: 8, padding: 10 }}>
            Login único: use a <b>mesma conta do Advox</b>. A extensão não tem cadastro separado. Pela extensão, o botão <b>Painel AdvoxChat</b> abre esta tela já logado.
            Enquanto a extensão não estiver na Chrome Web Store, a atualização é manual (baixar de novo e clicar em ↻ em chrome://extensions).
          </div>
          {cfg?.notas && <div style={{ marginTop: 10, fontSize: 12.5, color: "var(--ink-2)", whiteSpace: "pre-wrap" }}><b>Novidades:</b> {cfg.notas}</div>}
        </div>
        {admin && (
          <div style={card}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--navy)", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}><Ic.Settings size={13} /> Configuração (admin)</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <Field label="Link do .zip da extensão (vazio = usa o embutido no sistema)"><Input full value={form.zip_url ?? ""} onChange={e => setForm({ ...form, zip_url: e.target.value })} placeholder="https://…/advox-whatsapp.zip" /></Field>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 10 }}>
                <Field label="Versão"><Input full value={form.versao ?? ""} onChange={e => setForm({ ...form, versao: e.target.value })} placeholder={embutida ?? "0.3.0"} /></Field>
                <Field label="Notas (opcional)"><Input full value={form.notas ?? ""} onChange={e => setForm({ ...form, notas: e.target.value })} placeholder="Ex.: novidades desta versão" /></Field>
              </div>
              <div>
                <Btn variant="primary" size="sm" icon={<Ic.Check size={12} />} onClick={async () => {
                  const { error } = await sbx.from("config_extensao").update({ zip_url: form.zip_url || null, versao: form.versao || null, notas: form.notas || null, updated_at: new Date().toISOString() }).eq("id", true);
                  if (error) alert(error.message); else { setCfg({ ...form }); setSalvo(true); setTimeout(() => setSalvo(false), 2500); }
                }}>Salvar</Btn>
                {salvo && <span style={{ marginLeft: 10, fontSize: 12, color: "var(--green)" }}>Salvo.</span>}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const card: React.CSSProperties = { background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12, padding: 18, boxShadow: "var(--shadow-sm)" };
const th: React.CSSProperties = { padding: "9px 12px", fontSize: 13.5, fontWeight: 600, color: "var(--ink-3)", whiteSpace: "nowrap" };
const td: React.CSSProperties = { padding: "9px 12px" };
const selectCls: React.CSSProperties = { border: "1px solid var(--line)", borderRadius: 8, padding: "6px 8px", fontSize: 12, background: "var(--surface)", color: "var(--ink-2)", fontFamily: "inherit" };
