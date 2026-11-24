// impersonar — "Visualizando como" do admin (mesmo modelo do BuildClinic).
//
// POST { acao: "iniciar", alvo_id, impersonacao_id? }
//   Quem chama precisa ser admin ativo OU estar dentro de uma impersonação
//   aberta (impersonacao_id cujo alvo é quem chama) — assim dá para trocar de
//   pessoa sem voltar antes. Alvo não pode ser admin.
//   → { token_hash, impersonacao_id }
// POST { acao: "voltar", impersonacao_id }
//   Quem chama tem que ser o alvo da impersonação aberta (< 12h).
//   → { token_hash } do admin original.
//
// O app troca o token_hash por sessão com verifyOtp (link mágico de uso único,
// sem e-mail). Tudo vai para a auditoria.
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const DOZE_HORAS = 12 * 60 * 60 * 1000;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ erro: "Método não permitido" }, 405);

  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: quem } = await sb.auth.getUser(jwt);
  const eu = quem?.user;
  if (!eu) return json({ erro: "Sessão inválida" }, 401);

  let corpo: { acao?: string; alvo_id?: string; impersonacao_id?: string } = {};
  try { corpo = await req.json(); } catch { /* vazio */ }

  const perfil = async (id: string) =>
    (await sb.from("profiles").select("id, email, nome, papel, status").eq("id", id).maybeSingle()).data as
      { id: string; email: string; nome: string; papel: string; status: string } | null;

  /** Impersonação aberta em que EU sou o alvo. */
  const aberta = async (id?: string) => {
    if (!id) return null;
    const { data } = await sb.from("impersonacoes").select("id, admin_id, alvo_id, iniciada_em, encerrada_em").eq("id", id).maybeSingle();
    if (!data || data.encerrada_em || data.alvo_id !== eu.id) return null;
    if (Date.now() - new Date(data.iniciada_em).getTime() > DOZE_HORAS) return null;
    return data as { id: string; admin_id: string; alvo_id: string };
  };

  const link = async (email: string) => {
    const { data, error } = await sb.auth.admin.generateLink({ type: "magiclink", email });
    if (error || !data?.properties?.hashed_token) throw new Error(error?.message ?? "Falha ao gerar o acesso");
    return data.properties.hashed_token;
  };

  const auditar = (actor: string, action: string, alvo: string, details: Record<string, unknown>) =>
    sb.from("auditoria").insert({ actor_id: actor, action, entity_type: "profile", entity_id: alvo, details, user_agent: req.headers.get("user-agent") });

  try {
    if (corpo.acao === "iniciar") {
      if (!corpo.alvo_id) return json({ erro: "Escolha o usuário" }, 400);
      const meuPerfil = await perfil(eu.id);
      const anterior = await aberta(corpo.impersonacao_id);
      const adminId = meuPerfil?.papel === "admin" && meuPerfil.status === "ativo" ? eu.id : anterior?.admin_id;
      if (!adminId) return json({ erro: "Só o administrador pode visualizar como outro usuário" }, 403);

      const alvo = await perfil(corpo.alvo_id);
      if (!alvo) return json({ erro: "Usuário não encontrado" }, 404);
      if (alvo.id === adminId) {
        // Escolheu a si mesmo = voltar.
        if (anterior) await sb.from("impersonacoes").update({ encerrada_em: new Date().toISOString() }).eq("id", anterior.id);
        return json({ token_hash: await link(alvo.email), impersonacao_id: null });
      }
      if (alvo.papel === "admin") return json({ erro: "Não é possível visualizar como outro administrador" }, 403);
      if (alvo.status !== "ativo") return json({ erro: "Esse usuário não está ativo" }, 400);

      if (anterior) await sb.from("impersonacoes").update({ encerrada_em: new Date().toISOString() }).eq("id", anterior.id);
      const { data: nova, error } = await sb.from("impersonacoes").insert({ admin_id: adminId, alvo_id: alvo.id }).select("id").single();
      if (error) throw error;
      await auditar(adminId, "impersonacao_inicio", alvo.id, { alvo: alvo.nome, papel: alvo.papel });
      return json({ token_hash: await link(alvo.email), impersonacao_id: nova.id });
    }

    if (corpo.acao === "voltar") {
      const imp = await aberta(corpo.impersonacao_id);
      if (!imp) return json({ erro: "Sessão de visualização expirada — entre de novo com o seu login" }, 403);
      const admin = await perfil(imp.admin_id);
      if (!admin || admin.papel !== "admin") return json({ erro: "Administrador não encontrado" }, 404);
      await sb.from("impersonacoes").update({ encerrada_em: new Date().toISOString() }).eq("id", imp.id);
      await auditar(admin.id, "impersonacao_fim", imp.alvo_id, {});
      return json({ token_hash: await link(admin.email) });
    }

    return json({ erro: "Ação inválida" }, 400);
  } catch (e) {
    console.error("[Advox] impersonar", e);
    return json({ erro: "Não foi possível trocar de usuário agora" }, 500);
  }
});
