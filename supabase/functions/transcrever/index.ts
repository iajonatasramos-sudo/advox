// transcrever — a extensão AdvoxChat manda o áudio de uma mensagem do WhatsApp
// e recebe o texto. Mesmo desenho do BuildChat (/api/transcrever): a chave do
// provedor fica AQUI (secret da função), nunca na extensão.
//
//   POST multipart/form-data, campo "file" (o áudio), com o JWT do usuário
//   resposta: { ok: true, texto } | { ok: false, erro }
//
// Secrets (Supabase → Edge Functions → Secrets) — um dos dois modos:
//   TRANSCRICAO_PROXY_URL URL completa de um serviço que responde { ok, texto }
//                         (ex.: /api/transcrever do BuildClinic com ?token=…,
//                         que usa o faster-whisper próprio). Tem prioridade.
//   TRANSCRICAO_API_KEY   chave de uma API compatível com OpenAI
//   TRANSCRICAO_BASE_URL  API compatível com OpenAI (padrão https://api.openai.com/v1;
//                         Groq: https://api.groq.com/openai/v1)
//   TRANSCRICAO_MODELO    padrão whisper-1 (Groq: whisper-large-v3-turbo)
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const LIMITE = 25 * 1024 * 1024; // teto do Whisper

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ ok: false, erro: "Método não permitido" }, 405);

  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!jwt) return json({ ok: false, erro: "Sessão expirada. Entre de novo na sua conta." }, 401);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: quem, error: e1 } = await admin.auth.getUser(jwt);
  if (e1 || !quem.user) return json({ ok: false, erro: "Sessão expirada. Entre de novo na sua conta." }, 401);

  const { data: perfil } = await admin.from("profiles").select("status").eq("id", quem.user.id).maybeSingle();
  if (perfil?.status !== "ativo") return json({ ok: false, erro: "Sua conta não está ativa no Advox." }, 403);

  const proxy = Deno.env.get("TRANSCRICAO_PROXY_URL")?.trim();
  const chave = Deno.env.get("TRANSCRICAO_API_KEY")?.trim();
  if (!proxy && !chave) return json({ ok: false, erro: "Transcrição ainda não configurada. Avise o administrador." }, 503);
  const base = (Deno.env.get("TRANSCRICAO_BASE_URL")?.trim() || "https://api.openai.com/v1").replace(/\/$/, "");
  const modelo = Deno.env.get("TRANSCRICAO_MODELO")?.trim() || "whisper-1";

  let arquivo: File;
  try {
    const form = await req.formData();
    const f = form.get("file");
    if (!(f instanceof File)) return json({ ok: false, erro: 'Envie o áudio no campo "file".' }, 422);
    arquivo = f;
  } catch {
    return json({ ok: false, erro: "Não consegui ler o áudio enviado." }, 422);
  }
  if (arquivo.size === 0) return json({ ok: false, erro: "Áudio vazio." }, 422);
  if (arquivo.size > LIMITE) return json({ ok: false, erro: "Áudio maior que 25 MB." }, 413);

  if (proxy) {
    // Serviço próprio: repassa o arquivo e devolve o { ok, texto } dele.
    try {
      const fw = new FormData();
      fw.append("file", arquivo, arquivo.name || "audio.ogg");
      const r = await fetch(proxy, { method: "POST", body: fw });
      const j = (await r.json().catch(() => null)) as { ok?: boolean; texto?: string; erro?: string } | null;
      if (j?.ok && j.texto?.trim()) return json({ ok: true, texto: j.texto.trim() });
      console.error("[Advox] transcrever proxy", r.status, j?.erro ?? "");
      if (r.ok && j) return json({ ok: false, erro: j.erro || "Não há fala reconhecível neste áudio." });
      return json({ ok: false, erro: `Transcrição indisponível agora (${r.status}).` }, 502);
    } catch (e) {
      console.error("[Advox] transcrever proxy", e);
      return json({ ok: false, erro: "Falha ao transcrever." }, 500);
    }
  }

  const envio = new FormData();
  envio.append("file", arquivo, arquivo.name || "audio.ogg");
  envio.append("model", modelo);
  envio.append("language", "pt");

  try {
    const r = await fetch(`${base}/audio/transcriptions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${chave!}` },
      body: envio,
    });
    if (!r.ok) {
      const t = await r.text().catch(() => "");
      console.error("[Advox] transcrever provedor", r.status, t.slice(0, 300));
      return json({ ok: false, erro: `Transcrição indisponível agora (IA ${r.status}).` }, 502);
    }
    const j = (await r.json()) as { text?: string };
    const texto = j.text?.trim() ?? "";
    if (!texto) return json({ ok: false, erro: "Não há fala reconhecível neste áudio." });
    return json({ ok: true, texto });
  } catch (e) {
    console.error("[Advox] transcrever", e);
    return json({ ok: false, erro: "Falha ao transcrever." }, 500);
  }
});
