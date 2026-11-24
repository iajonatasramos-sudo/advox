import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!url || !anonKey) {
  /* eslint-disable no-console */
  console.warn(
    "[Advox] Supabase env vars ausentes. Copie .env.example para .env.local e preencha VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY."
  );
}

/**
 * Chegou pelo link "Esqueci minha senha"? Lido ANTES de criar o cliente,
 * porque o supabase-js consome o hash (#...type=recovery) ao iniciar.
 */
export const veioDoLinkDeRecuperacao =
  typeof window !== "undefined" &&
  (window.location.pathname === "/reset-password" || /type=recovery/.test(window.location.hash));

export const supabase: SupabaseClient<Database> = createClient<Database>(
  url ?? "https://placeholder.supabase.co",
  anonKey ?? "placeholder-anon-key",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);

export const isSupabaseConfigured = Boolean(url && anonKey);
