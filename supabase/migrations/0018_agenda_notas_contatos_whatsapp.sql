-- 0018 — Minha agenda (notas pessoais) + painel AdvoxChat (contatos do WhatsApp)
--
-- anotacoes      notas pessoais da guia "Notas" da Minha agenda (só o dono vê).
-- wa_contatos    contatos das conversas abertas na extensão do WhatsApp
--                (registrados pela extensão; listados no painel AdvoxChat).
--                O coord vê os do time da revenda; o admin vê todos.
-- config_extensao  link/versão do .zip da extensão (guia Instalar do painel).

create table if not exists public.anotacoes (
  id          uuid primary key default gen_random_uuid(),
  dono_id     uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  titulo      text not null check (length(trim(titulo)) between 1 and 120),
  conteudo    text not null default '' check (length(conteudo) <= 20000),
  categoria   text check (categoria is null or length(trim(categoria)) between 1 and 40),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists anotacoes_dono_idx on public.anotacoes (dono_id, updated_at desc);
create trigger trg_anotacoes_updated before update on public.anotacoes
  for each row execute function public.set_updated_at();

alter table public.anotacoes enable row level security;
create policy anotacoes_dono on public.anotacoes
  for all to authenticated
  using (dono_id = (select auth.uid()) and public.current_ativo())
  with check (dono_id = (select auth.uid()) and public.current_ativo());
grant select, insert, update, delete on public.anotacoes to authenticated;

create table if not exists public.wa_contatos (
  id              uuid primary key default gen_random_uuid(),
  dono_id         uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  chat_id         text not null check (length(chat_id) between 3 and 120),
  telefone        text,
  nome            text,
  interesses      text check (interesses is null or length(interesses) <= 2000),
  ultimo_contato  timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (dono_id, chat_id)
);
create index if not exists wa_contatos_telefone_idx on public.wa_contatos (telefone);
create trigger trg_wa_contatos_updated before update on public.wa_contatos
  for each row execute function public.set_updated_at();

alter table public.wa_contatos enable row level security;

-- Lê: os seus; coord, os do time da revenda; admin, todos.
create policy wa_contatos_select on public.wa_contatos
  for select to authenticated
  using (
    public.current_ativo() and (
      dono_id = (select auth.uid())
      or public.current_papel() = 'admin'
      or (public.current_papel() = 'coord' and exists (
        select 1 from public.profiles p where p.id = wa_contatos.dono_id and p.revenda_id = public.current_revenda()
      ))
    )
  );
-- Escreve: só os seus.
create policy wa_contatos_insert on public.wa_contatos
  for insert to authenticated
  with check (dono_id = (select auth.uid()) and public.current_ativo());
create policy wa_contatos_update on public.wa_contatos
  for update to authenticated
  using (dono_id = (select auth.uid()) and public.current_ativo())
  with check (dono_id = (select auth.uid()));
create policy wa_contatos_delete on public.wa_contatos
  for delete to authenticated
  using (dono_id = (select auth.uid()) and public.current_ativo());
grant select, insert, update, delete on public.wa_contatos to authenticated;

-- Configuração da extensão (linha única). Todos os ativos leem; só admin altera.
create table if not exists public.config_extensao (
  id          boolean primary key default true check (id),
  zip_url     text,
  versao      text,
  notas       text,
  updated_at  timestamptz not null default now()
);
insert into public.config_extensao (id) values (true) on conflict do nothing;
alter table public.config_extensao enable row level security;
create policy config_extensao_select on public.config_extensao
  for select to authenticated using (public.current_ativo());
create policy config_extensao_update on public.config_extensao
  for update to authenticated
  using (public.current_papel() = 'admin') with check (public.current_papel() = 'admin');
grant select, update on public.config_extensao to authenticated;

alter publication supabase_realtime add table public.anotacoes, public.wa_contatos;
