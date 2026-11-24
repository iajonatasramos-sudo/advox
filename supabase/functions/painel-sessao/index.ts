// painel-sessao — a extensão AdvoxChat abre o painel web JÁ LOGADO.
//
// A extensão chama com o JWT dela; aqui geramos um link mágico de uso único
// para o MESMO usuário (admin.generateLink não manda e-mail) e devolvemos só o
// token_hash. O app troca esse hash por uma sessão própria (verifyOtp), então
// extensão e painel não dividem o mesmo refresh token (um não derruba o outro).
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ erro: "Método não permitido" }, 405);

  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!jwt) return json({ erro: "Sem sessão" }, 401);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: quem, error: e1 } = await admin.auth.getUser(jwt);
  if (e1 || !quem.user?.email) return json({ erro: "Sessão inválida" }, 401);

  // Só conta ativa no Advox.
  const { data: perfil } = await admin.from("profiles").select("status").eq("id", quem.user.id).maybeSingle();
  if (perfil?.status !== "ativo") return json({ erro: "Conta não está ativa" }, 403);

  const { data: link, error: e2 } = await admin.auth.admin.generateLink({ type: "magiclink", email: quem.user.email });
  if (e2 || !link?.properties?.hashed_token) {
    console.error("[Advox] painel-sessao generateLink", e2);
    return json({ erro: "Não foi possível abrir o painel" }, 500);
  }
  return json({ token_hash: link.properties.hashed_token });
});
