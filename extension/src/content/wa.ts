// Lado do CONTENT SCRIPT: RPC com o wa-bridge (página) + helpers de DOM.
// Base: BuildChat src/lib/wa.ts e src/lib/dom.ts.

export type Contato = { chatId: string; nome: string; telefone: string | null; ehGrupo: boolean };
export type ChatResumo = Contato & { naoLidas: number; ultimaTs: number | null };

type Pendente = { resolve: (v: any) => void; reject: (e: Error) => void; timer: number };
const pendentes = new Map<string, Pendente>();
const ouvintes = new Set<(c: Contato | null) => void>();
let bridgePronta = false;
let seq = 0;

const aguardar = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function iniciarBridge() {
  window.addEventListener('message', (ev: MessageEvent) => {
    const msg = ev.data;
    if (!msg || !msg.__advox) return;
    if (msg.__advox === 'res') {
      const p = pendentes.get(msg.id);
      if (!p) return;
      pendentes.delete(msg.id);
      clearTimeout(p.timer);
      if (msg.ok) p.resolve(msg.data); else p.reject(new Error(msg.erro ?? 'Erro na ponte do WhatsApp'));
    } else if (msg.__advox === 'evt') {
      if (msg.evento === 'ready') bridgePronta = true;
      if (msg.evento === 'active-chat') ouvintes.forEach((fn) => fn(msg.data ?? null));
    }
  });
  // O evento "ready" pode se perder (extensão recarregada): ping periódico confirma.
  const ping = window.setInterval(async () => {
    if (bridgePronta) { window.clearInterval(ping); return; }
    try {
      const r = await chamar<{ pronto: boolean }>('ping', undefined, 1500);
      if (r?.pronto) { bridgePronta = true; window.clearInterval(ping); }
    } catch { /* script MAIN ainda carregando */ }
  }, 2000);
}

function chamar<T = any>(cmd: string, payload?: any, timeoutMs = 10000): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = `advox-${++seq}-${Date.now()}`;
    const timer = window.setTimeout(() => { pendentes.delete(id); reject(new Error('Tempo esgotado na ponte do WhatsApp.')); }, timeoutMs);
    pendentes.set(id, { resolve, reject, timer });
    window.postMessage({ __advox: 'req', id, cmd, payload }, '*');
  });
}

// ─────────────── DOM ───────────────

function caixaDeTexto(): HTMLElement | null {
  return (
    document.querySelector<HTMLElement>('footer div[contenteditable="true"][data-tab]') ||
    document.querySelector<HTMLElement>('footer div[contenteditable="true"][role="textbox"]') ||
    document.querySelector<HTMLElement>('footer [contenteditable="true"]')
  );
}

function tituloDaConversa(): string | null {
  const el = document.querySelector('#main header span[title]') || document.querySelector("#main header span[dir='auto']");
  return el ? ((el.getAttribute('title') || el.textContent || '').trim() || null) : null;
}

/**
 * Coloca `texto` na caixa de mensagem SEM enviar. O editor do WhatsApp
 * (Lexical) renderiza assíncrono: limpa, simula "colar", espera e só então
 * tenta insertText se nada apareceu (evita texto duplicado).
 */
export async function inserirNaCaixa(texto: string): Promise<boolean> {
  const box = caixaDeTexto();
  if (!box) return false;
  box.focus();
  document.execCommand('selectAll', false);
  document.execCommand('delete', false);
  await aguardar(60);
  const dt = new DataTransfer();
  dt.setData('text/plain', texto);
  box.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  await aguardar(150);
  if (!(box.textContent ?? '').trim()) {
    document.execCommand('insertText', false, texto);
    await aguardar(80);
  }
  return true;
}

// ─────────────── Conversa ativa ───────────────

export async function contatoAtivo(): Promise<Contato | null> {
  if (bridgePronta) {
    try {
      const c = await chamar<Contato | null>('activeChat', undefined, 4000);
      if (c) return c;
    } catch { /* cai para o DOM */ }
  }
  const titulo = tituloDaConversa();
  if (!titulo) return null;
  // Sem a ponte, só dá para tirar telefone do título quando o contato não está salvo.
  const digitos = titulo.replace(/\D/g, '');
  return { chatId: `dom:${titulo}`, nome: titulo, telefone: digitos.length >= 10 && /^[+\d\s()-]+$/.test(titulo) ? digitos : null, ehGrupo: false };
}

