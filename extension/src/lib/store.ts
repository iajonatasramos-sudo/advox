// Mini-store de sinais (mesma ideia do BuildChat): o ⚡ do compose é DOM puro
// e precisa conversar com o React, então o estado de tela mora aqui.

type Listener<T> = (v: T) => void;

function criarSinal<T>(inicial: T) {
  let valor = inicial;
  const listeners = new Set<Listener<T>>();
  return {
    get: () => valor,
    set(v: T) {
      valor = v;
      listeners.forEach((fn) => fn(v));
    },
    subscribe(fn: Listener<T>) {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
  };
}

/** Pastas usadas como filtro da lista de conversas; vazio = Todas. Com várias, só quem está em TODAS. */
export const pastasAtivas = criarSinal<string[]>([]);
export function alternarPastaAtiva(id: string) {
  const atual = pastasAtivas.get();
  pastasAtivas.set(atual.includes(id) ? atual.filter((x) => x !== id) : [...atual, id]);
}

/** Tema do WhatsApp Web. */
export const tema = criarSinal<'light' | 'dark'>('light');

/** Gaveta lateral aberta e qual guia ela mostra. */
export const gavetaAberta = criarSinal<boolean>(false);
export const abaGaveta = criarSinal<'cliente' | 'rapidas'>('cliente');

/** Menu aberto a partir da barra do cabeçalho da conversa. */
export type MenuHeader = { tipo: 'pastas' | 'filtros'; x: number; y: number } | null;
export const menuHeader = criarSinal<MenuHeader>(null);

/** Modais. */
export const modalPastas = criarSinal<boolean>(false);
export const modalConta = criarSinal<boolean>(false);

/** Logado e pronto para usar (o ⚡ do compose consulta). */
export const logado = criarSinal<boolean>(false);

/** Minha Agenda em tela cheia (botão do calendário na barra do topo) e a guia aberta. */
export const modalAgenda = criarSinal<boolean>(false);
export const abaAgenda = criarSinal<'agenda' | 'notas' | 'etiquetas'>('agenda');
