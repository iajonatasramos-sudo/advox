// Botão "Transcrever" em cada mensagem de áudio (base: BuildChat
// src/content/transcrever.ts).
//
// Fica no DOM do próprio WhatsApp, dentro da bolha, junto do player (não em
// shadow root). O estilo vem de uma folha própria com prefixo `advox-tr-`.
//
// COMO A MENSAGEM DE ÁUDIO É ENCONTRADA:
//   * o <audio> só existe depois que a pessoa toca o áudio;
//   * as classes e os `data-icon` da bolha mudam a cada versão do WhatsApp.
// O estável é o `data-id` da linha: perguntamos ao WPP quais mensagens da
// conversa são de voz/áudio e cruzamos pelo hash. Sinais de DOM são reforço.
//
// A lista é virtualizada (a bolha some e volta ao rolar): o observer reinsere
// o botão e um cache por id devolve o texto já transcrito.
import { logado, tema } from '@/lib/store';
import { idsDeAudioDoChat, obterAudioDaMensagem } from './wa';
import { transcreverAudio } from './api';

const MARCA = 'advoxTr'; // dataset.advoxTr — não duplica o bloco na mesma mensagem
const cache = new Map<string, string>(); // msgId -> texto já transcrito
let idsAudio = new Set<string>(); // hashes dos áudios da conversa aberta, segundo o WPP

const hashDoId = (id: string) => {
  const partes = id.split('_');
  return partes.length >= 3 ? partes[2] : id;
};

function injetarEstilo() {
  if (document.getElementById('advox-tr-estilo')) return;
  const estilo = document.createElement('style');
  estilo.id = 'advox-tr-estilo';
  // O padding de baixo reserva a faixa onde o WhatsApp desenha o horário.
  estilo.textContent = `
    .advox-tr { margin: 6px 0 0; padding: 0 0 18px; display: flex; flex-direction: column; gap: 6px;
      align-items: center; width: 100%; box-sizing: border-box; }
    .advox-tr-btn {
      display: inline-flex; align-items: center; gap: 7px;
      background: none; border: 1.5px solid var(--advox-tr-marca); border-radius: 999px;
      padding: 5px 16px; font-size: 14px; font-family: inherit; font-weight: 600;
      color: var(--advox-tr-marca); cursor: pointer; line-height: 1.5; transition: background .15s ease;
    }
    .advox-tr-btn:hover { background: var(--advox-tr-fundo-hover); }
    .advox-tr-btn:disabled { cursor: default; opacity: .7; }
    .advox-tr-btn svg { flex-shrink: 0; }
    .advox-tr-girando { animation: advox-tr-giro 1s linear infinite; transform-origin: center; }
    @keyframes advox-tr-giro { to { transform: rotate(360deg); } }
    .advox-tr-texto {
      align-self: stretch; font-size: 13.5px; line-height: 1.45; font-style: italic;
      color: var(--advox-tr-cor-texto); border-left: 2px solid var(--advox-tr-marca);
      padding: 1px 0 1px 8px; white-space: pre-wrap; word-break: break-word; text-align: left;
    }
    .advox-tr-erro { font-size: 12px; line-height: 1.4; color: var(--advox-tr-erro); text-align: center; }
    .advox-tr-refazer { background: none; border: 0; padding: 0; margin-left: 6px;
      font: inherit; font-size: 12px; color: var(--advox-tr-marca); cursor: pointer; text-decoration: underline; }
  `;
  document.head.appendChild(estilo);
}

/** Cores no azul do Advox, acompanhando o claro/escuro do WhatsApp. */
function aplicarCores() {
  const escuro = tema.get() === 'dark';
  const raiz = document.documentElement.style;
  raiz.setProperty('--advox-tr-cor-texto', escuro ? '#d1d7db' : '#3b4a54');
  raiz.setProperty('--advox-tr-marca', escuro ? '#7ea2ff' : '#1f4fd1');
  raiz.setProperty('--advox-tr-fundo-hover', escuro ? 'rgba(126,162,255,.12)' : 'rgba(31,79,209,.08)');
  raiz.setProperty('--advox-tr-erro', escuro ? '#f0a5a5' : '#b91c1c');
}

