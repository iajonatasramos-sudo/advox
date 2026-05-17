import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Ic } from "./icons";
import { PIPELINE_COMERCIAL, type Stage, initials } from "./data";

export { useState, useEffect, useRef, useMemo, useCallback };

/* === Responsive hook === */
export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia(query).matches : false
  );
  useEffect(() => {
    const mq = window.matchMedia(query);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mq.addEventListener("change", handler);
    setMatches(mq.matches);
    return () => mq.removeEventListener("change", handler);
  }, [query]);
  return matches;
}
export const useIsMobile = () => useMediaQuery("(max-width: 768px)");

/* === Button === */
type BtnVariant = "default" | "primary" | "gold" | "ghost" | "soft" | "danger" | "link";
type BtnProps = {
  children?: React.ReactNode;
  variant?: BtnVariant;
  size?: "sm" | "md" | "lg";
  icon?: React.ReactNode;
  iconRight?: React.ReactNode;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
  className?: string;
  style?: React.CSSProperties;
  title?: string;
};
export function Btn({ children, variant = "default", size = "md", icon, iconRight, onClick, disabled, type, className = "", style, title }: BtnProps) {
  const base: React.CSSProperties = {
    display: "inline-flex", alignItems: "center", gap: 6,
    border: "1px solid transparent",
    fontWeight: 500, fontSize: size === "sm" ? 12 : 13, lineHeight: 1,
    padding: size === "sm" ? "6px 10px" : size === "lg" ? "10px 16px" : "8px 12px",
    borderRadius: 6,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.5 : 1,
    transition: "background 80ms ease, color 80ms ease, border-color 80ms ease, box-shadow 80ms ease",
    whiteSpace: "nowrap",
    userSelect: "none",
  };
  const variants: Record<BtnVariant, React.CSSProperties> = {
    default:  { background: "var(--surface)", color: "var(--ink)", border: "1px solid var(--line-2)", boxShadow: "var(--shadow-sm)" },
    primary:  { background: "var(--navy)", color: "var(--navy-ink)", border: "1px solid var(--navy-2)", boxShadow: "var(--shadow-sm)" },
    gold:     { background: "var(--gold)", color: "var(--gold-ink)", border: "1px solid var(--gold-2)", boxShadow: "var(--shadow-sm)" },
    ghost:    { background: "transparent", color: "var(--ink-2)", border: "1px solid transparent" },
    soft:     { background: "var(--surface-3)", color: "var(--ink-2)", border: "1px solid var(--line)" },
    danger:   { background: "var(--surface)", color: "var(--rose)", border: "1px solid oklch(0.85 0.05 25)" },
    link:     { background: "transparent", color: "var(--navy)", border: 0, padding: 0 },
  };
  return (
    <button type={type || "button"} onClick={onClick} disabled={disabled} className={className} title={title} style={{ ...base, ...variants[variant], ...style }}>
      {icon}<span>{children}</span>{iconRight}
    </button>
  );
}

/* === Badge === */
type BadgeProps = {
  children?: React.ReactNode;
  dotColor?: string;
  color?: string;
  bg?: string;
  border?: string;
  style?: React.CSSProperties;
};
export function Badge({ children, dotColor, color = "var(--ink-2)", bg = "var(--surface-3)", border = "var(--line)", style }: BadgeProps) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      fontSize: 11, fontWeight: 500, lineHeight: 1,
      padding: "3px 7px",
      color, background: bg,
      border: `1px solid ${border}`,
      borderRadius: 4,
      letterSpacing: "0.005em",
      ...style,
    }}>
      {dotColor && <span style={{ width: 6, height: 6, borderRadius: 99, background: dotColor, flexShrink: 0 }} />}
      {children}
    </span>
  );
}

/* === Status pill === */
type StatusPillProps = {
  stage: string;
  pipeline?: Stage[];
  size?: "sm" | "md";
};
export function StatusPill({ stage, pipeline = PIPELINE_COMERCIAL, size = "md" }: StatusPillProps) {
  const s = pipeline.find(p => p.id === stage);
  if (!s) return null;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      fontSize: size === "sm" ? 11 : 12, fontWeight: 500,
      padding: size === "sm" ? "3px 7px" : "4px 9px",
      color: "var(--ink)",
      background: "var(--surface)",
      border: "1px solid var(--line-2)",
      borderRadius: 4,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: 99, background: s.color }} />
      {s.label}
    </span>
  );
}

