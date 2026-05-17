import React, { useState, useEffect } from "react";
import { Ic } from "./icons";
import { Btn, Avatar, Input, StatusPill, OperadoraTag, Field, Select } from "./ui";
import { OPERADORAS_LIST, useLiveLeads, createLead, createCaso, fmtBRL, PIPELINE_COMERCIAL_DB } from "./lib/data-live";
import { useAuth } from "./auth";
import { supabase } from "./lib/supabase";
import type { Operadora } from "./lib/database.types";

type ModalData = {
  novo: boolean | null;
  leadId: string | null;
  nome: string;
  whats: string;
  doc: string;
  empresa: string;
  uf: string;
  operadora: Operadora;
  tipo: string;
  valor: string;
  desc: string;
  autorizado: boolean;
};

const cardChoice: React.CSSProperties = {
  display: "flex", flexDirection: "column", alignItems: "flex-start", textAlign: "left",
  padding: "16px 14px",
  background: "var(--surface)", border: "1px solid var(--line-2)",
  borderRadius: 6, cursor: "pointer",
  color: "var(--ink-2)",
  transition: "border-color 80ms ease",
};

function SummaryRow({ label, value, last }: { label: string; value: React.ReactNode; last?: boolean }) {
  return (
    <div style={{
      display: "grid", gridTemplateColumns: "160px 1fr",
      padding: "10px 14px",
      borderBottom: last ? 0 : "1px solid var(--line)",
      fontSize: 12.5,
    }}>
      <div style={{ color: "var(--ink-3)" }}>{label}</div>
      <div style={{ color: "var(--ink)", fontWeight: 500 }}>{value}</div>
    </div>
  );
}

