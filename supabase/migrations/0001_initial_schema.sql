-- =====================================================================
-- Advox — Schema inicial
-- Rode no SQL Editor do Supabase (Dashboard → SQL Editor → New query)
-- =====================================================================

-- ---------- ENUMS ------------------------------------------------------
create type papel as enum ('admin', 'coord', 'rep', 'advogado');
create type conta_status as enum ('pendente', 'ativo', 'suspenso', 'recusado');
create type operadora as enum ('Vivo', 'TIM', 'Claro', 'Oi');
create type lead_status as enum (
  'novo', 'contato', 'proposta', 'travado',
  'aguardando', 'negociacao', 'fechado', 'perdido'
);
create type caso_status as enum (
  'recebido', 'analise', 'contato', 'honorarios',
  'contratou', 'documentacao', 'extrajudicial',
  'judicial', 'liberado', 'naoliberado', 'recusou'
);
create type prioridade_tarefa as enum ('alta', 'media', 'baixa');
create type urgencia_tarefa as enum ('atrasada', 'hoje', 'semana', 'proxima');
create type tipo_nota as enum ('nota', 'ligacao', 'email', 'whatsapp', 'status');
create type prazo_status as enum ('agendado', 'feito', 'pendente');

-- ---------- helpers / updated_at trigger -------------------------------
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

-- ---------- TABLES -----------------------------------------------------