/* === Avatar === */
type AvatarProps = {
  name?: string;
  size?: number;
  src?: string;
  color?: string;
};
export function Avatar({ name = "?", size = 28, src, color }: AvatarProps) {
  const ini = initials(name);
  const hash = name.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const hue = (hash * 17) % 360;
  const bg = color || `oklch(0.92 0.04 ${hue})`;
  const fg = `oklch(0.32 0.06 ${hue})`;
  return (
    <span style={{
      width: size, height: size,
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      background: src ? `url(${src}) center/cover` : bg,
      color: fg,
      fontSize: size * 0.4,
      fontWeight: 600,
      borderRadius: size > 32 ? 8 : 6,
      flexShrink: 0,
      letterSpacing: "-0.02em",
    }}>
      {!src && ini}
    </span>
  );
}

/* === KPI === */
type KPIProps = {
  label: string;
  valor: string;
  delta?: string;
  trend?: "up" | "down" | "neutral";
  icon?: React.ReactNode;
};
export function KPI({ label, valor, delta, trend, icon }: KPIProps) {
  const trendColor = trend === "up" ? "var(--green)" : trend === "down" ? "var(--rose)" : "var(--ink-3)";
  return (
    <div style={{
      background: "var(--surface)",
      border: "1px solid var(--line)",
      borderRadius: 6,
      padding: "14px 16px",
      display: "flex", flexDirection: "column", gap: 8,
      minHeight: 92,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 11.5, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 500 }}>{label}</span>
        {icon && <span style={{ color: "var(--ink-4)" }}>{icon}</span>}
      </div>
      <div style={{ fontSize: 26, fontWeight: 600, letterSpacing: "-0.02em", color: "var(--ink)" }}>{valor}</div>
      {delta && (
        <div style={{ fontSize: 11.5, color: trendColor, display: "inline-flex", alignItems: "center", gap: 4 }}>
          {trend === "up" && <Ic.ArrowUp size={11} />}
          {trend === "down" && <Ic.ArrowDown size={11} />}
          {delta}
        </div>
      )}
    </div>
  );
}

/* === Input === */
type InputProps = {
  value: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  icon?: React.ReactNode;
  type?: string;
  size?: "sm" | "md";
  style?: React.CSSProperties;
  full?: boolean;
  autoFocus?: boolean;
};
export function Input({ value, onChange, placeholder, icon, type = "text", size = "md", style, full, autoFocus }: InputProps) {
  return (
    <div className="ring-focus" style={{
      display: "inline-flex", alignItems: "center", gap: 7,
      padding: size === "sm" ? "5px 9px" : "7px 10px",
      border: "1px solid var(--line-2)",
      background: "var(--surface)",
      borderRadius: 5,
      minWidth: full ? "100%" : 240,
      width: full ? "100%" : undefined,
      ...style,
    }}>
      {icon && <span style={{ color: "var(--ink-4)", flexShrink: 0 }}>{icon}</span>}
      <input
        autoFocus={autoFocus}
        type={type}
        value={value} onChange={onChange}
        placeholder={placeholder}
        style={{
          border: 0, outline: 0, background: "transparent",
          fontSize: size === "sm" ? 12 : 13,
          color: "var(--ink)", width: "100%",
          padding: 0,
        }}
      />
    </div>
  );
}

/* === Operadora tag === */
export const OPERADORA_COLORS: Record<string, string> = {
  Vivo: "oklch(0.4 0.15 290)",
  TIM:  "oklch(0.45 0.15 250)",
  Claro:"oklch(0.55 0.16 25)",
  Oi:   "oklch(0.6 0.14 60)",
};
export function OperadoraTag({ op, size = "sm" }: { op: string; size?: "sm" | "md" }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      fontSize: size === "sm" ? 11 : 12,
      fontWeight: 600,
      letterSpacing: "0.01em",
      padding: size === "sm" ? "2px 6px" : "3px 8px",
      color: OPERADORA_COLORS[op] || "var(--ink-2)",
      background: "var(--surface-3)",
      border: "1px solid var(--line)",
      borderRadius: 4,
    }}>{op}</span>
  );
}