const ICONE_TEXTO = `<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor"
  stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
  <rect x="1.6" y="7.5" width="4.8" height="8" rx="2.4"/>
  <path d="M.2 13.2a3.8 3.8 0 0 0 7.6 0"/>
  <path d="M4 17.5v3.3"/>
  <path d="M10.6 2.2h11a1.6 1.6 0 0 1 1.6 1.6v6a1.6 1.6 0 0 1-1.6 1.6h-5.2l-3.4 2.9v-2.9h-2.4A1.6 1.6 0 0 1 9 9.8v-6a1.6 1.6 0 0 1 1.6-1.6Z"/>
  <path d="M11.9 5.3h8.4M11.9 8.2h5.2"/>
</svg>`;
const ICONE_GIRO = `<svg class="advox-tr-girando" viewBox="0 0 24 24" width="18" height="18" fill="none"
  stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 12a9 9 0 1 1-6.2-8.6"/></svg>`;

/** Reforço quando a ponte WPP não respondeu: sinais de que a bolha tem áudio. */
function pareceAudio(linha: HTMLElement): boolean {
  if (linha.querySelector('audio')) return true;
  if (linha.querySelector('[data-testid*="audio" i], [data-testid*="ptt" i]')) return true;
  for (const el of linha.querySelectorAll('[data-icon]')) {
    const nome = el.getAttribute('data-icon')?.toLowerCase() ?? '';
    if (nome.includes('audio') || nome.includes('ptt') || nome.includes('mic')) return true;
  }
  for (const el of linha.querySelectorAll('[aria-label]')) {
    const rotulo = el.getAttribute('aria-label')?.toLowerCase() ?? '';
    if (rotulo.includes('voice message') || rotulo.includes('mensagem de voz') || rotulo.includes('áudio')) return true;
  }
  return false;
}

/**
 * O balão da mensagem, por geometria: o elemento mais externo da linha com
 * fundo próprio e mais estreito que ela (classes mudam a cada versão).
 */
function acharBolha(linha: HTMLElement): HTMLElement {
  const larguraLinha = linha.getBoundingClientRect().width || 1;
  const fila: HTMLElement[] = [...linha.children].filter((n): n is HTMLElement => n instanceof HTMLElement);
  while (fila.length) {
    const el = fila.shift()!;
    const caixa = el.getBoundingClientRect();
    const fundo = getComputedStyle(el).backgroundColor;
    const opaco = fundo && !/rgba\(0, 0, 0, 0\)|transparent/.test(fundo);
    if (opaco && caixa.width > 60 && caixa.width < larguraLinha * 0.95) return el;
    fila.push(...[...el.children].filter((n): n is HTMLElement => n instanceof HTMLElement));
  }
  return (
    linha.querySelector<HTMLElement>('[class*="message-in"], [class*="message-out"]') ??
    linha.querySelector<HTMLElement>('.copyable-text') ??
    linha
  );
}

const PADRAO_HORA = /^\d{1,2}:\d{2}(\s?[AP]M)?$/i;

/** Rodapé (horário + ticks): entre as folhas com cara de hora, a mais à direita. */
function acharRodape(bolha: HTMLElement, bloco: HTMLElement): HTMLElement | null {
  let melhor: HTMLElement | null = null;
  let direita = -Infinity;
  const faixa = document.createRange();
  for (const el of bolha.querySelectorAll<HTMLElement>('span, div')) {
    if (el.children.length || bloco.contains(el)) continue;
    if (!PADRAO_HORA.test((el.textContent ?? '').trim())) continue;
    faixa.selectNodeContents(el); // mede o TEXTO (a duração "0:29" é um div largo)
    const r = faixa.getBoundingClientRect();
    if (r.width > 0 && r.right > direita) { direita = r.right; melhor = el; }
  }
  if (!melhor) return null;
  let alvo = melhor;
  while (alvo.parentElement && alvo.parentElement !== bolha) {
    const r = alvo.parentElement.getBoundingClientRect();
    if (r.width > 140 || r.height > 32) break;
    alvo = alvo.parentElement;
  }
  return alvo;
}

/** Leva o rodapé ao canto inferior direito da bolha com transform (sem mexer no nó). */
function encostarRodape(bolha: HTMLElement, bloco: HTMLElement) {
  const rodape = acharRodape(bolha, bloco);
  if (!rodape) return;
  rodape.style.transform = '';
  const b = bolha.getBoundingClientRect();
  const r = rodape.getBoundingClientRect();
  const dx = b.right - 10 - r.right;
  const dy = b.bottom - 6 - r.bottom;
  if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
  rodape.style.transform = `translate(${dx}px, ${dy}px)`;
}