-- Revendas (criadas pelo Coordenador ao aceitar convite, ou pelo Admin)
create table revendas (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null unique,
  cnpj        text,
  status      conta_status not null default 'ativo',
  coord_id    uuid,  -- FK a profiles, mas adicionada depois pra evitar ciclo
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger trg_revendas_updated before update on revendas
  for each row execute function set_updated_at();

-- Profiles (1-pra-1 com auth.users)
create table profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null unique,
  nome        text not null,
  papel       papel not null,
  status      conta_status not null default 'pendente',
  revenda_id  uuid references revendas(id) on delete set null,
  oab         text,
  uf          text,
  cidade      text,
  whats       text,
  foto_url    text,
  operadoras  operadora[],
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger trg_profiles_updated before update on profiles
  for each row execute function set_updated_at();
create index idx_profiles_revenda on profiles(revenda_id);
create index idx_profiles_papel on profiles(papel);

-- Agora pode adicionar FK do coord_id em revendas
alter table revendas
  add constraint revendas_coord_fk foreign key (coord_id) references profiles(id) on delete set null;

-- Leads
create table leads (
  id            uuid primary key default gen_random_uuid(),
  empresa       text not null,
  contato       text not null,
  cnpj          text,
  cidade        text,
  uf            text,
  operadora     operadora not null,
  valor         numeric(12,2) not null default 0,
  status        lead_status not null default 'novo',
  proximo       text,
  tag           text,
  origem        text,
  rep_id        uuid not null references profiles(id) on delete restrict,
  revenda_id    uuid not null references revendas(id) on delete restrict,
  advox_caso_id uuid,  -- FK adicionada depois (ciclo com casos)
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create trigger trg_leads_updated before update on leads
  for each row execute function set_updated_at();
create index idx_leads_rep on leads(rep_id);
create index idx_leads_revenda on leads(revenda_id);
create index idx_leads_status on leads(status);

-- Casos
create table casos (
  id                uuid primary key default gen_random_uuid(),
  lead_id           uuid not null references leads(id) on delete cascade,
  advogado_id       uuid references profiles(id) on delete set null,
  status            caso_status not null default 'recebido',
  tipo              text not null,
  multa             numeric(12,2) not null default 0,
  valor_honorarios  numeric(12,2),
  sla_dias          int not null default 0,
  prox_passo        text,
  liberado_em       date,
  dias_indicacao    int not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create trigger trg_casos_updated before update on casos
  for each row execute function set_updated_at();
create index idx_casos_lead on casos(lead_id);
create index idx_casos_advogado on casos(advogado_id);
create index idx_casos_status on casos(status);

alter table leads
  add constraint leads_advox_caso_fk foreign key (advox_caso_id) references casos(id) on delete set null;

-- Tarefas
create table tarefas (
  id            uuid primary key default gen_random_uuid(),
  lead_id       uuid references leads(id) on delete cascade,
  caso_id       uuid references casos(id) on delete cascade,
  autor_id      uuid not null references profiles(id) on delete cascade,
  descricao     text not null,
  quando        timestamptz,
  prioridade    prioridade_tarefa not null default 'media',
  urgencia      urgencia_tarefa not null default 'semana',
  completed     boolean not null default false,
  completed_at  timestamptz,
  created_at    timestamptz not null default now(),
  check (lead_id is not null or caso_id is not null)
);
create index idx_tarefas_autor on tarefas(autor_id);
create index idx_tarefas_lead on tarefas(lead_id);
create index idx_tarefas_caso on tarefas(caso_id);

-- Notas / timeline
create table notas (
  id          uuid primary key default gen_random_uuid(),
  lead_id     uuid references leads(id) on delete cascade,
  caso_id     uuid references casos(id) on delete cascade,
  autor_id    uuid not null references profiles(id) on delete cascade,
  texto       text not null,
  interno     boolean not null default false,
  tipo        tipo_nota not null default 'nota',
  created_at  timestamptz not null default now(),
  check (lead_id is not null or caso_id is not null)
);
create index idx_notas_lead on notas(lead_id);
create index idx_notas_caso on notas(caso_id);

-- Documentos (storage path em Supabase Storage)
create table documentos (
  id            uuid primary key default gen_random_uuid(),
  lead_id       uuid references leads(id) on delete cascade,
  caso_id       uuid references casos(id) on delete cascade,
  nome          text not null,
  tipo          text,
  tamanho       int,
  storage_path  text not null,
  uploaded_by   uuid not null references profiles(id) on delete restrict,
  created_at    timestamptz not null default now(),
  check (lead_id is not null or caso_id is not null)
);
create index idx_documentos_lead on documentos(lead_id);
create index idx_documentos_caso on documentos(caso_id);

-- Prazos jurídicos
create table prazos (
  id          uuid primary key default gen_random_uuid(),
  caso_id     uuid not null references casos(id) on delete cascade,
  tipo        text not null,
  descricao   text,
  data        date not null,
  local       text,
  status      prazo_status not null default 'agendado',
  created_at  timestamptz not null default now()
);
create index idx_prazos_caso on prazos(caso_id);
create index idx_prazos_data on prazos(data);

-- Convites (Admin convida Coord/Advogado; Coord convida Rep)
create table convites (
  id          uuid primary key default gen_random_uuid(),
  email       text not null,
  papel       papel not null,
  revenda_id  uuid references revendas(id) on delete cascade,
  invited_by  uuid not null references profiles(id) on delete cascade,
  token       text not null unique default encode(gen_random_bytes(24), 'hex'),
  aceito_em   timestamptz,
  expira_em   timestamptz not null default (now() + interval '7 days'),
  created_at  timestamptz not null default now()
);
create index idx_convites_email on convites(email);
create index idx_convites_token on convites(token);

-- Auditoria
create table auditoria (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references profiles(id) on delete set null,
  action      text not null,
  entity_type text not null,
  entity_id   uuid,
  details     jsonb,
  ip          text,
  user_agent  text,
  created_at  timestamptz not null default now()
);
create index idx_auditoria_entity on auditoria(entity_type, entity_id);
create index idx_auditoria_actor on auditoria(actor_id);
create index idx_auditoria_created on auditoria(created_at desc);

-- ---------- TRIGGER: criar profile pendente quando user se cadastra ----
-- Quando um usuário se cadastra via auth.users (signup ou OAuth), criamos
-- um profile com papel default 'rep' e status 'pendente'.
-- O frontend complementa com nome/revenda imediatamente após signup.
create or replace function handle_new_auth_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, nome, papel, status)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'nome', split_part(new.email, '@', 1)),
    coalesce((new.raw_user_meta_data->>'papel')::papel, 'rep'),
    'pendente'
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_auth_user();

-- =====================================================================
-- ROW LEVEL SECURITY
-- =====================================================================
alter table revendas    enable row level security;
alter table profiles    enable row level security;
alter table leads       enable row level security;
alter table casos       enable row level security;
alter table tarefas     enable row level security;
alter table notas       enable row level security;
alter table documentos  enable row level security;
alter table prazos      enable row level security;
alter table convites    enable row level security;
alter table auditoria   enable row level security;

-- Helper: papel do usuário corrente
create or replace function current_papel() returns papel as $$
  select papel from profiles where id = auth.uid()
$$ language sql stable security definer;

-- Helper: revenda do usuário corrente
create or replace function current_revenda() returns uuid as $$
  select revenda_id from profiles where id = auth.uid()
$$ language sql stable security definer;

-- Helper: status do usuário corrente (precisa estar ativo p/ ver dados)
create or replace function current_ativo() returns boolean as $$
  select status = 'ativo' from profiles where id = auth.uid()
$$ language sql stable security definer;

-- ---------- POLICIES: profiles ---------------------------------------
-- Todos veem seu próprio profile
create policy "profiles_self_select" on profiles for select
  using (id = auth.uid());

-- Admin vê todos
create policy "profiles_admin_select" on profiles for select
  using (current_papel() = 'admin');

-- Coord vê profiles da sua revenda
create policy "profiles_coord_select" on profiles for select
  using (
    current_papel() = 'coord'
    and revenda_id = current_revenda()
  );

-- Próprio usuário atualiza seu profile (campos limitados via frontend)
create policy "profiles_self_update" on profiles for update
  using (id = auth.uid()) with check (id = auth.uid());

-- Admin atualiza qualquer profile (aprovar coord/advogado, mudar papel)
create policy "profiles_admin_update" on profiles for update
  using (current_papel() = 'admin');

-- Coord aprova reps da sua revenda
create policy "profiles_coord_approve" on profiles for update
  using (
    current_papel() = 'coord'
    and revenda_id = current_revenda()
    and papel = 'rep'
  );

-- Insert: handled pelo trigger handle_new_auth_user (security definer)
-- Não há policy de insert direto.

-- ---------- POLICIES: revendas ---------------------------------------
-- Qualquer um autenticado vê a lista de revendas (para escolher no cadastro)
create policy "revendas_select_all_authenticated" on revendas for select
  to authenticated using (true);

-- Admin cria revendas
create policy "revendas_admin_insert" on revendas for insert
  with check (current_papel() = 'admin');

-- Coord cria a própria revenda no onboarding (uma vez)
create policy "revendas_coord_create_own" on revendas for insert
  with check (
    current_papel() = 'coord'
    and current_revenda() is null
  );

-- Admin atualiza qualquer revenda; Coord atualiza a própria
create policy "revendas_admin_update" on revendas for update
  using (current_papel() = 'admin');
create policy "revendas_coord_update_own" on revendas for update
  using (current_papel() = 'coord' and id = current_revenda());

-- ---------- POLICIES: leads -------------------------------------------
-- Admin vê tudo
create policy "leads_admin_select" on leads for select
  using (current_papel() = 'admin' and current_ativo());

-- Rep vê só os próprios
create policy "leads_rep_select" on leads for select
  using (current_papel() = 'rep' and rep_id = auth.uid() and current_ativo());

-- Coord vê os da sua revenda
create policy "leads_coord_select" on leads for select
  using (current_papel() = 'coord' and revenda_id = current_revenda() and current_ativo());

-- Advogado vê leads que têm caso atribuído a ele
create policy "leads_advogado_select" on leads for select
  using (
    current_papel() = 'advogado'
    and current_ativo()
    and exists (
      select 1 from casos c where c.lead_id = leads.id and c.advogado_id = auth.uid()
    )
  );

-- Rep cria seus próprios leads
create policy "leads_rep_insert" on leads for insert
  with check (
    current_papel() = 'rep' and current_ativo()
    and rep_id = auth.uid()
    and revenda_id = current_revenda()
  );

-- Coord cria leads no time
create policy "leads_coord_insert" on leads for insert
  with check (
    current_papel() = 'coord' and current_ativo()
    and revenda_id = current_revenda()
  );

-- Admin cria qualquer
create policy "leads_admin_insert" on leads for insert
  with check (current_papel() = 'admin');

-- Update: mesmo escopo do select
create policy "leads_admin_update" on leads for update using (current_papel() = 'admin');
create policy "leads_rep_update" on leads for update
  using (current_papel() = 'rep' and rep_id = auth.uid() and current_ativo());
create policy "leads_coord_update" on leads for update
  using (current_papel() = 'coord' and revenda_id = current_revenda() and current_ativo());

-- ---------- POLICIES: casos -------------------------------------------
create policy "casos_admin_select" on casos for select using (current_papel() = 'admin');
create policy "casos_advogado_select" on casos for select
  using (current_papel() = 'advogado' and (advogado_id = auth.uid() or advogado_id is null));
-- Rep/Coord veem casos dos seus leads
create policy "casos_rep_select" on casos for select
  using (
    current_papel() = 'rep'
    and exists (select 1 from leads l where l.id = casos.lead_id and l.rep_id = auth.uid())
  );
create policy "casos_coord_select" on casos for select
  using (
    current_papel() = 'coord'
    and exists (select 1 from leads l where l.id = casos.lead_id and l.revenda_id = current_revenda())
  );

-- Insert: Rep cria caso ao "Desbloquear cliente"; Admin/Coord também
create policy "casos_insert_rep" on casos for insert
  with check (
    current_papel() in ('rep','coord','admin') and current_ativo()
  );

-- Update: Advogado atribuído ou Admin
create policy "casos_update_advogado" on casos for update
  using (current_papel() = 'advogado' and advogado_id = auth.uid());
create policy "casos_update_admin" on casos for update using (current_papel() = 'admin');

-- ---------- POLICIES: tarefas / notas / documentos / prazos -----------
-- Padrão: visível para quem vê o lead/caso pai. Inserção pelo autor.
-- Por simplicidade, reusamos a lógica de leads via subquery.

create policy "tarefas_select" on tarefas for select
  using (
    autor_id = auth.uid()
    or current_papel() = 'admin'
    or (
      lead_id is not null and exists (
        select 1 from leads l where l.id = tarefas.lead_id and (
          (current_papel() = 'rep'   and l.rep_id = auth.uid())
          or (current_papel() = 'coord' and l.revenda_id = current_revenda())
        )
      )
    )
  );
create policy "tarefas_insert_self" on tarefas for insert
  with check (autor_id = auth.uid() and current_ativo());
create policy "tarefas_update_self" on tarefas for update
  using (autor_id = auth.uid() or current_papel() = 'admin');

create policy "notas_select" on notas for select
  using (
    autor_id = auth.uid()
    or current_papel() = 'admin'
    or (
      not interno
      and (
        (lead_id is not null and exists (
          select 1 from leads l where l.id = notas.lead_id and (
            (current_papel() = 'rep'   and l.rep_id = auth.uid())
            or (current_papel() = 'coord' and l.revenda_id = current_revenda())
          )
        ))
        or (caso_id is not null and exists (
          select 1 from casos c where c.id = notas.caso_id
            and current_papel() = 'advogado' and c.advogado_id = auth.uid()
        ))
      )
    )
    or (
      interno and current_papel() = 'advogado'
      and caso_id is not null and exists (
        select 1 from casos c where c.id = notas.caso_id and c.advogado_id = auth.uid()
      )
    )
  );
create policy "notas_insert_self" on notas for insert
  with check (autor_id = auth.uid() and current_ativo());

create policy "documentos_select" on documentos for select
  using (
    uploaded_by = auth.uid()
    or current_papel() = 'admin'
    or (lead_id is not null and exists (
      select 1 from leads l where l.id = documentos.lead_id and (
        (current_papel() = 'rep'   and l.rep_id = auth.uid())
        or (current_papel() = 'coord' and l.revenda_id = current_revenda())
      )
    ))
    or (caso_id is not null and exists (
      select 1 from casos c where c.id = documentos.caso_id and c.advogado_id = auth.uid()
    ))
  );
create policy "documentos_insert" on documentos for insert
  with check (uploaded_by = auth.uid() and current_ativo());

create policy "prazos_select" on prazos for select
  using (
    current_papel() = 'admin'
    or exists (
      select 1 from casos c where c.id = prazos.caso_id
        and current_papel() = 'advogado' and c.advogado_id = auth.uid()
    )
  );
create policy "prazos_insert_advogado" on prazos for insert
  with check (
    current_papel() = 'advogado'
    and exists (select 1 from casos c where c.id = prazos.caso_id and c.advogado_id = auth.uid())
  );

-- ---------- POLICIES: convites ----------------------------------------
-- Admin convida advogado/coord; Coord convida rep
create policy "convites_admin_all" on convites for all
  using (current_papel() = 'admin') with check (current_papel() = 'admin');
create policy "convites_coord_rep" on convites for insert
  with check (
    current_papel() = 'coord' and current_ativo()
    and papel = 'rep'
    and revenda_id = current_revenda()
  );
create policy "convites_coord_select" on convites for select
  using (current_papel() = 'coord' and revenda_id = current_revenda());

-- ---------- POLICIES: auditoria ---------------------------------------
create policy "auditoria_admin_select" on auditoria for select using (current_papel() = 'admin');
create policy "auditoria_self_select" on auditoria for select using (actor_id = auth.uid());
-- inserções via trigger (security definer); sem policy de insert direto.

-- ---------- TRIGGER: audit log -----------------------------------------
create or replace function log_audit()
returns trigger as $$
declare
  v_action text;
  v_actor uuid := auth.uid();
begin
  v_action := TG_OP;
  insert into auditoria(actor_id, action, entity_type, entity_id, details)
  values (
    v_actor,
    v_action || ' ' || TG_TABLE_NAME,
    TG_TABLE_NAME,
    coalesce((case when TG_OP = 'DELETE' then OLD.id else NEW.id end), null),
    case
      when TG_OP = 'UPDATE' then jsonb_build_object('before', to_jsonb(OLD), 'after', to_jsonb(NEW))
      when TG_OP = 'INSERT' then jsonb_build_object('row', to_jsonb(NEW))
      else jsonb_build_object('row', to_jsonb(OLD))
    end
  );
  return coalesce(NEW, OLD);
end;
$$ language plpgsql security definer;

create trigger trg_audit_leads after insert or update or delete on leads
  for each row execute function log_audit();
create trigger trg_audit_casos after insert or update or delete on casos
  for each row execute function log_audit();
create trigger trg_audit_profiles after update on profiles
  for each row execute function log_audit();
create trigger trg_audit_revendas after insert or update on revendas
  for each row execute function log_audit();

-- ---------- VIEW útil: contadores por revenda --------------------------
create or replace view revenda_stats as
  select
    r.id as revenda_id,
    r.nome,
    count(distinct p.id) filter (where p.papel = 'rep' and p.status = 'ativo') as reps_ativos,
    count(distinct l.id) filter (where l.status not in ('fechado','perdido')) as leads_ativos,
    count(distinct l.id) filter (where l.status = 'fechado') as leads_fechados,
    coalesce(sum(l.valor) filter (where l.status = 'fechado'), 0) as valor_fechado
  from revendas r
  left join profiles p on p.revenda_id = r.id
  left join leads l on l.revenda_id = r.id
  group by r.id, r.nome;

-- =====================================================================
-- FIM
-- Próximos passos:
-- 1. Habilitar provider Google em Authentication → Providers
-- 2. Configurar URL de redirect: <seu-domínio>/auth/callback
-- 3. Criar o primeiro admin manualmente:
--    a) Cadastre-se pelo app (qualquer email)
--    b) No SQL editor rode:
--       update profiles set papel = 'admin', status = 'ativo' where email = 'seu@email.com';
-- =====================================================================
