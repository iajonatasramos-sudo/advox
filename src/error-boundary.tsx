import React from "react";

type Props = { children: React.ReactNode };
type State = { error: Error | null; info: React.ErrorInfo | null };

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null, info: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[Advox] ErrorBoundary capturou:", error, info);
    this.setState({ info });
  }

  reset = () => {
    this.setState({ error: null, info: null });
  };

  hardReset = () => {
    try {
      localStorage.clear();
    } catch { /* ignore */ }
    location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div style={{
        minHeight: "100vh",
        padding: "32px 20px",
        background: "oklch(0.985 0.003 240)",
        fontFamily: "ui-sans-serif, system-ui, sans-serif",
        color: "oklch(0.20 0.02 250)",
        overflow: "auto",
      }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <h1 style={{ fontSize: 22, marginBottom: 10, color: "oklch(0.45 0.18 25)" }}>
            Algo quebrou no render
          </h1>
          <p style={{ fontSize: 13.5, color: "oklch(0.40 0.02 250)", marginBottom: 16, lineHeight: 1.5 }}>
            Um erro estourou enquanto a interface era construída. O conteúdo abaixo é diagnóstico — copia e cola pro Claude se ele estiver te ajudando.
          </p>

          <div style={{
            background: "oklch(0.98 0.01 25)",
            border: "1px solid oklch(0.88 0.08 25)",
            borderRadius: 6,
            padding: "12px 14px",
            marginBottom: 14,
            fontSize: 13,
          }}>
            <strong style={{ color: "oklch(0.40 0.18 25)" }}>{this.state.error.name}:</strong>{" "}
            <span>{this.state.error.message}</span>
          </div>

          {this.state.error.stack && (
            <details open style={{ marginBottom: 14 }}>
              <summary style={{ cursor: "pointer", fontSize: 12.5, fontWeight: 600, marginBottom: 6 }}>Stack trace</summary>
              <pre style={{
                background: "oklch(0.20 0.02 250)",
                color: "oklch(0.92 0.02 240)",
                padding: 14,
                borderRadius: 6,
                fontSize: 11.5,
                lineHeight: 1.5,
                overflow: "auto",
                maxHeight: 320,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}>{this.state.error.stack}</pre>
            </details>
          )}

          {this.state.info?.componentStack && (
            <details style={{ marginBottom: 16 }}>
              <summary style={{ cursor: "pointer", fontSize: 12.5, fontWeight: 600, marginBottom: 6 }}>Component stack</summary>
              <pre style={{
                background: "oklch(0.96 0.01 250)",
                color: "oklch(0.30 0.02 250)",
                padding: 12,
                borderRadius: 6,
                fontSize: 11.5,
                lineHeight: 1.5,
                overflow: "auto",
                maxHeight: 240,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}>{this.state.info.componentStack}</pre>
            </details>
          )}

          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={this.reset} style={{
              padding: "8px 14px",
              background: "oklch(0.30 0.08 255)",
              color: "white",
              border: 0, borderRadius: 5,
              fontSize: 13, fontWeight: 500, cursor: "pointer",
            }}>Tentar de novo</button>
            <button onClick={this.hardReset} style={{
              padding: "8px 14px",
              background: "white",
              color: "oklch(0.30 0.02 250)",
              border: "1px solid oklch(0.85 0.01 250)",
              borderRadius: 5,
              fontSize: 13, fontWeight: 500, cursor: "pointer",
            }}>Limpar sessão e recarregar</button>
          </div>
        </div>
      </div>
    );
  }
}
