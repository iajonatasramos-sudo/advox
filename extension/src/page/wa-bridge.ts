// Roda no CONTEXTO DA PÁGINA (web.whatsapp.com, mundo MAIN).
// O vendor/wppconnect-wa.js é carregado antes e define window.WPP.
// Conversa com o content script via window.postMessage ({ __advox: ... }).
// Base: ponte do BuildChat (src/page/wa-bridge.ts), reduzida ao que o Advox usa.

type Req = { __advox: 'req'; id: string; cmd: string; payload?: any };

let pronto = false;
let WPP: any;

function emitir(evento: string, data?: any) {
  window.postMessage({ __advox: 'evt', evento, data }, '*');
}

function responder(id: string, ok: boolean, data?: any, erro?: string) {
  window.postMessage({ __advox: 'res', id, ok, data, erro }, '*');
}

/**
 * Conversas @lid: o id é um número interno de 15 dígitos que NÃO é telefone.
 * O telefone real vem de WPP.contact.getPnLidEntry (fica em cache).
 */
const telefonePorLid = new Map<string, string>();

function telefoneDoChat(chat: any, id: string): string | null {
  if (!chat || id.endsWith('@g.us')) return null;
  if (id.endsWith('@c.us') && chat.id?.user) return String(chat.id.user);
  if (id.endsWith('@lid')) {
    return telefonePorLid.get(id) ?? chat.contact?.phoneNumber?.user ?? chat.phoneNumber?.user ?? null;
  }
  return chat.id?.user ? String(chat.id.user) : null;
}

async function resolverTelefone(id: string): Promise<string | null> {
  if (!id.endsWith('@lid')) return null;
  const emCache = telefonePorLid.get(id);
  if (emCache) return emCache;
  try {
    const entrada = await WPP.contact.getPnLidEntry(id);
    const numero = entrada?.phoneNumber?.id ?? entrada?.phoneNumber?._serialized?.split('@')[0];
    const digitos = String(numero ?? '').replace(/\D/g, '');
    if (digitos.length >= 8) {
      telefonePorLid.set(id, digitos);
      return digitos;
    }
  } catch {
    /* sem mapeamento: fica sem telefone (nunca mostrar o LID) */
  }
  return null;
}

function contatoDoChat(chat: any) {
  if (!chat) return null;
  const id = chat.id?._serialized ?? String(chat.id ?? '');
  const ehGrupo = !!chat.isGroup || id.endsWith('@g.us');
  const nome = chat.formattedTitle || chat.name || chat.contact?.formattedName || chat.contact?.pushname || '';
  const digitos = ehGrupo ? null : telefoneDoChat(chat, id);
  return { chatId: id, nome, telefone: digitos, ehGrupo };
}

async function contatoCompleto(chat: any) {
  const base = contatoDoChat(chat);
  if (!base || base.telefone || base.ehGrupo) return base;
  const digitos = await resolverTelefone(base.chatId);
  return digitos ? { ...base, telefone: digitos } : base;
}

const fotosPorId = new Map<string, string | null>();

const comandos: Record<string, (payload: any) => Promise<any>> = {
  async ping() {
    let mainReady = false;
    try { mainReady = !!WPP?.conn?.isMainReady?.(); } catch { /* diagnóstico */ }
    return { pronto, temWPP: !!WPP, mainReady };
  },
  async activeChat() {
    return contatoCompleto(WPP.chat.getActiveChat());
  },
  async listChats() {
    const chats = (await WPP.chat.list()) ?? [];
    return chats
      .map((c: any) => {
        const base = contatoDoChat(c);
        if (!base) return null;
        return { ...base, naoLidas: c.unreadCount ?? 0, ultimaTs: typeof c.t === 'number' ? c.t : null };
      })
      .filter(Boolean);
  },
  async openChat({ chatId }: { chatId: string }) {
    await WPP.chat.openChatBottom(chatId);
    return { ok: true };
  },
  /** Foto de perfil (cache por id). Sem foto ou sem permissão: null — a UI usa as iniciais. */
  async fotos({ ids }: { ids: string[] }) {
    const saida: Record<string, string | null> = {};
    await Promise.all((ids ?? []).slice(0, 60).map(async (id) => {
      if (fotosPorId.has(id)) { saida[id] = fotosPorId.get(id) ?? null; return; }
      let url: string | null = null;
      try { url = (await WPP.contact.getProfilePictureUrl(id)) ?? null; } catch { url = null; }
      fotosPorId.set(id, url);
      saida[id] = url;
    }));
    return saida;
  },
  /** Foto do WhatsApp conectado (botão da conta na barra do topo). */
  async minhaFoto() {
    try {
      const eu = WPP.conn.getMyUserId?.()?._serialized;
      return eu ? ((await WPP.contact.getProfilePictureUrl(eu)) ?? null) : null;
    } catch { return null; }
  },
  async sendText({ texto }: { texto: string }) {
    const chat = WPP.chat.getActiveChat();
    const alvo = chat?.id?._serialized;
    if (!alvo) throw new Error('Nenhuma conversa aberta.');
    await WPP.chat.sendTextMessage(alvo, texto, { createChat: true });
    return { ok: true };
  },
};

