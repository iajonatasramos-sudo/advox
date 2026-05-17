import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "./supabase";
import type { Database, LeadStatus, CasoStatus, Operadora } from "./database.types";

/* ====================================================================
 * Tipos UI (DB + joins)
 * ================================================================== */

type DbLead = Database["public"]["Tables"]["leads"]["Row"];
type DbCaso = Database["public"]["Tables"]["casos"]["Row"];
type DbTarefa = Database["public"]["Tables"]["tarefas"]["Row"];
type DbProfile = Database["public"]["Tables"]["profiles"]["Row"];
type DbRevenda = Database["public"]["Tables"]["revendas"]["Row"];

export type UiLead = DbLead & {
  rep?: Pick<DbProfile, "id" | "nome" | "email"> | null;
  revenda?: Pick<DbRevenda, "id" | "nome"> | null;
  advox_caso?: Pick<DbCaso, "id" | "status"> | null;
};

export type UiCaso = DbCaso & {
  lead?: Pick<DbLead, "id" | "empresa" | "contato" | "cidade" | "uf" | "operadora" | "valor" | "rep_id" | "revenda_id"> | null;
  advogado?: Pick<DbProfile, "id" | "nome" | "email" | "oab"> | null;
  rep?: Pick<DbProfile, "id" | "nome" | "email"> | null;
};

export type UiTarefa = DbTarefa & {
  lead?: Pick<DbLead, "id" | "empresa" | "contato"> | null;
  autor?: Pick<DbProfile, "id" | "nome"> | null;
};

/* ====================================================================
 * Helpers genéricos
 * ================================================================== */

function useChannel(name: string, table: string, onChange: () => void) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  useEffect(() => {
    const ch = supabase
      .channel(name)
      .on("postgres_changes", { event: "*", schema: "public", table }, () => onChangeRef.current())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [name, table]);
}

/* ====================================================================
 * LEADS
 * ================================================================== */

const LEAD_SELECT =
  "*, rep:profiles!leads_rep_id_fkey(id, nome, email), revenda:revendas!leads_revenda_id_fkey(id, nome), advox_caso:casos!leads_advox_caso_fk(id, status)";

export type LeadFilter = {
  repId?: string;
  revendaId?: string;
  status?: LeadStatus | LeadStatus[];
};

export function useLiveLeads(filter?: LeadFilter) {
  const [leads, setLeads] = useState<UiLead[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    let q = supabase.from("leads").select(LEAD_SELECT).order("created_at", { ascending: false });
    if (filter?.repId) q = q.eq("rep_id", filter.repId);
    if (filter?.revendaId) q = q.eq("revenda_id", filter.revendaId);
    if (filter?.status) {
      q = Array.isArray(filter.status) ? q.in("status", filter.status) : q.eq("status", filter.status);
    }
    const { data, error } = await q;
    if (error) { setError(error.message); return; }
    setError(null);
    setLeads((data ?? []) as unknown as UiLead[]);
  }, [filter?.repId, filter?.revendaId, JSON.stringify(filter?.status)]);

  useEffect(() => { load(); }, [load]);
  useChannel(`leads-live-${filter?.repId ?? "all"}-${filter?.revendaId ?? "all"}`, "leads", load);

  return { leads, error, refresh: load };
}

export async function createLead(input: Database["public"]["Tables"]["leads"]["Insert"]) {
  const { data, error } = await supabase.from("leads").insert(input as never).select(LEAD_SELECT).single();
  return { data: data as unknown as UiLead | null, error: error?.message };
}

export async function updateLead(id: string, patch: Partial<DbLead>) {
  const { error } = await supabase.from("leads").update(patch as never).eq("id", id);
  return { error: error?.message };
}

export async function deleteLead(id: string) {
  const { error } = await supabase.from("leads").delete().eq("id", id);
  return { error: error?.message };
}

/* ====================================================================
 * CASOS
 * ================================================================== */

const CASO_SELECT =
  "*, lead:leads(id, empresa, contato, cidade, uf, operadora, valor, rep_id, revenda_id), advogado:profiles!casos_advogado_id_fkey(id, nome, email, oab)";

