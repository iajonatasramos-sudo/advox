-- Migration 0011 — Branding por revenda (logo + cor primária)
--
-- Adiciona colunas pra whitelabel:
--   - revendas.logo_url  : URL pública da logo (no bucket revenda-logos)
--   - revendas.cor_primaria : hex (#RRGGBB) usado como cor de tema
--
-- Cria bucket de storage `revenda-logos` (público pra leitura) com policies
-- pra que admin sempre possa enviar e coordenador só possa enviar/atualizar
-- a logo da própria revenda.

alter table revendas add column if not exists logo_url text;
alter table revendas add column if not exists cor_primaria text;

-- ---------- Storage bucket --------------------------------------------

insert into storage.buckets (id, name, public)
values ('revenda-logos', 'revenda-logos', true)
on conflict (id) do nothing;

-- Limpa policies anteriores (idempotente)
drop policy if exists "revenda-logos-read"   on storage.objects;
drop policy if exists "revenda-logos-write"  on storage.objects;
drop policy if exists "revenda-logos-update" on storage.objects;
drop policy if exists "revenda-logos-delete" on storage.objects;

-- Qualquer um (anon ou auth) pode LER as logos
create policy "revenda-logos-read" on storage.objects for select
  using (bucket_id = 'revenda-logos');

-- Upload: admin sempre; coord só se path começar com a própria revenda_id
create policy "revenda-logos-write" on storage.objects for insert
  with check (
    bucket_id = 'revenda-logos'
    and (
      current_papel() = 'admin'
      or (
        current_papel() = 'coord'
        and current_revenda() is not null
        and (storage.foldername(name))[1] = current_revenda()::text
      )
    )
  );

-- Update e delete: mesmo escopo
create policy "revenda-logos-update" on storage.objects for update
  using (
    bucket_id = 'revenda-logos'
    and (
      current_papel() = 'admin'
      or (
        current_papel() = 'coord'
        and current_revenda() is not null
        and (storage.foldername(name))[1] = current_revenda()::text
      )
    )
  );

create policy "revenda-logos-delete" on storage.objects for delete
  using (
    bucket_id = 'revenda-logos'
    and (
      current_papel() = 'admin'
      or (
        current_papel() = 'coord'
        and current_revenda() is not null
        and (storage.foldername(name))[1] = current_revenda()::text
      )
    )
  );

-- ---------- Policy de update em revendas pra coord (já existe?) -------
-- Coord já consegue dar update na própria revenda via policy
-- "revendas_coord_update_own". Os novos campos logo_url / cor_primaria
-- ficam cobertos por essa policy (era um update genérico).
