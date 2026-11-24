import React, { useState, useEffect } from "react";
import { Ic } from "./icons";
import { Btn, Input, Field, Select } from "./ui";
import { createConvite, buildInviteUrl, rotuloPapel, rankPapel, type Papel } from "./lib/data-live";
import { supabase } from "./lib/supabase";
import { useAuth } from "./auth";

type Revenda = { id: string; nome: string; empresa_id: string };
type Pessoa = { id: string; nome: string; papel: Papel; empresa_id: string | null };

/** Funções que cada um pode convidar (sempre abaixo de si). */
function funcoesConvidaveis(papel: Papel | undefined): Papel[] {
  if (papel === "admin") return ["proprietario", "gerente", "coord", "rep", "advogado", "admin"];
  if (papel === "proprietario") return ["gerente", "coord", "rep"];
  if (papel === "gerente") return ["coord", "rep"];
  if (papel === "coord") return ["rep"];
  return [];
}

export function ConvidarModal({
  open, onClose, papelFixo, revendaIdFixa, superiorFixo, titulo,
}: {
  open: boolean;
  onClose: () => void;
  papelFixo?: Papel;              // função já definida (ex.: admin convidando advogado)
  revendaIdFixa?: string | null;  // revenda já definida
  superiorFixo?: string | null;   // já entra no time de alguém
  titulo?: string;
}) {
  const { profile } = useAuth();
  const meuPapel = profile?.papel as Papel | undefined;
  const opcoes = papelFixo ? [papelFixo] : funcoesConvidaveis(meuPapel);
  // Admin começa por Proprietário; gestores, pela função logo abaixo da base (Consultor).
  const padrao: Papel = papelFixo ?? (meuPapel === "admin" ? "proprietario" : opcoes[opcoes.length - 1] ?? "rep");
  const [email, setEmail] = useState("");
  const [papel, setPapel] = useState<Papel>(padrao);
  const [revendaId, setRevendaId] = useState<string>(revendaIdFixa ?? "");
  const [superiorId, setSuperiorId] = useState<string>(superiorFixo ?? "");
  const [revendas, setRevendas] = useState<Revenda[]>([]);
  const [pessoas, setPessoas] = useState<Pessoa[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);

  const comercial = rankPapel(papel) >= 1;
  const revendaTravada = !!revendaIdFixa || meuPapel === "coord";

  useEffect(() => {
    if (!open) return;
    setEmail(""); setErr(null); setInviteUrl(null);
    setPapel(padrao);
    setRevendaId(revendaIdFixa ?? (meuPapel === "coord" ? profile?.revenda_id ?? "" : ""));
    setSuperiorId(superiorFixo ?? "");
    let q = supabase.from("revendas").select("id, nome, empresa_id").eq("status", "ativo").order("nome");
    if (meuPapel !== "admin" && profile?.empresa_id) q = q.eq("empresa_id", profile.empresa_id);
    q.then(({ data }) => {
      const lista = (data ?? []) as unknown as Revenda[];
      setRevendas(lista);
      // Empresa com uma revenda só: já vem escolhida.
      if (!revendaIdFixa && meuPapel !== "coord" && lista.length === 1) setRevendaId(lista[0].id);
    });
    supabase.from("profiles").select("id, nome, papel, empresa_id").in("papel", ["coord", "gerente"]).eq("status", "ativo").order("nome")
      .then(({ data }) => setPessoas((data ?? []) as unknown as Pessoa[]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, papelFixo, revendaIdFixa, superiorFixo]);

  const empresaId = revendas.find(r => r.id === revendaId)?.empresa_id ?? profile?.empresa_id ?? null;

  // Quem pode ser o superior: consultor → coordenador; coordenador → gerente.
  const papelSuperior: Papel | null = papel === "rep" ? "coord" : papel === "coord" ? "gerente" : null;
  const superiores = pessoas.filter(p => p.papel === papelSuperior && (!empresaId || p.empresa_id === empresaId));
  // Coordenador convidando consultor (ou gerente convidando coordenador): entra no próprio time.
  const superiorAutomatico = papelSuperior && meuPapel === papelSuperior ? profile?.id ?? null : null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.id) return;
    if (comercial && !revendaId) { setErr("Escolha a revenda."); return; }
    setBusy(true); setErr(null);
    const { data, error } = await createConvite({
      email,
      papel,
      revenda_id: comercial ? revendaId : null,
      empresa_id: comercial ? empresaId : null,
      superior_id: superiorFixo ?? superiorAutomatico ?? (superiorId || null),
      invited_by: profile.id,
    });
    setBusy(false);
    if (error || !data) { setErr(error?.includes("row-level security") ? "Você não pode convidar alguém com essa função." : error ?? "Erro desconhecido."); return; }
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
            <div style={{ fontSize: 14, fontWeight: 600 }}>{titulo ?? "Convidar para a equipe"}</div>
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
            {opcoes.length > 1 && (
              <Field label="Função">
                <Select value={papel} onChange={e=>{ setPapel(e.target.value as Papel); setSuperiorId(""); }}
                  options={opcoes.map(p => ({ value: p, label: rotuloPapel(p) }))} />
              </Field>
            )}
            {comercial && !revendaTravada && (
              <Field label="Revenda" hint={papel === "proprietario" ? "O proprietário fica dono da empresa dessa revenda." : undefined}>
                <Select value={revendaId} onChange={e=>{ setRevendaId(e.target.value); setSuperiorId(""); }}
                  options={[{ value: "", label: "Escolha…" }, ...revendas.map(r => ({ value: r.id, label: r.nome }))]} />
              </Field>
            )}
            {papelSuperior && !superiorFixo && !superiorAutomatico && (
              <Field label={papel === "rep" ? "Time do coordenador" : "Time do gerente"}>
                <Select value={superiorId} onChange={e=>setSuperiorId(e.target.value)}
                  options={[{ value: "", label: "Sem time por enquanto" }, ...superiores.map(p => ({ value: p.id, label: p.nome }))]} />
              </Field>
            )}
            {superiorAutomatico && (
              <div style={{ fontSize: 12, color: "var(--ink-3)" }}>Vai entrar no seu time.</div>
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
              <span>Convite de <strong>{rotuloPapel(papel)}</strong> gerado para <strong>{email}</strong>. Expira em 7 dias.</span>
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