export type CasoFilter = {
  advogadoId?: string;
  repId?: string;     // via lead
  revendaId?: string; // via lead
  status?: CasoStatus | CasoStatus[];
};

export function useLiveCasos(filter?: CasoFilter) {
  const [casos, setCasos] = useState<UiCaso[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    let q = supabase.from("casos").select(CASO_SELECT).order("created_at", { ascending: false });
    if (filter?.advogadoId) q = q.eq("advogado_id", filter.advogadoId);
    if (filter?.status) {
      q = Array.isArray(filter.status) ? q.in("status", filter.status) : q.eq("status", filter.status);
    }
    const { data, error } = await q;
    if (error) { setError(error.message); return; }
    setError(null);
    let result = (data ?? []) as unknown as UiCaso[];
    // Filtragem por repId/revendaId (via lead) é feita client-side
    if (filter?.repId) result = result.filter(c => c.lead?.rep_id === filter.repId);
    if (filter?.revendaId) result = result.filter(c => c.lead?.revenda_id === filter.revendaId);
    setCasos(result);
  }, [filter?.advogadoId, filter?.repId, filter?.revendaId, JSON.stringify(filter?.status)]);

  useEffect(() => { load(); }, [load]);
  useChannel(`casos-live-${filter?.advogadoId ?? "all"}`, "casos", load);

  return { casos, error, refresh: load };
}

export async function createCaso(input: Database["public"]["Tables"]["casos"]["Insert"]) {
  const { data, error } = await supabase.from("casos").insert(input as never).select(CASO_SELECT).single();
  return { data: data as unknown as UiCaso | null, error: error?.message };
}

export async function updateCaso(id: string, patch: Partial<DbCaso>) {
  const { error } = await supabase.from("casos").update(patch as never).eq("id", id);
  return { error: error?.message };
}

/* ====================================================================
 * TAREFAS
 * ================================================================== */

const TAREFA_SELECT =
  "*, lead:leads(id, empresa, contato), autor:profiles!tarefas_autor_id_fkey(id, nome)";

export type TarefaFilter = {
  autorId?: string;
  leadId?: string;
  revendaId?: string;
};

export function useLiveTarefas(filter?: TarefaFilter) {
  const [tarefas, setTarefas] = useState<UiTarefa[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    let q = supabase.from("tarefas").select(TAREFA_SELECT).order("quando", { ascending: true, nullsFirst: false });
    if (filter?.autorId) q = q.eq("autor_id", filter.autorId);
    if (filter?.leadId) q = q.eq("lead_id", filter.leadId);
    const { data, error } = await q;
    if (error) { setError(error.message); return; }
    setError(null);
    let result = (data ?? []) as unknown as UiTarefa[];
    if (filter?.revendaId) {
      // filtra client-side via revenda do lead (precisaria de join chain, fica mais simples assim)
      const leadIds = new Set(result.map(t => t.lead_id).filter(Boolean) as string[]);
      if (leadIds.size > 0) {
        const { data: leads } = await supabase
          .from("leads")
          .select("id, revenda_id")
          .in("id", Array.from(leadIds));
        type LeadIdRow = { id: string; revenda_id: string | null };
        const leadRows = (leads ?? []) as unknown as LeadIdRow[];
        const allowed = new Set(leadRows.filter(l => l.revenda_id === filter.revendaId).map(l => l.id));
        result = result.filter(t => !t.lead_id || allowed.has(t.lead_id));
      }
    }
    setTarefas(result);
  }, [filter?.autorId, filter?.leadId, filter?.revendaId]);

  useEffect(() => { load(); }, [load]);
  useChannel(`tarefas-live-${filter?.autorId ?? "all"}-${filter?.leadId ?? "all"}`, "tarefas", load);

  return { tarefas, error, refresh: load };
}

export async function createTarefa(input: Database["public"]["Tables"]["tarefas"]["Insert"]) {
  const { error } = await supabase.from("tarefas").insert(input as never);
  return { error: error?.message };
}

export async function toggleTarefa(id: string, completed: boolean) {
  const patch: Partial<DbTarefa> = {
    completed,
    completed_at: completed ? new Date().toISOString() : null,
  };
  const { error } = await supabase.from("tarefas").update(patch as never).eq("id", id);
  return { error: error?.message };
}

