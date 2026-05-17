-- =====================================================================
-- Storage de documentos: bucket privado + policies de acesso
-- Rode este SQL DEPOIS de criar o bucket pelo Dashboard (instruções abaixo).
--
-- 1) No Supabase Dashboard → Storage → New bucket:
--      Nome: documentos
--      Public: false
--      File size limit: 10 MB (ou ajuste)
--      Allowed MIME types: deixe em branco (aceita tudo)
--
-- 2) Rode este SQL para criar as policies de acesso.
-- =====================================================================

-- Convenção de path:
--   leads/<lead_id>/<uuid>-<filename>
--   casos/<caso_id>/<uuid>-<filename>
-- A primeira parte do path identifica a entidade.

-- ---------- Policies do bucket documentos ----------------------------

-- Leitura: quem tem permissão de ler o lead/caso pode baixar
create policy "docs_select" on storage.objects for select
  to authenticated
  using (
    bucket_id = 'documentos'
    and exists (
      select 1 from public.documentos d
       where d.storage_path = storage.objects.name
    )
    -- a tabela documentos já tem suas próprias policies que restringem o select
    -- então se a row é visível em documentos, o arquivo é baixável aqui
  );

-- Upload: usuários ativos podem subir
create policy "docs_insert" on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'documentos'
    and (storage.foldername(name))[1] in ('leads', 'casos')
  );

-- Update: só o uploader original
create policy "docs_update" on storage.objects for update
  to authenticated
  using (
    bucket_id = 'documentos'
    and owner = auth.uid()
  );

-- Delete: uploader original ou admin
create policy "docs_delete" on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'documentos'
    and (owner = auth.uid() or public.current_papel() = 'admin')
  );
