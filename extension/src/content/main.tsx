// Entry do content script (mesma arquitetura do BuildChat): liga a ponte com o
// WhatsApp e monta a interface em shadow roots (o CSS não briga com o do
// WhatsApp). Uma raiz React só — a barra do topo e a do cabeçalho da conversa
// entram por portal nos shadow roots delas, então o estado é um só.
import { createRoot } from 'react-dom/client';
import { App } from '@/ui/App';
import { iniciarBridge } from './wa';
import { abaGaveta, gavetaAberta, logado, modalConta, tema } from '@/lib/store';
import { ALTURA_TOPBAR, LARGURA_GAVETA, LARGURA_TRILHO } from '@/lib/utils';
import '@/styles/tokens.css';

declare global { interface Window { __advoxExt?: boolean } }

const containers: HTMLElement[] = [];

function criarRaiz(host: HTMLElement): HTMLElement {
  const shadow = host.attachShadow({ mode: 'open' });
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = chrome.runtime.getURL('assets/content.css');
  shadow.appendChild(link);
  const container = document.createElement('div');
  container.className = 'bc-root';
  if (tema.get() === 'dark') container.dataset.tema = 'dark';
  shadow.appendChild(container);
  containers.push(container);
  return container;
}

// ── Tema: segue o claro/escuro do WhatsApp ──
function aplicarTema() {
  containers.forEach((c) => {
    if (!c.isConnected) return;
    if (tema.get() === 'dark') c.dataset.tema = 'dark';
    else delete c.dataset.tema;
  });
}
function detectarTema() {
  const cor = getComputedStyle(document.body).backgroundColor;
  const m = cor.match(/\d+/g);
  const escuro = m ? (Number(m[0]) + Number(m[1]) + Number(m[2])) / 3 < 128 : false;
  const novo = escuro ? 'dark' : 'light';
  if (novo !== tema.get()) { tema.set(novo); aplicarTema(); }
}

// ── Espaço para a barra do topo e a lateral ──
// O #app é position:absolute com altura em px via JS: ajustamos com !important.
function injetarEspaco() {
  const estilo = document.createElement('style');
  estilo.id = 'advox-espaco';
  estilo.textContent = `
    #app { top: ${ALTURA_TOPBAR}px !important; height: calc(100vh - ${ALTURA_TOPBAR}px) !important; }
    html.advox-on #app { width: calc(100vw - ${LARGURA_TRILHO}px) !important; }
    html.advox-on.advox-gaveta #app { width: calc(100vw - ${LARGURA_GAVETA}px) !important; }
  `;
  document.head.appendChild(estilo);
  const atualizar = () => {
    document.documentElement.classList.toggle('advox-on', logado.get());
    document.documentElement.classList.toggle('advox-gaveta', gavetaAberta.get());
  };
  logado.subscribe(atualizar);
  gavetaAberta.subscribe(atualizar);
  atualizar();
}

// ── Raio ⚡ dentro da barra de escrever, ao lado do microfone ──
const ZAP_SVG = '<svg viewBox="0 0 24 24" width="27" height="27" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>';

function corDoRaio(): string {
  if (gavetaAberta.get() && abaGaveta.get() === 'rapidas') return 'oklch(54% 0.18 264)';
  return tema.get() === 'dark' ? '#8696a0' : '#54656f';
}

function montarBotaoCompose() {
  const ID = 'advox-raio';
  const atualizarCor = () => { const b = document.getElementById(ID); if (b) b.style.color = corDoRaio(); };
  gavetaAberta.subscribe(atualizarCor);
  abaGaveta.subscribe(atualizarCor);
  tema.subscribe(atualizarCor);

  const garantir = () => {
    if (document.getElementById(ID)) return;
    const mic =
      document.querySelector('#main footer span[data-icon="ptt"]')?.closest('button') ||
      document.querySelector('#main footer span[data-icon="mic"]')?.closest('button') ||
      document.querySelector('#main footer span[data-icon="wds-ic-mic-outline"]')?.closest('button') ||
      document.querySelector('#main footer span[data-icon="wds-ic-mic-outline-filled"]')?.closest('button');
    if (!mic || !mic.parentElement) return;
    const btn = document.createElement('button');
    btn.id = ID;
    btn.type = 'button';
    btn.title = 'Advox — mensagens rápidas';
    btn.innerHTML = ZAP_SVG;
    btn.style.cssText = 'background:none;border:0;padding:10px;margin:0;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;border-radius:50%;';
    btn.style.color = corDoRaio();
    btn.addEventListener('click', (e) => {
      e.preventDefault(); e.stopPropagation();
      if (!logado.get()) { modalConta.set(true); return; }
      const jaAberta = gavetaAberta.get() && abaGaveta.get() === 'rapidas';
      abaGaveta.set('rapidas');
      gavetaAberta.set(!jaAberta);
    });
    mic.insertAdjacentElement('afterend', btn);
  };
  observarDom(garantir);
}

// ── Barra no cabeçalho da conversa: o WhatsApp remonta o header a cada troca ──
const headerSinal = (() => {
  let atual: HTMLElement | null = null;
  const fns = new Set<(v: HTMLElement | null) => void>();
  return {
    get: () => atual,
    set(v: HTMLElement | null) { atual = v; fns.forEach((f) => f(v)); },
    subscribe(f: (v: HTMLElement | null) => void) { fns.add(f); return () => { fns.delete(f); }; },
  };
})();

function montarHeader() {
  const ID = 'advox-headerbar';
  const garantir = () => {
    const existente = document.getElementById(ID);
    if (existente) return;
    const header = document.querySelector('#main header');
    if (!header) { if (headerSinal.get()) headerSinal.set(null); return; }
    const host = document.createElement('div');
    host.id = ID;
    host.style.cssText = 'display:flex;align-items:center;flex-shrink:0;';
    const ultimo = header.lastElementChild;
    if (ultimo && ultimo.parentElement === header) header.insertBefore(host, ultimo);
    else header.appendChild(host);
    const container = criarRaiz(host);
    container.style.cssText = 'display:flex;align-items:center;';
    headerSinal.set(container);
  };
  observarDom(garantir);
}

function observarDom(fn: () => void) {
  fn();
  let timer = 0;
  new MutationObserver(() => {
    if (timer) return;
    timer = window.setTimeout(() => { timer = 0; fn(); }, 400);
  }).observe(document.body, { childList: true, subtree: true });
}

function montar() {
  if (window.__advoxExt) return;
  window.__advoxExt = true;
  detectarTema();

  injetarEspaco();

  const hostTopo = document.createElement('div');
  hostTopo.id = 'advox-topbar';
  hostTopo.style.cssText = `position:fixed;top:0;left:0;right:0;height:${ALTURA_TOPBAR}px;z-index:2147483001;`;
  document.body.appendChild(hostTopo);
  const topbar = criarRaiz(hostTopo);

  const host = document.createElement('div');
  host.id = 'advox-extensao';
  host.style.cssText = 'position:fixed;inset:0;z-index:2147483000;pointer-events:none;';
  document.body.appendChild(host);
  const raiz = criarRaiz(host);
  raiz.style.cssText = 'position:fixed;inset:0;pointer-events:none;';

  montarHeader();
  montarBotaoCompose();
  createRoot(raiz).render(<App topbar={topbar} header={headerSinal} />);

  setInterval(detectarTema, 2000);
  console.info('[Advox] extensão do WhatsApp carregada (layout BuildChat).');
}

iniciarBridge();
if (document.body) montar();
else document.addEventListener('DOMContentLoaded', montar, { once: true });