/** Observa troca de conversa: evento do WPP + fallback pelo título no DOM. */
export function observarConversa(cb: (c: Contato | null) => void): () => void {
  ouvintes.add(cb);
  let ultimo = tituloDaConversa();
  let timer = 0;
  const obs = new MutationObserver(() => {
    if (timer) return;
    timer = window.setTimeout(() => {
      timer = 0;
      const t = tituloDaConversa();
      if (t !== ultimo) { ultimo = t; contatoAtivo().then(cb); }
    }, 300);
  });
  obs.observe(document.body, { childList: true, subtree: true });
  return () => { ouvintes.delete(cb); obs.disconnect(); };
}

export function bridgeDisponivel() { return bridgePronta; }

/** Todas as conversas do WhatsApp (via WPP). Vazio se a ponte não conectou. */
export async function listarChats(): Promise<ChatResumo[]> {
  for (let i = 0; i < 20 && !bridgePronta; i++) await aguardar(1000);
  if (!bridgePronta) return [];
  try { return await chamar<ChatResumo[]>('listChats', undefined, 10000); } catch { return []; }
}

export async function abrirChat(chatId: string): Promise<boolean> {
  try { await chamar('openChat', { chatId }, 8000); return true; } catch { return false; }
}

export function caixaDeMensagem(): HTMLElement | null { return caixaDeTexto(); }

export async function fotosDosContatos(ids: string[]): Promise<Record<string, string | null>> {
  if (!bridgePronta || !ids.length) return {};
  try { return await chamar('fotos', { ids }, 15000); } catch { return {}; }
}

export async function minhaFoto(): Promise<string | null> {
  for (let i = 0; i < 20 && !bridgePronta; i++) await aguardar(1000);
  if (!bridgePronta) return null;
  try { return await chamar('minhaFoto', undefined, 8000); } catch { return null; }
}

/**
 * Envia o texto na conversa aberta: WPP primeiro; sem ponte, cai no DOM
 * (cola na caixa e aperta o botão de enviar).
 */
export async function enviarTexto(texto: string): Promise<boolean> {
  if (bridgePronta) {
    try { await chamar('sendText', { texto }, 15000); return true; } catch { /* cai no DOM */ }
  }
  if (!(await inserirNaCaixa(texto))) return false;
  await aguardar(200);
  const botao =
    document.querySelector<HTMLElement>('#main footer button[aria-label="Enviar"]') ||
    document.querySelector<HTMLElement>('#main footer button[aria-label="Send"]') ||
    document.querySelector<HTMLElement>('#main footer span[data-icon="send"]')?.closest('button') ||
    document.querySelector<HTMLElement>('#main footer span[data-icon="wds-ic-send-filled"]')?.closest('button');
  if (!botao) return false;
  botao.click();
  return true;
}

/** Limpa a caixa de mensagem (depois de escolher no atalho "/"). */
export function limparCaixa() {
  const box = caixaDeTexto();
  if (!box) return;
  box.focus();
  document.execCommand('selectAll', false);
  document.execCommand('delete', false);
}

// ─────────────── Áudio (transcrição) ───────────────

/** Hashes das mensagens de áudio da conversa aberta (vazio se a ponte não responder). */
export async function idsDeAudioDoChat(): Promise<string[]> {
  if (!bridgePronta) return [];
  try {
    const r = await chamar<{ ids: string[] }>('audiosDoChat', undefined, 8000);
    return r?.ids ?? [];
  } catch {
    return [];
  }
}

/**
 * Áudio de uma mensagem como Blob. Primeiro o caminho barato (o blob URL do
 * <audio> da bolha, se a pessoa já tocou); senão o WPP baixa e descriptografa.
 */
export async function obterAudioDaMensagem(audioEl: HTMLAudioElement | null, msgId: string | null): Promise<Blob> {
  const src = audioEl?.getAttribute('src') || audioEl?.src || '';
  if (src && !src.startsWith('data:')) {
    try {
      const blob = await (await fetch(src)).blob();
      if (blob.size > 0) return blob;
    } catch { /* blob revogado — segue para o WPP */ }
  }
  if (!msgId) throw new Error('Não consegui identificar este áudio. Toque nele uma vez e tente de novo.');
  const r = await chamar<{ dataUrl: string }>('downloadMedia', { msgId }, 60000);
  return await (await fetch(r.dataUrl)).blob();
}
