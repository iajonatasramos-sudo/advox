-- 0017 — Categorias das mensagens rápidas (extensão do WhatsApp, layout BuildChat)
--
-- mensagens_categorias  grupos coloridos das mensagens rápidas. revenda_id
--                       preenchido = categoria da revenda (só o coord cria),
--                       visível para todo o time; null = pessoal.
-- mensagens_rapidas.categoria_id  em qual categoria a mensagem aparece.
-- mensagens_rapidas.usos          contador para o filtro "Usadas".

create table if not exists public.mensagens_categorias (
  id          uuid primary key default gen_random_uuid(),
  dono_id     uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  revenda_id  uuid references public.revendas(id) on delete cascade,
  nome        text not null check (length(trim(nome)) between 1 and 40),
  cor         text not null default '#22c55e' check (cor ~ '^#[0-9a-fA-F]{6}$'),
  ordem       int  not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists mensagens_categorias_dono_idx on public.mensagens_categorias (dono_id);
create index if not exists mensagens_categorias_revenda_idx on public.mensagens_categorias (revenda_id) where revenda_id is not null;

create trigger trg_mensagens_categorias_updated before update on public.mensagens_categorias
  for each row execute function public.set_updated_at();

alter table public.mensagens_rapidas
  add column if not exists categoria_id uuid references public.mensagens_categorias(id) on delete set null,
  add column if not exists usos int not null default 0;
create index if not exists mensagens_rapidas_categoria_idx on public.mensagens_rapidas (categoria_id);

alter table public.mensagens_categorias enable row level security;

-- Lê as suas + as da própria revenda
create policy mensagens_categorias_select on public.mensagens_categorias
  for select to authenticated
  using (
    public.current_ativo() and (
      dono_id = (select auth.uid())
      or (revenda_id is not null and revenda_id = public.current_revenda())
    )
  );

-- Cria/edita/exclui só as suas; categoria da revenda só o coord da própria revenda
create policy mensagens_categorias_insert on public.mensagens_categorias
  for insert to authenticated
  with check (
    dono_id = (select auth.uid()) and public.current_ativo()
    and (revenda_id is null or (public.current_papel() = 'coord' and revenda_id = public.current_revenda()))
  );
create policy mensagens_categorias_update on public.mensagens_categorias
  for update to authenticated
  using (dono_id = (select auth.uid()) and public.current_ativo())
  with check (
    dono_id = (select auth.uid())
    and (revenda_id is null or (public.current_papel() = 'coord' and revenda_id = public.current_revenda()))
  );
create policy mensagens_categorias_delete on public.mensagens_categorias
  for delete to authenticated
  using (dono_id = (select auth.uid()) and public.current_ativo());

grant select, insert, update, delete on public.mensagens_categorias to authenticated;

-- Contador de uso: qualquer pessoa que VÊ a mensagem pode somar 1 (inclusive
-- as da revenda, que ela não pode editar). Security definer respeitando a
-- mesma regra de leitura da policy de select.
create or replace function public.mensagem_usada(p_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.mensagens_rapidas m
     set usos = m.usos + 1
   where m.id = p_id
     and public.current_ativo()
     and (m.dono_id = auth.uid() or (m.revenda_id is not null and m.revenda_id = public.current_revenda()));
$$;
revoke all on function public.mensagem_usada(uuid) from public, anon;
grant execute on function public.mensagem_usada(uuid) to authenticated;

alter publication supabase_realtime add table public.mensagens_categorias;
