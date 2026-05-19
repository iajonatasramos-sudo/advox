-- Migration 0012 — Aumenta o limite de upload do bucket revenda-logos para 10 MB
--
-- O bucket é criado sem file_size_limit em 0011, então herda o default do
-- projeto (que pode estar baixo). Setando explicitamente pra 10 MB.

update storage.buckets
set file_size_limit = 10 * 1024 * 1024,
    allowed_mime_types = array['image/png','image/jpeg','image/svg+xml','image/webp']
where id = 'revenda-logos';