/* ====================================================================
 * AUDITORIA
 * ================================================================== */

export type UiAuditoria = Database["public"]["Tables"]["auditoria"]["Row"] & {
  actor?: Pick<DbProfile, "id" | "nome" | "email" | "papel"> | null;
};

export function useLiveAuditoria(limit = 200) {
  const [items, setItems] = useState<UiAuditoria[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("auditoria")
      .select("*, actor:profiles!auditoria_actor_id_fkey(id, nome, email, papel)")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) { setError(error.message); return; }
    setError(null);
    setItems((data ?? []) as unknown as UiAuditoria[]);
  }, [limit]);

  useEffect(() => { load(); }, [load]);
  useChannel(`auditoria-live-${limit}`, "auditoria", load);

  return { items, error, refresh: load };
}

/* ====================================================================
 * PROFILE (para edit no Perfil)
 * ================================================================== */

export async function updateMyProfile(userId: string, patch: Partial<DbProfile>) {
  const { error } = await supabase.from("profiles").update(patch as never).eq("id", userId);
  return { error: error?.message };
}

/* ====================================================================
 * CONVITES
 * ================================================================== */

export type Papel = "admin" | "coord" | "rep" | "advogado";

export type ConviteRow = Database["public"]["Tables"]["convites"]["Row"] & {
  revenda?: { nome: string } | null;
};

export async function createConvite(input: {
  email: string;
  papel: Papel;
  revenda_id?: string | null;
  invited_by: string;
  expira_dias?: number;
}) {
  const expira = new Date();
  expira.setDate(expira.getDate() + (input.expira_dias ?? 7));
  const { data, error } = await supabase
    .from("convites")
    .insert({
      email: input.email.trim().toLowerCase(),
      papel: input.papel,
      revenda_id: input.revenda_id ?? null,
      invited_by: input.invited_by,
      expira_em: expira.toISOString(),
    } as never)
    .select("*")
    .single();
  return { data: data as unknown as ConviteRow | null, error: error?.message };
}

export type InvitePublicData = {
  id: string;
  email: string;
  papel: Papel;
  revenda_id: string | null;
  revenda_nome: string | null;
  expira_em: string;
};

export async function getInvite(token: string): Promise<{ data?: InvitePublicData; error?: string }> {
  const { data, error } = await supabase.rpc("get_invite" as never, { p_token: token } as never);
  if (error) return { error: error.message };
  const obj = data as unknown as Record<string, unknown>;
  if (obj?.error) return { error: String(obj.error) };
  return { data: obj as unknown as InvitePublicData };
}

export async function aceitarConvite(token: string, userId: string): Promise<{ ok?: boolean; papel?: Papel; error?: string }> {
  const { data, error } = await supabase.rpc("aceitar_convite" as never, { p_token: token, p_user_id: userId } as never);
  if (error) return { error: error.message };
  const obj = data as unknown as Record<string, unknown>;
  if (obj?.error) return { error: String(obj.error) };
  return { ok: true, papel: obj?.papel as Papel };
}

export function useLiveConvites(filter?: { revendaId?: string }) {
  const [items, setItems] = useState<ConviteRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    let q = supabase
      .from("convites")
      .select("*, revenda:revendas(nome)")
      .order("created_at", { ascending: false });
    if (filter?.revendaId) q = q.eq("revenda_id", filter.revendaId);
    const { data, error } = await q;
    if (error) { setError(error.message); return; }
    setError(null);
    setItems((data ?? []) as unknown as ConviteRow[]);
  }, [filter?.revendaId]);

  useEffect(() => { load(); }, [load]);
  useChannel(`convites-${filter?.revendaId ?? "all"}`, "convites", load);

  return { items, error, refresh: load };
}

export function buildInviteUrl(token: string): string {
  const base = typeof window !== "undefined" ? window.location.origin : "";
  return `${base}/?invite=${encodeURIComponent(token)}`;
}

/* ====================================================================
 * NOTIFICAÇÕES
 * ================================================================== */

export type Notificacao = {
  id: string;
  user_id: string;
  tipo: string;
  titulo: string;
  texto: string | null;
  link: string | null;
  entity_type: string | null;
  entity_id: string | null;
  lida: boolean;
  lida_em: string | null;
  created_at: string;
};

