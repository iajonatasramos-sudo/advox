// Acesso às tabelas que ainda não estão em database.types.ts (extensão do
// WhatsApp e Minha agenda). Mesmo cliente/sessão; só sem a tipagem do schema.
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "./supabase";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const sbx = supabase as unknown as SupabaseClient<any>;

export type WaPasta = { id: string; nome: string; cor: string; ordem: number; dono_id?: string };
export type WaPastaConversa = { pasta_id: string; chat_id: string; telefone: string | null; nome: string | null; dono_id?: string };
export type WaContato = {
  id: string; dono_id: string; chat_id: string; telefone: string | null; nome: string | null;
  interesses: string | null; ultimo_contato: string; created_at: string;
  dono?: { id: string; nome: string } | null;
};
export type MsgCategoria = { id: string; dono_id: string; revenda_id: string | null; nome: string; cor: string; ordem: number };
export type MsgRapida = {
  id: string; dono_id: string; revenda_id: string | null; categoria_id: string | null;
  titulo: string; atalho: string | null; texto: string; ordem: number; usos: number;
};

export const CORES_PASTA = ["#22c55e", "#3b82f6", "#a855f7", "#ec4899", "#f59e0b", "#ef4444", "#14b8a6", "#6366f1"];

/** Mudanças em tempo real numa lista de tabelas → recarrega. */
export function observarTabelas(tabelas: string[], cb: () => void): () => void {
  let ch = sbx.channel(`advoxchat-${Math.random().toString(36).slice(2)}`);
  for (const t of tabelas) ch = ch.on("postgres_changes", { event: "*", schema: "public", table: t }, cb);
  ch.subscribe();
  return () => { sbx.removeChannel(ch); };
}
