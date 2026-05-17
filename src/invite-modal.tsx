import React, { useState, useEffect } from "react";
import { Ic } from "./icons";
import { Btn, Input, Field, Select } from "./ui";
import { createConvite, buildInviteUrl, type Papel } from "./lib/data-live";
import { supabase } from "./lib/supabase";
import { useAuth } from "./auth";

type Revenda = { id: string; nome: string };

export function ConvidarModal({
  open, onClose, papelFixo, revendaIdFixa, titulo,
}: {
  open: boolean;
  onClose: () => void;
  papelFixo?: Papel;       // se definido, o papel é fixo (ex: Coord convida só Rep)
  revendaIdFixa?: string | null;  // se definida, a revenda é fixa
  titulo?: string;
}) {
  const { profile } = useAuth();
  const [email, setEmail] = useState("");
  const [papel, setPapel] = useState<Papel>(papelFixo ?? "rep");
  const [revendaId, setRevendaId] = useState<string>(revendaIdFixa ?? "");
  const [revendas, setRevendas] = useState<Revenda[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setEmail(""); setErr(null); setInviteUrl(null);
    setPapel(papelFixo ?? "rep");
    setRevendaId(revendaIdFixa ?? "");
    // carrega revendas se não estiver fixa
    if (!revendaIdFixa) {
      supabase.from("revendas").select("id, nome").eq("status", "ativo").order("nome").then(({ data }) => {
        setRevendas((data ?? []) as unknown as Revenda[]);
      });
    }
  }, [open, papelFixo, revendaIdFixa]);

  const precisaRevenda = papel === "rep" || papel === "coord";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.id) return;
    if (precisaRevenda && !revendaId) { setErr("Selecione uma revenda."); return; }
    setBusy(true); setErr(null);
    const { data, error } = await createConvite({
      email,
      papel,
      revenda_id: precisaRevenda ? revendaId : null,
      invited_by: profile.id,
    });
    setBusy(false);
    if (error || !data) { setErr(error ?? "Erro desconhecido."); return; }
    setInviteUrl(buildInviteUrl(data.token));
  };

  const copy = async () => {
    if (!inviteUrl) return;
    try { await navigator.clipboard.writeText(inviteUrl); }
    catch { /* fallback */ }
  };

  if (!open) return null;

  return (
    <div onClick={onClose} className="modal-backdrop" style={{
      position: "fixed", inset: 0, zIndex: 100,
      background: "oklch(0.10 0.04 250 / 0.45)", backdropFilter: "blur(2px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
    }}>
      <div onClick={e=>e.stopPropagation()} className="modal-shell fade-up" style={{
        width: 520, maxWidth: "100%",
        background: "var(--surface)", border: "1px solid var(--line-2)",
        borderRadius: 8, boxShadow: "var(--shadow-lg)",
        display: "flex", flexDirection: "column", overflow: "hidden",
      }}>
        <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ width: 28, height: 28, borderRadius: 5, background: "var(--navy)", color: "var(--navy-ink)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
            <Ic.Mail size={15} />
          </span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{titulo ?? "Enviar convite"}</div>
            <div style={{ fontSize: 11.5, color: "var(--ink-3)" }}>
              {inviteUrl ? "Convite criado. Compartilhe o link abaixo." : "Gera um link de convite seguro."}
            </div>
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: 0, color: "var(--ink-3)", cursor: "pointer", padding: 6 }}>
            <Ic.X size={16} />
          </button>
        </div>

        {!inviteUrl ? (
          <form onSubmit={submit} style={{ padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
            {err && <div style={{ background: "var(--rose-soft)", border: "1px solid var(--rose-border)", color: "var(--rose)", padding: "9px 12px", borderRadius: 5, fontSize: 12.5 }}>{err}</div>}
            <Field label="Email do convidado">
              <Input full type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="pessoa@empresa.com" autoFocus />
            </Field>
            {!papelFixo && (
              <Field label="Papel">
                <Select value={papel} onChange={e=>setPapel(e.target.value as Papel)} options={["rep","coord","advogado","admin"]} />
              </Field>
            )}
            {precisaRevenda && !revendaIdFixa && (
              <Field label="Revenda">
                <Select value={revendaId} onChange={e=>setRevendaId(e.target.value)} options={["", ...revendas.map(r => r.id)]} />
              </Field>
            )}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 6 }}>
              <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
              <Btn variant="primary" type="submit" disabled={busy || !email}>{busy ? "Gerando…" : "Gerar convite"}</Btn>
            </div>
          </form>
        ) : (
          <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{
              background: "var(--green-soft)", border: "1px solid oklch(0.85 0.06 145)",
              color: "var(--green)", padding: "10px 14px", borderRadius: 5, fontSize: 12.5,
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <Ic.CheckCircle size={14} />
              <span>Convite gerado para <strong>{email}</strong>. Expira em 7 dias.</span>
            </div>

            <Field label="Link do convite" hint="Envie por email, WhatsApp ou qualquer canal — quem abrir cria a conta automaticamente.">
              <div style={{ display: "flex", gap: 6 }}>
                <Input full value={inviteUrl} onChange={()=>{}} />
                <Btn variant="primary" onClick={copy} icon={<Ic.Doc size={12} />}>Copiar</Btn>
              </div>
            </Field>

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <Btn variant="primary" onClick={onClose}>OK</Btn>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