window.addEventListener('message', (ev: MessageEvent) => {
  const msg = ev.data as Req;
  if (!msg || msg.__advox !== 'req') return;
  const fn = comandos[msg.cmd];
  if (!fn) { responder(msg.id, false, undefined, `Comando desconhecido: ${msg.cmd}`); return; }
  fn(msg.payload)
    .then((data) => responder(msg.id, true, data))
    .catch((e) => responder(msg.id, false, undefined, e?.message ?? String(e)));
});

/**
 * O wa-js percorre os módulos "WA*" do WhatsApp, inclusive cada
 * WAWebMoment-<idioma>; cada um chama moment.defineLocale e troca o idioma
 * GLOBAL (as datas do WhatsApp saíam em suaíli). Trava defineLocale para não
 * mudar o idioma atual. (Mesma correção do BuildChat.)
 */
const ehMoment = (m: any) => !!m && typeof m.locale === 'function' && typeof m.defineLocale === 'function';
let momentAchado: any = null;

function acharMoment(): any {
  if (momentAchado) return momentAchado;
  const w = window as any;
  const carregar = (nome: string) => {
    try { return typeof w.importNamespace === 'function' ? w.importNamespace(nome) : w.require?.(nome); } catch { return null; }
  };
  let candidatos = ['WAWebMoment', 'moment'];
  try {
    const mapa = w.require?.('__debug')?.modulesMap ?? {};
    const doMapa = Object.keys(mapa).filter((n) => /moment/i.test(n) && !/moment-[a-z]/i.test(n));
    candidatos = [...new Set([...candidatos, ...doMapa])];
  } catch { /* sem __debug */ }
  for (const nome of candidatos) {
    const m = carregar(nome);
    const achado = ehMoment(m) ? m : ehMoment(m?.default) ? m.default : null;
    if (achado) { momentAchado = achado; break; }
  }
  return momentAchado;
}

function corrigirIdiomaDasDatas(): boolean {
  try {
    const moment = acharMoment();
    if (!moment) return false;
    if (!moment.__advoxTravado) {
      const original = moment.defineLocale.bind(moment);
      moment.defineLocale = (nome: string, cfg: unknown) => {
        const atual = moment.locale();
        const r = original(nome, cfg);
        if (moment.locale() !== atual) moment.locale(atual);
        return r;
      };
      moment.__advoxTravado = true;
    }
    const lang = (document.documentElement.lang || navigator.language || 'pt-BR').toLowerCase();
    const disponiveis: string[] = moment.locales?.() ?? [];
    const alvo = [lang, lang.split('-')[0]].find((l) => disponiveis.includes(l));
    if (alvo && moment.locale() !== alvo) moment.locale(alvo);
    return true;
  } catch {
    return false;
  }
}

function marcarPronto() {
  if (pronto) return;
  pronto = true;
  emitir('ready');
  console.info('[Advox] WhatsApp pronto.');
  for (const ms of [0, 3000, 10_000, 30_000]) setTimeout(corrigirIdiomaDasDatas, ms);
  try {
    WPP.on('chat.active_chat', (chat: any) => {
      // Emite já e de novo quando o telefone de uma conversa @lid for resolvido.
      const base = contatoDoChat(chat);
      emitir('active-chat', base);
      if (base && !base.telefone && !base.ehGrupo) {
        contatoCompleto(chat).then((c) => c?.telefone && emitir('active-chat', c));
      }
    });
  } catch { /* o content script tem fallback por DOM */ }
}

function iniciar() {
  WPP = (window as any).WPP;
  if (!WPP) { setTimeout(iniciar, 100); return; }
  let tentativas = 0;
  const travar = setInterval(() => { if (corrigirIdiomaDasDatas() || ++tentativas > 120) clearInterval(travar); }, 500);
  try {
    const wp = WPP.webpack;
    if (wp?.injectLoader && !wp.isInjected) wp.injectLoader();
    wp?.onFullReady?.(marcarPronto);
  } catch { /* API antiga indisponível */ }
  try { WPP.on?.('conn.main_ready', marcarPronto); } catch { /* evento indisponível */ }
  const vigia = setInterval(() => {
    try { if (WPP.conn?.isMainReady?.()) { clearInterval(vigia); marcarPronto(); } } catch { /* carregando */ }
  }, 1000);
}
iniciar();
