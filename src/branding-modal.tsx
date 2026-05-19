import React, { useState, useRef } from "react";
import { Ic } from "./icons";
import { Btn, Field } from "./ui";
import { supabase } from "./lib/supabase";

type Props = {
  revendaId: string;
  revendaNome: string;
  logoUrl: string | null;
  corPrimaria: string | null;
  onClose: () => void;
  onSaved?: () => void;
};

export function BrandingModal({ revendaId, revendaNome, logoUrl, corPrimaria, onClose, onSaved }: Props) {
  const [cor, setCor] = useState<string>(corPrimaria || "#1e3a8a");
  const [logoPreview, setLogoPreview] = useState<string | null>(logoUrl);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const pickFile = (f: File | null) => {
    if (!f) return;
    if (!/^image\/(png|jpe?g|svg\+xml|webp)$/i.test(f.type)) {
      setErr("Use uma imagem PNG, JPG, SVG ou WEBP.");
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      setErr("Imagem precisa ter no máximo 10 MB.");
      return;
    }
    setErr(null);
    setFile(f);
    setLogoPreview(URL.createObjectURL(f));
  };

  const removerLogo = async () => {
    setLogoPreview(null);
    setFile(null);
  };

  const salvar = async () => {
    setBusy(true);
    setErr(null);
    let nextLogoUrl: string | null = logoUrl;

    if (file) {
      const ext = file.name.split(".").pop() || "png";
      const path = `${revendaId}/logo-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("revenda-logos")
        .upload(path, file, { upsert: true, cacheControl: "3600" });
      if (upErr) { setBusy(false); setErr(`Falha no upload: ${upErr.message}`); return; }
      const { data: pub } = supabase.storage.from("revenda-logos").getPublicUrl(path);
      nextLogoUrl = pub.publicUrl;
    } else if (logoPreview === null && logoUrl) {
      // removeu a logo
      nextLogoUrl = null;
    }

    const { error } = await supabase
      .from("revendas")
      .update({ logo_url: nextLogoUrl, cor_primaria: cor } as never)
      .eq("id", revendaId);

    setBusy(false);
    if (error) { setErr(`Falha ao salvar: ${error.message}`); return; }
    onSaved?.();
    onClose();
  };

  return (
    <div onClick={onClose} className="modal-backdrop" style={{
      position: "fixed", inset: 0, zIndex: 100,
      background: "oklch(0.10 0.04 250 / 0.45)", backdropFilter: "blur(2px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: "100%", maxWidth: 520,
        background: "var(--surface)", border: "1px solid var(--line-2)", borderRadius: 8,
        boxShadow: "var(--shadow-lg)", padding: 22,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
          <span style={{
            width: 32, height: 32, borderRadius: 5,
            background: cor, color: "white",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
          }}><Ic.Building size={15} /></span>
          <div>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Branding da revenda</h2>
            <div style={{ fontSize: 12, color: "var(--ink-3)" }}>{revendaNome}</div>
          </div>
        </div>

        {err && (
          <div style={{ background: "var(--rose-soft)", border: "1px solid var(--rose-border)", color: "var(--rose)", padding: "8px 12px", borderRadius: 5, fontSize: 12.5, marginBottom: 14 }}>
            {err}
          </div>
        )}

        <Field label="Logo da revenda" hint="PNG, JPG, SVG ou WEBP, máximo 10 MB. Recomendado fundo transparente.">
          <div style={{
            display: "flex", alignItems: "center", gap: 12,
            padding: 12, background: "var(--surface-2)",
            border: "1px dashed var(--line-2)", borderRadius: 6,
          }}>
            <div style={{
              width: 88, height: 56, borderRadius: 5,
              background: "var(--surface)", border: "1px solid var(--line)",
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0, overflow: "hidden",
            }}>
              {logoPreview ? (
                <img src={logoPreview} alt="" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
              ) : (
                <span style={{ fontSize: 10.5, color: "var(--ink-4)" }}>Sem logo</span>
              )}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
              <input
                ref={inputRef}
                type="file"
                accept="image/png,image/jpeg,image/svg+xml,image/webp"
                style={{ display: "none" }}
                onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
              />
              <Btn variant="default" size="sm" icon={<Ic.Upload size={12} />} onClick={() => inputRef.current?.click()}>
                {logoPreview ? "Trocar logo" : "Enviar logo"}
              </Btn>
              {logoPreview && (
                <Btn variant="ghost" size="sm" icon={<Ic.X size={12} />} onClick={removerLogo}>Remover</Btn>
              )}
            </div>
          </div>
        </Field>

        <div style={{ marginTop: 14 }}>
          <Field label="Cor primária" hint="Usada como destaque do tema para usuários desta revenda.">
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <input
                type="color"
                value={cor}
                onChange={(e) => setCor(e.target.value)}
                style={{ width: 46, height: 36, border: "1px solid var(--line-2)", borderRadius: 5, cursor: "pointer", padding: 0, background: "transparent" }}
              />
              <input
                type="text"
                value={cor}
                onChange={(e) => setCor(e.target.value)}
                placeholder="#1e3a8a"
                style={{
                  padding: "8px 10px", border: "1px solid var(--line-2)", borderRadius: 5,
                  fontSize: 13, fontFamily: "JetBrains Mono, monospace",
                  width: 110, color: "var(--ink)", background: "var(--surface)",
                }}
              />
              <div style={{ flex: 1, height: 36, borderRadius: 5, background: cor, border: "1px solid var(--line-2)" }} />
            </div>
          </Field>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 22, paddingTop: 14, borderTop: "1px solid var(--line)" }}>
          <Btn variant="ghost" onClick={onClose} disabled={busy}>Cancelar</Btn>
          <Btn variant="primary" onClick={salvar} disabled={busy}>{busy ? "Salvando…" : "Salvar"}</Btn>
        </div>
      </div>
    </div>
  );
}
