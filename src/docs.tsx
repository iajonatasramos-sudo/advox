import React, { useEffect, useRef, useState } from "react";
import { Ic } from "./icons";
import { Btn, Empty } from "./ui";
import { supabase } from "./lib/supabase";
import { useAuth } from "./auth";

type DocRow = {
  id: string;
  nome: string;
  tipo: string | null;
  tamanho: number | null;
  storage_path: string;
  uploaded_by: string;
  created_at: string;
  uploader: { nome: string } | null;
};

const BUCKET = "documentos";

function formatBytes(n: number | null): string {
  if (!n) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function DocumentosLista({ parent }: { parent: { kind: "lead" | "caso"; id: string } }) {
  const { profile } = useAuth();
  const [docs, setDocs] = useState<DocRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setError(null);
    const col = parent.kind === "lead" ? "lead_id" : "caso_id";
    const { data, error } = await supabase
      .from("documentos")
      .select("id, nome, tipo, tamanho, storage_path, uploaded_by, created_at, uploader:profiles!documentos_uploaded_by_fkey(nome)")
      .eq(col, parent.id)
      .order("created_at", { ascending: false });
    if (error) { setError(error.message); return; }
    setDocs((data ?? []) as unknown as DocRow[]);
  };

  useEffect(() => { load(); }, [parent.kind, parent.id]);
  useEffect(() => {
    const ch = supabase.channel(`docs-${parent.kind}-${parent.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "documentos" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [parent.kind, parent.id]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile?.id) return;
    setUploading(true); setError(null);
    try {
      const uuid = crypto.randomUUID();
      const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const storagePath = `${parent.kind}s/${parent.id}/${uuid}-${cleanName}`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(storagePath, file, {
        cacheControl: "3600", upsert: false,
      });
      if (upErr) throw upErr;

      const insert: Record<string, unknown> = {
        nome: file.name,
        tipo: file.type || null,
        tamanho: file.size,
        storage_path: storagePath,
        uploaded_by: profile.id,
      };
      insert[parent.kind === "lead" ? "lead_id" : "caso_id"] = parent.id;
      const { error: dbErr } = await supabase.from("documentos").insert(insert as never);
      if (dbErr) {
        // tenta limpar o arquivo se a inserção falhou
        await supabase.storage.from(BUCKET).remove([storagePath]);
        throw dbErr;
      }
    } catch (e2) {
      setError(e2 instanceof Error ? e2.message : String(e2));
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const download = async (doc: DocRow) => {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(doc.storage_path, 60);
    if (error || !data?.signedUrl) { alert("Erro: " + (error?.message ?? "URL inválida")); return; }
    window.open(data.signedUrl, "_blank");
  };

  const remove = async (doc: DocRow) => {
    if (!window.confirm(`Excluir o documento "${doc.nome}"?`)) return;
    await supabase.storage.from(BUCKET).remove([doc.storage_path]);
    await supabase.from("documentos").delete().eq("id", doc.id);
  };

  const totalSize = (docs ?? []).reduce((s, d) => s + (d.tamanho ?? 0), 0);

  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 6, overflow: "hidden" }}>
      <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 12, color: "var(--ink-3)" }}>
          {docs === null ? "Carregando…" : `${docs.length} ${docs.length === 1 ? "documento" : "documentos"} · ${formatBytes(totalSize)}`}
        </span>
        <div>
          <input ref={fileRef} type="file" onChange={handleUpload} style={{ display: "none" }} />
          <Btn variant="soft" size="sm" icon={<Ic.Upload size={12} />} onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading ? "Enviando…" : "Anexar arquivo"}
          </Btn>
        </div>
      </div>

      {error && (
        <div style={{ background: "var(--rose-soft)", border: "1px solid var(--rose-border)", color: "var(--rose)", padding: "9px 12px", margin: 12, borderRadius: 5, fontSize: 12.5 }}>
          {error}
        </div>
      )}

      {docs === null ? (
        <div style={{ padding: 24, textAlign: "center", color: "var(--ink-3)", fontSize: 12.5 }}>Carregando…</div>
      ) : docs.length === 0 ? (
        <Empty icon={<Ic.Doc size={18} />} title="Nenhum documento anexado" hint="Use o botão 'Anexar arquivo' acima para enviar contratos, faturas, procurações, etc." />
      ) : (
        docs.map((d, i) => (
          <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", borderBottom: i < docs.length - 1 ? "1px solid var(--line)" : 0 }}>
            <span style={{ width: 26, height: 26, borderRadius: 4, background: "var(--blue-soft)", color: "var(--blue)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
              <Ic.Doc size={14} />
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.nome}</div>
              <div style={{ fontSize: 11.5, color: "var(--ink-4)" }}>
                {formatBytes(d.tamanho)} · enviado por {d.uploader?.nome ?? "—"} · {new Date(d.created_at).toLocaleDateString("pt-BR")}
              </div>
            </div>
            <Btn variant="ghost" size="sm" icon={<Ic.Download size={12} />} onClick={() => download(d)}>Baixar</Btn>
            <Btn variant="ghost" size="sm" icon={<Ic.Trash size={12} />} onClick={() => remove(d)}>Excluir</Btn>
          </div>
        ))
      )}
    </div>
  );
}
