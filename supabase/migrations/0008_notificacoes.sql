-- =====================================================================
-- Notificações in-app
-- Cada usuário tem seu próprio feed. Triggers criam notificações em
-- eventos importantes (caso liberado, lead movido pra travado, etc.)
-- =====================================================================

create type notif_tipo as enum (
  'caso_recebido',
  'caso_status_mudou',
  'caso_liberado',
  'lead_movido',
  'tarefa_atrasada',
  'rep_aprovado',
  'rep_pendente',
  'sistema'
);

create table notificacoes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles(id) on delete cascade,
  tipo        notif_tipo not null,
  titulo      text not null,
  texto       text,
  link        text,              -- caminho ou identificador para navegar
  entity_type text,               -- "lead", "caso", "profile", etc.
  entity_id   uuid,
  lida        boolean not null default false,
  lida_em     timestamptz,
  created_at  timestamptz not null default now()
);
create index idx_notificacoes_user on notificacoes(user_id, lida, created_at desc);
create index idx_notificacoes_created on notificacoes(created_at desc);

alter table notificacoes enable row level security;

-- Cada usuário vê só as próprias
create policy "notif_self_select" on notificacoes for select
  using (user_id = auth.uid());

-- Cada usuário pode marcar suas próprias como lidas
create policy "notif_self_update" on notificacoes for update
  using (user_id = auth.uid());

-- Inserts via triggers/server (security definer)
-- Admin pode criar manualmente também
create policy "notif_admin_insert" on notificacoes for insert
  with check (current_papel() = 'admin');

-- ---------- Trigger: caso status muda → notifica rep do lead ---------
create or replace function public.notif_caso_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lead record;
  v_titulo text;
  v_texto text;
  v_tipo notif_tipo;
begin
  if new.status = old.status then return new; end if;

  select empresa, rep_id, revenda_id into v_lead from leads where id = new.lead_id;
  if v_lead.rep_id is null then return new; end if;

  if new.status = 'liberado' then
    v_tipo := 'caso_liberado';
    v_titulo := 'Caso liberado!';
    v_texto := 'O caso de ' || v_lead.empresa || ' foi liberado pelo Advox. A negociação pode voltar.';
  else
    v_tipo := 'caso_status_mudou';
    v_titulo := 'Caso avançou';
    v_texto := 'O caso de ' || v_lead.empresa || ' avançou para ' || new.status;
  end if;

  -- Notifica o rep responsável
  insert into notificacoes (user_id, tipo, titulo, texto, link, entity_type, entity_id)
  values (v_lead.rep_id, v_tipo, v_titulo, v_texto, '/casos/' || new.id, 'caso', new.id);

  -- E também o coordenador da revenda
  insert into notificacoes (user_id, tipo, titulo, texto, link, entity_type, entity_id)
  select coord_id, v_tipo, v_titulo, v_texto, '/casos/' || new.id, 'caso', new.id
    from revendas where id = v_lead.revenda_id and coord_id is not null;

  return new;
end;
$$;

create trigger trg_notif_caso_status after update on casos
  for each row execute function public.notif_caso_status_change();

-- ---------- Trigger: novo caso criado → notifica advogado se atribuído ---
create or replace function public.notif_caso_criado()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lead record;
begin
  if new.advogado_id is null then return new; end if;
  select empresa into v_lead from leads where id = new.lead_id;
  insert into notificacoes (user_id, tipo, titulo, texto, link, entity_type, entity_id)
  values (
    new.advogado_id, 'caso_recebido', 'Novo caso atribuído',
    'Você foi atribuído ao caso de ' || coalesce(v_lead.empresa, '—'),
    '/casos/' || new.id, 'caso', new.id
  );
  return new;
end;
$$;

create trigger trg_notif_caso_criado after insert on casos
  for each row execute function public.notif_caso_criado();

-- Quando o advogado_id é alterado em update, também notifica
create or replace function public.notif_caso_atribuido()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_lead record;
begin
  if new.advogado_id is null or new.advogado_id = old.advogado_id then return new; end if;
  select empresa into v_lead from leads where id = new.lead_id;
  insert into notificacoes (user_id, tipo, titulo, texto, link, entity_type, entity_id)
  values (
    new.advogado_id, 'caso_recebido', 'Você foi atribuído a um caso',
    'Caso de ' || coalesce(v_lead.empresa, '—'),
    '/casos/' || new.id, 'caso', new.id
  );
  return new;
end;
$$;

create trigger trg_notif_caso_atribuido after update on casos
  for each row execute function public.notif_caso_atribuido();

-- ---------- Trigger: rep aprovado → notifica o rep -------------------
create or replace function public.notif_rep_aprovado()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'ativo' and old.status = 'pendente' and new.papel = 'rep' then
    insert into notificacoes (user_id, tipo, titulo, texto)
    values (new.id, 'rep_aprovado', 'Sua conta foi aprovada!', 'Você já pode acessar o sistema e começar a cadastrar leads.');
  end if;
  return new;
end;
$$;

create trigger trg_notif_rep_aprovado after update on profiles
  for each row execute function public.notif_rep_aprovado();

-- ---------- Habilita realtime ---------------------------------------
alter publication supabase_realtime add table notificacoes;
