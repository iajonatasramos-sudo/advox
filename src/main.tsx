import React from "react";
import ReactDOM from "react-dom/client";
import "./styles.css";
import { App } from "./App";
import { DataProvider } from "./store";
import { AuthProvider } from "./auth";
import { ErrorBoundary } from "./error-boundary";
import { supabase } from "./lib/supabase";
import { iniciarTema } from "./tema";

iniciarTema();

/**
 * Vínculo com a extensão AdvoxChat: o botão "Painel AdvoxChat" abre
 * `/?painel=advoxchat#advox_th=<token_hash>`. Trocamos o hash por uma sessão
 * própria do app (link mágico de uso único gerado pela Edge Function
 * painel-sessao) ANTES de montar a app, e tiramos o hash da URL na hora.
 */
async function sessaoDaExtensao() {
  const m = window.location.hash.match(/advox_th=([^&]+)/);
  if (!m) return;
  history.replaceState(null, "", window.location.pathname + window.location.search);
  const tokenHash = decodeURIComponent(m[1]);
  // Pode ser outro usuário: descarta o perfil em cache para não piscar o antigo.
  try { localStorage.removeItem("advox-profile-cache-v1"); } catch { /* ignore */ }
  const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "magiclink" });
  if (error) console.warn("[Advox] login vindo da extensão falhou:", error.message);
}

sessaoDaExtensao().finally(() => {
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <ErrorBoundary>
        <AuthProvider>
          <DataProvider>
            <App />
          </DataProvider>
        </AuthProvider>
      </ErrorBoundary>
    </React.StrictMode>
  );
});
