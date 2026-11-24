// Aparência do sistema: White (padrão), Grey (cinza-grafite, estilo Claude /
// ChatGPT), Dark (escuro) ou "seguir o sistema" (claro/escuro do computador).
// A escolha fica neste navegador (localStorage) e vale para todas as contas nele.
import { useEffect, useState } from "react";
import { Ic } from "./icons";
import { Section } from "./ui";

export type Tema = "white" | "grey" | "dark";
export type PreferenciaTema = Tema | "sistema";

const CHAVE = "advox-tema";
const escuroNoSistema = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches;

export function lerPreferencia(): PreferenciaTema {
  try {
    const v = localStorage.getItem(CHAVE);
    if (v === "white" || v === "grey" || v === "dark" || v === "sistema") return v;
  } catch { /* ignore */ }
  return "white";
}

/** Tema que vale agora (resolve "sistema"). */
export function temaEfetivo(p: PreferenciaTema = lerPreferencia()): Tema {
  if (p === "sistema") return escuroNoSistema() ? "dark" : "white";
  return p;
}

function aplicar(p: PreferenciaTema) {
  const t = temaEfetivo(p);
  const html = document.documentElement;
  if (t === "white") html.removeAttribute("data-tema");
  else html.setAttribute("data-tema", t);
}

/** Chamar uma vez antes de montar o app (evita piscar o tema claro). */
export function iniciarTema() {
  aplicar(lerPreferencia());
  window.matchMedia?.("(prefers-color-scheme: dark)").addEventListener?.("change", () => {
    if (lerPreferencia() === "sistema") aplicar("sistema");
  });
}

export function usePreferenciaTema() {
  const [pref, setPref] = useState<PreferenciaTema>(lerPreferencia);
  useEffect(() => { aplicar(pref); }, [pref]);
  const mudar = (p: PreferenciaTema) => {
    try { localStorage.setItem(CHAVE, p); } catch { /* ignore */ }
    setPref(p);
  };
  return [pref, mudar] as const;
}

/* Miniatura de cada tema (cores fixas de propósito: é a amostra). */
const AMOSTRA: Record<Tema, { bg: string; lateral: string; cartao: string; linha: string; texto: string }> = {
  white: { bg: "#f4f6f9", lateral: "#ffffff", cartao: "#ffffff", linha: "#e3e7ee", texto: "#c9d0db" },
  grey:  { bg: "#212121", lateral: "#171717", cartao: "#2f2f2f", linha: "#3a3a3a", texto: "#5a5a5a" },
  dark:  { bg: "#0d1117", lateral: "#0a0d12", cartao: "#161b22", linha: "#262c36", texto: "#3b4452" },
};

function Miniatura({ tema, metade }: { tema: Tema; metade?: Tema }) {
  const a = AMOSTRA[tema];
  const desenho = (c: typeof a) => (
    <div style={{ display: "flex", height: "100%", background: c.bg }}>
      <div style={{ width: "26%", background: c.lateral, borderRight: `1px solid ${c.linha}`, padding: 6, display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={{ height: 4, width: "80%", borderRadius: 2, background: c.texto }} />
        <span style={{ height: 4, width: "60%", borderRadius: 2, background: c.texto }} />
        <span style={{ height: 4, width: "70%", borderRadius: 2, background: "var(--navy)" }} />
      </div>
      <div style={{ flex: 1, padding: 7, display: "flex", flexDirection: "column", gap: 5 }}>
        <span style={{ height: 5, width: "45%", borderRadius: 2, background: c.texto }} />
        <div style={{ flex: 1, borderRadius: 4, background: c.cartao, border: `1px solid ${c.linha}` }} />
      </div>
    </div>
  );
  return (
    <div style={{ position: "relative", height: 74, borderRadius: 6, overflow: "hidden", border: "1px solid var(--line)" }}>
      {desenho(a)}
      {metade && <div style={{ position: "absolute", inset: 0, clipPath: "polygon(55% 0, 100% 0, 100% 100%, 45% 100%)" }}>{desenho(AMOSTRA[metade])}</div>}
    </div>
  );
}

const OPCOES: { id: PreferenciaTema; nome: string; texto: string }[] = [
  { id: "sistema", nome: "Seguir o sistema", texto: "Usa o claro ou escuro do seu computador." },
  { id: "white", nome: "White", texto: "Claro, o visual padrão do Advox." },
  { id: "grey", nome: "Grey", texto: "Cinza-grafite, no estilo Claude e ChatGPT." },
  { id: "dark", nome: "Dark", texto: "Escuro, para ambientes com pouca luz." },
];

/** Bloco "Aparência" usado em Meu perfil e nas Configurações do admin. */
export function AparenciaSection() {
  const [pref, mudar] = usePreferenciaTema();
  const [, forcar] = useState(0);
  // Se o sistema trocar de claro/escuro, atualiza o texto "agora: …".
  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    const f = () => forcar(n => n + 1);
    mq?.addEventListener?.("change", f);
    return () => mq?.removeEventListener?.("change", f);
  }, []);

  return (
    <Section title="Aparência" subtitle="Cores do sistema neste navegador">
      <div className="grid-tema" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12 }}>
        {OPCOES.map(o => {
          const ativo = pref === o.id;
          return (
            <button key={o.id} type="button" onClick={() => mudar(o.id)} style={{
              display: "flex", flexDirection: "column", gap: 8, padding: 10, textAlign: "left",
              background: "var(--surface)", color: "var(--ink)", cursor: "pointer",
              border: ativo ? "2px solid var(--navy)" : "1px solid var(--line)",
              margin: ativo ? 0 : 1, borderRadius: 10, font: "inherit",
            }}>
              {o.id === "sistema" ? <Miniatura tema="white" metade="dark" /> : <Miniatura tema={o.id} />}
              <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600 }}>
                {o.nome}
                {ativo && <span style={{ marginLeft: "auto", color: "var(--navy)", display: "inline-flex" }}><Ic.CheckCircle size={14} /></span>}
              </span>
              <span style={{ fontSize: 11.5, color: "var(--ink-3)", lineHeight: 1.4 }}>
                {o.texto}
                {o.id === "sistema" && ativo && <> Agora: <strong>{temaEfetivo("sistema") === "dark" ? "Dark" : "White"}</strong>.</>}
              </span>
            </button>
          );
        })}
      </div>
    </Section>
  );
}