/* === Section === */
type SectionProps = {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  right?: React.ReactNode;
  children: React.ReactNode;
  dense?: boolean;
  noPad?: boolean;
};
export function Section({ title, subtitle, right, children, dense, noPad }: SectionProps) {
  return (
    <section style={{
      background: "var(--surface)", border: "1px solid var(--line)",
      borderRadius: 6, overflow: "hidden",
    }}>
      {title && (
        <header style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: dense ? "10px 14px" : "12px 16px",
          borderBottom: "1px solid var(--line)",
          background: "var(--surface-2)",
        }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{title}</h3>
            {subtitle && <div style={{ fontSize: 11.5, color: "var(--ink-3)", marginTop: 2 }}>{subtitle}</div>}
          </div>
          {right}
        </header>
      )}
      <div style={{ padding: noPad ? 0 : (dense ? "10px 14px" : "14px 16px") }}>
        {children}
      </div>
    </section>
  );
}

/* === Desbloquear topbar === */
export function DesbloquearTopbar({ onOpen }: { onOpen: () => void }) {
  return (
    <div className="desbloq-bar" style={{
      display: "flex", alignItems: "center", gap: 10,
      background: "linear-gradient(180deg, oklch(0.30 0.06 255), oklch(0.24 0.07 255))",
      color: "var(--navy-ink)",
      padding: "10px 18px",
      borderBottom: "1px solid oklch(0.20 0.06 255)",
    }}>
      <div className="desbloq-msg" style={{ display: "flex", alignItems: "center", gap: 8, paddingRight: 14, borderRight: "1px solid oklch(0.40 0.05 255)", flexShrink: 0 }}>
        <span style={{
          width: 22, height: 22, borderRadius: 4,
          background: "var(--gold)", color: "var(--gold-ink)",
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}>
          <Ic.Unlock size={13} />
        </span>
        <span style={{ fontSize: 12.5, fontWeight: 500, color: "oklch(0.92 0.02 240)", whiteSpace: "nowrap" }}>
          Cliente preso em contrato abusivo? Indique agora.
        </span>
      </div>
      <button onClick={onOpen} className="desbloq-btn" style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
        background: "var(--gold)", color: "var(--gold-ink)",
        border: "1px solid var(--gold-2)",
        padding: "7px 14px",
        borderRadius: 5,
        fontWeight: 600, fontSize: 12.5,
        letterSpacing: "0.04em", textTransform: "uppercase",
        cursor: "pointer",
        whiteSpace: "nowrap",
        boxShadow: "0 1px 0 var(--gold-2), 0 6px 14px -6px var(--gold-2)",
      }}>
        <Ic.Unlock size={14} /> Desbloquear Cliente
      </button>
      <div className="desbloq-fineprint" style={{ marginLeft: "auto", fontSize: 11.5, color: "oklch(0.78 0.03 250)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        Honorários pagos pelo cliente final · Você usa o sistema 100% grátis
      </div>
    </div>
  );
}

/* === Empty === */
type EmptyProps = {
  icon: React.ReactNode;
  title: string;
  hint?: string;
  action?: React.ReactNode;
};
export function Empty({ icon, title, hint, action }: EmptyProps) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      padding: "44px 16px",
      textAlign: "center",
      color: "var(--ink-3)",
    }}>
      <div style={{
        width: 44, height: 44, borderRadius: 99,
        background: "var(--surface-3)", border: "1px solid var(--line)",
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        color: "var(--ink-3)", marginBottom: 12,
      }}>{icon}</div>
      <div style={{ fontSize: 14, fontWeight: 500, color: "var(--ink)", marginBottom: 4 }}>{title}</div>
      {hint && <div style={{ fontSize: 12.5, color: "var(--ink-3)", maxWidth: 340 }}>{hint}</div>}
      {action && <div style={{ marginTop: 14 }}>{action}</div>}
    </div>
  );
}