function montarBloco(linha: HTMLElement, msgId: string | null) {
  const bloco = document.createElement('div');
  bloco.className = 'advox-tr';

  const botao = document.createElement('button');
  botao.type = 'button';
  botao.className = 'advox-tr-btn';
  botao.title = 'Advox — transcrever o áudio';
  botao.innerHTML = `${ICONE_TEXTO}<span>Transcrever</span>`;
  bloco.appendChild(botao);

  const mostrarTexto = (texto: string) => {
    botao.remove();
    bloco.querySelector('.advox-tr-erro')?.remove();
    const p = document.createElement('div');
    p.className = 'advox-tr-texto';
    p.textContent = `“${texto}”`;
    bloco.appendChild(p);
  };

  const mostrarErro = (mensagem: string) => {
    bloco.querySelector('.advox-tr-erro')?.remove();
    const p = document.createElement('div');
    p.className = 'advox-tr-erro';
    p.textContent = mensagem;
    const refazer = document.createElement('button');
    refazer.type = 'button';
    refazer.className = 'advox-tr-refazer';
    refazer.textContent = 'tentar de novo';
    refazer.addEventListener('click', () => { p.remove(); botao.click(); });
    p.appendChild(refazer);
    bloco.appendChild(p);
  };

  const pronta = msgId ? cache.get(msgId) : undefined;
  if (pronta) mostrarTexto(pronta);

  botao.addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    botao.disabled = true;
    botao.innerHTML = `${ICONE_GIRO}<span>Transcrevendo…</span>`;
    try {
      const texto = await transcreverAudio(await obterAudioDaMensagem(linha.querySelector('audio'), msgId));
      if (msgId) cache.set(msgId, texto);
      mostrarTexto(texto);
    } catch (erro) {
      botao.disabled = false;
      botao.innerHTML = `${ICONE_TEXTO}<span>Transcrever</span>`;
      mostrarErro(erro instanceof Error ? erro.message : 'Falha ao transcrever.');
    }
  });

  const bolha = acharBolha(linha);
  bolha.appendChild(bloco);
  (bloco as any).__ajustar = () => encostarRodape(bolha, bloco);
  requestAnimationFrame((bloco as any).__ajustar);
}

let ajusteAgendado = 0;
function reajustarRodapes() {
  if (ajusteAgendado) return;
  ajusteAgendado = requestAnimationFrame(() => {
    ajusteAgendado = 0;
    for (const bloco of document.querySelectorAll<HTMLElement>('.advox-tr')) (bloco as any).__ajustar?.();
  });
}

function removerTudo() {
  document.querySelectorAll('.advox-tr').forEach((el) => el.remove());
  document.querySelectorAll<HTMLElement>('#main [data-id]').forEach((l) => delete l.dataset[MARCA]);
}

export function montarTranscricao() {
  injetarEstilo();
  aplicarCores();
  tema.subscribe(aplicarCores);

  let consultando = false;
  let ultimaConsulta = 0;
  const atualizarIds = async () => {
    if (!logado.get() || consultando) return;
    consultando = true;
    ultimaConsulta = Date.now();
    try {
      const ids = await idsDeAudioDoChat();
      if (ids.length) { idsAudio = new Set(ids); garantir(); }
    } finally {
      consultando = false;
    }
  };

  const garantir = () => {
    if (!logado.get()) return; // sem login o botão nem aparece
    let desconhecidas = false;
    for (const linha of document.querySelectorAll<HTMLElement>('#main [data-id]')) {
      if (linha.dataset[MARCA]) continue;
      const msgId = linha.getAttribute('data-id');
      if (!(msgId && idsAudio.has(hashDoId(msgId))) && !pareceAudio(linha)) { desconhecidas = true; continue; }
      linha.dataset[MARCA] = '1';
      try { montarBloco(linha, msgId); } catch (e) { console.warn('[Advox] transcrição: não montei o botão', e); }
    }
    // Trocou de conversa ou rolou: pede a lista de novo (no máx. 1 a cada 1,5 s).
    if (desconhecidas && Date.now() - ultimaConsulta > 1500) atualizarIds();
  };

  logado.subscribe((sim) => { if (sim) atualizarIds(); else removerTudo(); });
  atualizarIds();
  setInterval(atualizarIds, 8000);

  let timer = 0;
  new MutationObserver(() => {
    if (timer) return;
    timer = window.setTimeout(() => { timer = 0; garantir(); reajustarRodapes(); }, 500);
  }).observe(document.body, { childList: true, subtree: true });
  garantir();
  window.addEventListener('resize', reajustarRodapes);
}