export function ModalDesbloquear({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { profile } = useAuth();
  const { leads } = useLiveLeads({ repId: profile?.id });
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [casoIdCriado, setCasoIdCriado] = useState<string | null>(null);
  const [data, setData] = useState<ModalData>({
    novo: null, leadId: null,
    nome: "", whats: "", doc: "", empresa: "", uf: "SP",
    operadora: "Vivo", tipo: "Multa rescisória", valor: "", desc: "",
    autorizado: false,
  });
  useEffect(() => {
    if (open) {
      setStep(0); setErr(null); setCasoIdCriado(null);
      setData(d => ({ ...d, novo: null, leadId: null, autorizado: false }));
    }
  }, [open]);

  if (!open) return null;

  const steps = ["Cadastro", "Cliente", "Sobre o caso", "Confirmação", "Pronto"];

  const submit = async () => {
    if (!profile?.id || !profile.revenda_id) { setErr("Você precisa estar vinculado a uma revenda."); return; }
    setBusy(true);
    setErr(null);

    let leadId = data.leadId;
    const multaNum = Number((data.valor || "0").replace(/[^\d.,]/g, "").replace(",", ".")) || 0;

    // Se é novo lead, cria primeiro
    if (data.novo) {
      const { data: novoLead, error } = await createLead({
        empresa: data.empresa.trim() || data.nome.trim(),
        contato: data.nome.trim(),
        cnpj: data.doc.trim() || null,
        uf: data.uf,
        operadora: data.operadora,
        valor: multaNum,
        status: "travado",
        tag: data.tipo,
        origem: "Desbloquear",
        rep_id: profile.id,
        revenda_id: profile.revenda_id,
      });
      if (error || !novoLead) { setErr(error || "Falha ao criar lead"); setBusy(false); return; }
      leadId = novoLead.id;
    } else if (leadId) {
      // Move lead existente para 'travado'
      await supabase.from("leads").update({ status: "travado" } as never).eq("id", leadId);
    } else {
      setErr("Selecione um lead.");
      setBusy(false);
      return;
    }

    // Cria o caso
    const { data: novoCaso, error: errC } = await createCaso({
      lead_id: leadId!,
      status: "recebido",
      tipo: data.tipo,
      multa: multaNum,
      sla_dias: 0,
      dias_indicacao: 0,
      prox_passo: "Aguardando atribuição de advogado",
    });
    setBusy(false);
    if (errC || !novoCaso) { setErr(errC || "Falha ao criar caso"); return; }

    // Liga o lead ao caso
    await supabase.from("leads").update({ advox_caso_id: novoCaso.id } as never).eq("id", leadId!);

    setCasoIdCriado(novoCaso.id);
    setStep(4);
  };

  const stepBody = () => {
    if (step === 0) {
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <p style={{ margin: 0, color: "var(--ink-2)", fontSize: 13 }}>Esse cliente já está cadastrado no seu pipeline?</p>
          <div className="grid-2col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <button onClick={() => { setData(d => ({ ...d, novo: false })); setStep(1); }} style={cardChoice}>
              <Ic.Search size={20} />
              <div style={{ fontSize: 14, fontWeight: 600, marginTop: 8 }}>Já está cadastrado</div>
              <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 4 }}>Buscar lead existente e indicar para o Advox</div>
            </button>
            <button onClick={() => { setData(d => ({ ...d, novo: true })); setStep(1); }} style={cardChoice}>
              <Ic.Plus size={20} />
              <div style={{ fontSize: 14, fontWeight: 600, marginTop: 8 }}>Cadastrar do zero</div>
              <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 4 }}>Capturar os dados agora para já encaminhar</div>
            </button>
          </div>
        </div>
      );
    }
    if (step === 1) {
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {data.novo === false && (
            <div>
              <Field label="Selecione um lead existente">
                <Input full icon={<Ic.Search size={13} />} placeholder="Busca em desenvolvimento — selecione abaixo" value="" onChange={()=>{}} />
              </Field>
              <div style={{ marginTop: 10, border: "1px solid var(--line)", borderRadius: 5, maxHeight: 280, overflow: "auto" }}>
                {(leads ?? []).filter(l => !["travado","aguardando","fechado","perdido"].includes(l.status)).map(l => (
                  <div key={l.id}
                    onClick={() => setData(d => ({ ...d, leadId: l.id, empresa: l.empresa, nome: l.contato, doc: l.cnpj ?? "", uf: l.uf ?? "SP", operadora: l.operadora }))}
                    style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "10px 12px",
                      borderBottom: "1px solid var(--line)", cursor: "pointer",
                      background: data.leadId === l.id ? "var(--gold-soft)" : "var(--surface)",
                    }}>
                    <Avatar name={l.contato} size={28} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{l.empresa}</div>
                      <div style={{ fontSize: 11.5, color: "var(--ink-3)" }}>{l.contato} · <span className="mono">{l.cnpj ?? "—"}</span></div>
                    </div>
                    <OperadoraTag op={l.operadora} />
                    <StatusPill stage={l.status} pipeline={PIPELINE_COMERCIAL_DB} size="sm" />
                  </div>
                ))}
                {(leads ?? []).length === 0 && (
                  <div style={{ padding: 20, textAlign: "center", color: "var(--ink-3)", fontSize: 12.5 }}>
                    Você não tem leads abertos. Use a opção "Cadastrar do zero".
                  </div>
                )}
              </div>
            </div>
          )}
          {data.novo && (
            <div className="grid-2col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="Nome do cliente">
                <Input full value={data.nome} onChange={e=>setData({...data, nome:e.target.value})} placeholder="Mariana Albuquerque" />
              </Field>
              <Field label="WhatsApp">
                <Input full value={data.whats} onChange={e=>setData({...data, whats:e.target.value})} placeholder="(48) 99999-0000" />
              </Field>
              <Field label="CPF ou CNPJ">
                <Input full value={data.doc} onChange={e=>setData({...data, doc:e.target.value})} placeholder="00.000.000/0001-00" />
              </Field>
              <Field label="Empresa (se CNPJ)">
                <Input full value={data.empresa} onChange={e=>setData({...data, empresa:e.target.value})} placeholder="Construtora Vértice Sul" />
              </Field>
              <Field label="Estado">
                <Select value={data.uf} onChange={e=>setData({...data, uf:e.target.value})} options={["SP","RJ","MG","RS","SC","PR","PE","BA","DF","GO","MT","MS","CE","ES","AM","PA","SE","AL","MA","PI","RN","PB","TO","RO","AC","RR","AP"]} />
              </Field>
            </div>
          )}
        </div>
      );
    }
    if (step === 2) {
      return (
        <div className="grid-2col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Operadora atual">
            <Select value={data.operadora} onChange={e=>setData({...data, operadora: e.target.value as Operadora})} options={OPERADORAS_LIST as unknown as string[]} />
          </Field>
          <Field label="Tipo de bloqueio">
            <Select value={data.tipo} onChange={e=>setData({...data, tipo:e.target.value})} options={["Multa rescisória","Fidelidade vencida","Renovação automática","Outros"]} />
          </Field>
          <Field label="Valor estimado da multa">
            <Input full icon={<span style={{ fontSize: 12, color: "var(--ink-4)" }}>R$</span>}
              value={data.valor} onChange={e=>setData({...data, valor:e.target.value})} placeholder="48.000" />
          </Field>
          <div style={{ gridColumn: "1 / -1" }}>
            <Field label="Breve descrição" hint="Conte ao escritório o contexto — quanto mais claro, mais rápido o avanço">
              <textarea value={data.desc} onChange={e=>setData({...data, desc:e.target.value})} placeholder="Cliente possui 14 linhas com a operadora, contrato renovou automaticamente em janeiro e a fidelidade venceu há 6 meses…"
                style={{ width: "100%", minHeight: 90, padding: "8px 10px", border: "1px solid var(--line-2)", borderRadius: 5, fontSize: 13, lineHeight: 1.5, background: "var(--surface)", color: "var(--ink)", resize: "vertical", fontFamily: "inherit" }} />
            </Field>
          </div>
        </div>
      );
    }
    if (step === 3) {
      const empresaLabel = data.novo
        ? (data.empresa || data.nome || "—")
        : ((leads ?? []).find(l => l.id === data.leadId)?.empresa ?? "—");
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {err && <div style={{ background: "var(--rose-soft)", border: "1px solid var(--rose-border)", color: "var(--rose)", padding: "9px 12px", borderRadius: 5, fontSize: 12.5 }}>{err}</div>}
          <div style={{ border: "1px solid var(--line)", borderRadius: 6, background: "var(--surface-2)" }}>
            <SummaryRow label="Cliente" value={empresaLabel} />
            <SummaryRow label="Localização" value={data.uf} />
            <SummaryRow label="Operadora" value={<OperadoraTag op={data.operadora} />} />
            <SummaryRow label="Tipo de bloqueio" value={data.tipo} />
            <SummaryRow label="Valor estimado" value={fmtBRL(Number((data.valor||"0").replace(/[^\d.,]/g, "").replace(",", ".")) || 0)} />
            <SummaryRow label="Encaminhamento" value="Time jurídico Advox (alocação automática)" last />
          </div>
          <label style={{
            display: "flex", gap: 10, padding: "12px 14px",
            border: "1px solid var(--line)", borderRadius: 6,
            background: data.autorizado ? "var(--gold-soft)" : "var(--surface)", cursor: "pointer",
          }}>
            <input type="checkbox" checked={data.autorizado} onChange={e=>setData({...data, autorizado:e.target.checked})} style={{ marginTop: 2 }} />
            <span style={{ fontSize: 12.5, lineHeight: 1.5, color: "var(--ink)" }}>
              Confirmo que <strong>o cliente autorizou expressamente</strong> o encaminhamento dos seus dados ao escritório de advocacia parceiro, para análise de cobranças abusivas. Estou ciente que os honorários, se houver contratação, são pagos pelo cliente final.
            </span>
          </label>
        </div>
      );
    }
    if (step === 4) {
      return (
        <div style={{ textAlign: "center", padding: "12px 0" }}>
          <div style={{ width: 56, height: 56, borderRadius: 99, background: "var(--green-soft)", color: "var(--green)", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
            <Ic.CheckCircle size={26} />
          </div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: "var(--ink)", letterSpacing: "-0.01em" }}>Indicação enviada para o Advox</h2>
          <p style={{ marginTop: 8, color: "var(--ink-2)", fontSize: 13.5, maxWidth: 480, marginInline: "auto", lineHeight: 1.55 }}>
            Caso <strong className="mono">{casoIdCriado?.slice(0, 8) ?? "—"}</strong> criado. O lead foi movido para <strong>Travado (Advox)</strong> no seu pipeline.
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div onClick={onClose} className="modal-backdrop" style={{
      position: "fixed", inset: 0, zIndex: 100,
      background: "oklch(0.10 0.04 250 / 0.45)", backdropFilter: "blur(2px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
    }}>
      <div onClick={e=>e.stopPropagation()} className="fade-up modal-shell" style={{
        width: 720, maxWidth: "100%", maxHeight: "92vh",
        background: "var(--surface)", border: "1px solid var(--line-2)",
        borderRadius: 8, boxShadow: "var(--shadow-lg)",
        display: "flex", flexDirection: "column", overflow: "hidden",
      }}>
        <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ width: 28, height: 28, borderRadius: 5, background: "var(--navy)", color: "var(--navy-ink)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
            <Ic.Unlock size={15} />
          </span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>Desbloquear Cliente</div>
            <div style={{ fontSize: 11.5, color: "var(--ink-3)" }}>Indicar para o time jurídico Advox</div>
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: 0, color: "var(--ink-3)", cursor: "pointer", padding: 6 }}>
            <Ic.X size={16} />
          </button>
        </div>

        {step < 4 && (
          <div style={{ padding: "12px 18px", borderBottom: "1px solid var(--line)", display: "flex", gap: 8, alignItems: "center" }}>
            {steps.slice(0, 4).map((s, i) => (
              <React.Fragment key={s}>
                <div style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  fontSize: 11.5,
                  color: step === i ? "var(--ink)" : (i < step ? "var(--ink-2)" : "var(--ink-4)"),
                  fontWeight: 500,
                }}>
                  <span style={{
                    width: 18, height: 18, borderRadius: 99,
                    border: `1px solid ${step >= i ? "var(--navy)" : "var(--line-2)"}`,
                    background: step > i ? "var(--navy)" : (step === i ? "var(--navy)" : "transparent"),
                    color: step >= i ? "var(--navy-ink)" : "var(--ink-4)",
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    fontSize: 10, fontWeight: 600,
                  }}>{i < step ? <Ic.Check size={10} /> : i + 1}</span>
                  {s}
                </div>
                {i < 3 && <div style={{ flex: 1, height: 1, background: "var(--line)" }} />}
              </React.Fragment>
            ))}
          </div>
        )}

        <div style={{ padding: "18px 22px", overflow: "auto", flex: 1 }}>{stepBody()}</div>

        <div style={{
          padding: "12px 18px", borderTop: "1px solid var(--line)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          background: "var(--surface-2)",
        }}>
          <div style={{ fontSize: 11.5, color: "var(--ink-3)" }}>
            {step < 4 ? `Passo ${step + 1} de 4` : "Concluído"}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {step > 0 && step < 4 && <Btn variant="ghost" onClick={()=>setStep(step-1)}>Voltar</Btn>}
            {step < 3 && <Btn variant="primary" iconRight={<Ic.ArrowRight size={13} />} onClick={()=>setStep(step+1)} disabled={
              (step === 0 && data.novo === null) ||
              (step === 1 && data.novo === false && !data.leadId) ||
              (step === 1 && data.novo === true && (!data.nome || !data.empresa))
            }>Continuar</Btn>}
            {step === 3 && <Btn variant="gold" iconRight={<Ic.Unlock size={13} />} onClick={submit} disabled={!data.autorizado || busy}>{busy ? "Enviando…" : "Confirmar e enviar"}</Btn>}
            {step === 4 && <Btn variant="primary" onClick={onClose}>Voltar ao painel</Btn>}
          </div>
        </div>
      </div>
    </div>
  );
}