/* === Tabs === */
type Tab = {
  id: string;
  label: string;
  icon?: React.ReactNode;
  count?: number;
};
export function Tabs({ tabs, active, onChange }: { tabs: Tab[]; active: string; onChange: (id: string) => void }) {
  return (
    <div className="tabs-row" style={{
      display: "flex", gap: 0,
      borderBottom: "1px solid var(--line)",
      overflowX: "auto",
      WebkitOverflowScrolling: "touch",
      scrollbarWidth: "none",
    }}>
      {tabs.map(t => (
        <button key={t.id} onClick={() => onChange(t.id)} style={{
          background: "transparent", border: 0,
          padding: "10px 14px",
          fontSize: 13, fontWeight: 500,
          color: active === t.id ? "var(--ink)" : "var(--ink-3)",
          borderBottom: active === t.id ? "2px solid var(--navy)" : "2px solid transparent",
          cursor: "pointer",
          marginBottom: -1,
          display: "inline-flex", alignItems: "center", gap: 6,
          whiteSpace: "nowrap",
          flexShrink: 0,
        }}>
          {t.icon}{t.label}
          {t.count != null && (
            <span style={{
              fontSize: 11, color: "var(--ink-4)",
              background: "var(--surface-3)", border: "1px solid var(--line)",
              padding: "1px 6px", borderRadius: 4, marginLeft: 2,
            }}>{t.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}

/* === MiniBars === */
type MiniBar = { k: string; v: number };
export function MiniBars({ data, color = "var(--navy)", height = 60 }: { data: MiniBar[]; color?: string; height?: number }) {
  const max = Math.max(...data.map(d => d.v), 1);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height }}>
      {data.map((d, i) => (
        <div key={i} style={{
          flex: 1,
          height: `${(d.v / max) * 100}%`,
          background: color,
          borderRadius: "2px 2px 0 0",
          minHeight: 2,
          opacity: 0.85,
        }} title={`${d.k}: ${d.v}`} />
      ))}
    </div>
  );
}

/* === BrazilHeatmap === */
export function BrazilHeatmap({ data }: { data: [string, number][] }) {
  const grid: Record<string, [number, number]> = {
    RR: [0,3], AP: [0,5],
    AC: [1,1], AM: [1,2], PA: [1,4], MA: [1,5], PI: [1,6], CE: [1,7], RN: [1,8],
    RO: [2,2], MT: [2,3], TO: [2,4], BA: [2,6], PB: [2,8], PE: [2,7],
    MS: [3,3], GO: [3,4], DF: [3,5], MG: [3,6], ES: [3,7], AL: [2,9], SE: [3,8],
    PR: [4,4], SP: [4,5], RJ: [4,6],
    RS: [5,4], SC: [5,5],
  };
  const map = Object.fromEntries(data);
  const max = Math.max(...data.map(d => d[1]), 1);
  return (
    <div style={{ display: "grid", gridTemplateRows: "repeat(6, 30px)", gridTemplateColumns: "repeat(10, 30px)", gap: 4 }}>
      {Object.entries(grid).map(([uf, [r, c]]) => {
        const v = (map as any)[uf] || 0;
        const intensity = v / max;
        const bg = v === 0 ? "var(--surface-3)" : `oklch(${0.95 - intensity * 0.55} ${0.04 + intensity * 0.08} 255)`;
        const fg = intensity > 0.5 ? "var(--navy-ink)" : "var(--ink-2)";
        return (
          <div key={uf} style={{
            gridRow: r + 1, gridColumn: c + 1,
            background: bg,
            border: "1px solid var(--line)",
            borderRadius: 3,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 9, fontWeight: 600, color: fg,
            cursor: "default",
          }} title={`${uf}: ${v} casos`}>
            {uf}
          </div>
        );
      })}
    </div>
  );
}

/* === KV (key-value row) === */
export function KV({ k, v, mono }: { k: React.ReactNode; v: React.ReactNode; mono?: boolean }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "100px 1fr", gap: 8, fontSize: 12.5, alignItems: "baseline" }}>
      <span style={{ color: "var(--ink-3)" }}>{k}</span>
      <span className={mono ? "mono" : ""} style={{ color: "var(--ink)", fontWeight: mono ? 500 : 400, wordBreak: "break-word" }}>{v}</span>
    </div>
  );
}

/* === Sidebar block === */
export function SidebarBlock({ title, children }: { title: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--line)" }}>
      <div style={{ fontSize: 11, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 500, marginBottom: 8 }}>{title}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>{children}</div>
    </div>
  );
}

/* === Field + Select === */
export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <span style={{ fontSize: 11.5, color: "var(--ink-2)", fontWeight: 500 }}>{label}</span>
      {children}
      {hint && <span style={{ fontSize: 11, color: "var(--ink-4)" }}>{hint}</span>}
    </label>
  );
}

export function Select({ value, onChange, options }: { value: string; onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void; options: string[] }) {
  return (
    <div style={{ position: "relative" }}>
      <select value={value} onChange={onChange} style={{
        width: "100%",
        padding: "7px 28px 7px 10px",
        border: "1px solid var(--line-2)",
        borderRadius: 5,
        background: "var(--surface)",
        fontSize: 13, color: "var(--ink)",
        appearance: "none",
        cursor: "pointer",
      }}>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
      <span style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "var(--ink-4)" }}>
        <Ic.ChevronDown size={14} />
      </span>
    </div>
  );
}