export function useLiveNotificacoes(userId: string | null | undefined) {
  const [items, setItems] = useState<Notificacao[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) { setItems([]); return; }
    const { data, error } = await supabase
      .from("notificacoes")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) { setError(error.message); return; }
    setError(null);
    setItems((data ?? []) as unknown as Notificacao[]);
  }, [userId]);

  useEffect(() => { load(); }, [load]);
  useChannel(`notificacoes-${userId ?? "none"}`, "notificacoes", load);

  return { items, error, refresh: load };
}

export async function marcarNotifLida(id: string) {
  const { error } = await supabase.from("notificacoes").update({ lida: true, lida_em: new Date().toISOString() } as never).eq("id", id);
  return { error: error?.message };
}

export async function marcarTodasLidas(userId: string) {
  const { error } = await supabase.from("notificacoes")
    .update({ lida: true, lida_em: new Date().toISOString() } as never)
    .eq("user_id", userId).eq("lida", false);
  return { error: error?.message };
}

/* ====================================================================
 * ACEITES DE TERMOS (LGPD)
 * ================================================================== */

export const TERMOS_VERSAO = "v1.0";
export const POLITICA_VERSAO = "v1.0";

export async function registrarAceiteTermos(userId: string) {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : null;
  const rows = [
    { user_id: userId, tipo: "termos_uso", versao: TERMOS_VERSAO, user_agent: ua },
    { user_id: userId, tipo: "politica_privacidade", versao: POLITICA_VERSAO, user_agent: ua },
  ];
  const { error } = await supabase.from("aceites_termos").insert(rows as never);
  return { error: error?.message };
}

export async function meusAceites(userId: string) {
  const { data } = await supabase
    .from("aceites_termos")
    .select("tipo, versao, aceito_em")
    .eq("user_id", userId)
    .order("aceito_em", { ascending: false });
  return data ?? [];
}

/* ====================================================================
 * Helpers de UI
 * ================================================================== */

export const OPERADORAS_LIST: Operadora[] = ["Vivo", "TIM", "Claro", "Oi"];

export const PIPELINE_COMERCIAL_DB = [
  { id: "novo" as const,        label: "Novo Lead",            color: "var(--pc-novo)" },
  { id: "contato" as const,     label: "Em Contato",           color: "var(--pc-contato)" },
  { id: "proposta" as const,    label: "Proposta Enviada",     color: "var(--pc-proposta)" },
  { id: "travado" as const,     label: "Travado (Advox)",      color: "var(--pc-travado)" },
  { id: "aguardando" as const,  label: "Aguardando Liberação", color: "var(--pc-aguardando)" },
  { id: "negociacao" as const,  label: "Negociação Final",     color: "var(--pc-negociacao)" },
  { id: "fechado" as const,     label: "Fechado",              color: "var(--pc-fechado)" },
  { id: "perdido" as const,     label: "Perdido",              color: "var(--pc-perdido)" },
];

export const PIPELINE_JURIDICO_DB = [
  { id: "recebido" as const,      label: "Lead Recebido",       color: "var(--pj-recebido)" },
  { id: "analise" as const,       label: "Em Análise",          color: "var(--pj-analise)" },
  { id: "contato" as const,       label: "Contato Inicial",     color: "var(--pj-contato)" },
  { id: "honorarios" as const,    label: "Proposta Honorários", color: "var(--pj-honorarios)" },
  { id: "contratou" as const,     label: "Cliente Contratou",   color: "var(--pj-contratou)" },
  { id: "documentacao" as const,  label: "Documentação",        color: "var(--pj-documentacao)" },
  { id: "extrajudicial" as const, label: "Extrajudicial",       color: "var(--pj-extrajudicial)" },
  { id: "judicial" as const,      label: "Judicial",            color: "var(--pj-judicial)" },
  { id: "liberado" as const,      label: "Liberado",            color: "var(--pj-liberado)" },
  { id: "naoliberado" as const,   label: "Não Liberado",        color: "var(--pj-naoliberado)" },
  { id: "recusou" as const,       label: "Recusou",             color: "var(--pj-recusou)" },
];

export const fmtBRL = (n: number) =>
  "R$ " + Number(n).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
