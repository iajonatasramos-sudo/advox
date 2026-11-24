-- =====================================================================
-- Migration 0016 — Extensão do WhatsApp: pastas de conversas e
-- mensagens rápidas salvas no servidor (sincronizam entre computadores).
--
-- wa_pastas            pastas do usuário (nome, cor, ordem)
-- wa_pasta_conversas   conversas do WhatsApp dentro de cada pasta
--                      (chat_id do WhatsApp + telefone/nome para exibir)
-- mensagens_rapidas    modelos de mensagem. revenda_id preenchido =
--                      compartilhada com toda a revenda (só coord cria).
--
-- RLS: cada um só vê/edita o que é seu; mensagens da revenda são
-- visíveis para os membros ativos dela.
-- =====================================================================

create table if not exists public.wa_pastas (
  id          uuid primary key default gen_random_uuid(),
  dono_id     uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  nome        text not null check (length(trim(nome)) between 1 and 40),
  cor         text not null default '#3b5bdb' check (cor ~ '^#[0-9a-fA-F]{6}$'),
  ordem       int  not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists wa_pastas_dono_idx on public.wa_pastas (dono_id, ordem);

create table if not exists public.wa_pasta_conversas (
  pasta_id    uuid not null references public.wa_pastas(id) on delete cascade,
  chat_id     text not null check (length(chat_id) between 3 and 80),
  telefone    text,
  nome        text,
  dono_id     uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (pasta_id, chat_id)
);
create index if not exists wa_pasta_conversas_dono_idx on public.wa_pasta_conversas (dono_id);

create table if not exists public.mensagens_rapidas (
  id          uuid primary key default gen_random_uuid(),
  dono_id     uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  revenda_id  uuid references public.revendas(id) on delete cascade,
  titulo      text not null check (length(trim(titulo)) between 1 and 60),
  atalho      text check (atalho ~ '^[a-z0-9_-]{1,20}$'),
  texto       text not null check (length(texto) between 1 and 4000),
  ordem       int  not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists mensagens_rapidas_dono_idx on public.mensagens_rapidas (dono_id);
create index if not exists mensagens_rapidas_revenda_idx on public.mensagens_rapidas (revenda_id) where revenda_id is not null;

create trigger trg_wa_pastas_updated before update on public.wa_pastas
  for each row execute function public.set_updated_at();
create trigger trg_mensagens_rapidas_updated before update on public.mensagens_rapidas
  for each row execute function public.set_updated_at();

alter table public.wa_pastas          enable row level security;
alter table public.wa_pasta_conversas enable row level security;
alter table public.mensagens_rapidas  enable row level security;

-- Pastas: só o dono (conta ativa)
create policy wa_pastas_dono on public.wa_pastas
  for all to authenticated
  using (dono_id = (select auth.uid()) and public.current_ativo())
  with check (dono_id = (select auth.uid()) and public.current_ativo());

-- Conversas da pasta: só o dono, e a pasta tem que ser dele
create policy wa_pasta_conversas_dono on public.wa_pasta_conversas
  for all to authenticated
  using (dono_id = (select auth.uid()) and public.current_ativo())
  with check (
    dono_id = (select auth.uid()) and public.current_ativo()
    and exists (select 1 from public.wa_pastas p where p.id = pasta_id and p.dono_id = (select auth.uid()))
  );

-- Mensagens rápidas: lê as suas + as compartilhadas da própria revenda
create policy mensagens_rapidas_select on public.mensagens_rapidas
  for select to authenticated
  using (
    public.current_ativo() and (
      dono_id = (select auth.uid())
      or (revenda_id is not null and revenda_id = public.current_revenda())
    )
  );

-- Cria/edita/exclui só as suas; compartilhar com a revenda só coord da própria revenda
create policy mensagens_rapidas_insert on public.mensagens_rapidas
  for insert to authenticated
  with check (
    dono_id = (select auth.uid()) and public.current_ativo()
    and (revenda_id is null or (public.current_papel() = 'coord' and revenda_id = public.current_revenda()))
  );
create policy mensagens_rapidas_update on public.mensagens_rapidas
  for update to authenticated
  using (dono_id = (select auth.uid()) and public.current_ativo())
  with check (
    dono_id = (select auth.uid())
    and (revenda_id is null or (public.current_papel() = 'coord' and revenda_id = public.current_revenda()))
  );
create policy mensagens_rapidas_delete on public.mensagens_rapidas
  for delete to authenticated
  using (dono_id = (select auth.uid()) and public.current_ativo());

grant select, insert, update, delete on public.wa_pastas, public.wa_pasta_conversas, public.mensagens_rapidas to authenticated;

alter publication supabase_realtime add table public.wa_pastas, public.wa_pasta_conversas, public.mensagens_rapidas;
