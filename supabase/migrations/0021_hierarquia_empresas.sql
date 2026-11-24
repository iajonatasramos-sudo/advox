-- =====================================================================
-- Hierarquia comercial por empresa
--
--   Admin (Advox)                      vê tudo, cria empresas
--   └─ Empresa  (nasce com a revenda sede; pode ter outras revendas)
--      └─ Proprietário                 dono da empresa: cria revendas,
--         │                            define função, aloca em revenda,
--         │                            põe coordenadores sob gerentes
--         └─ Gerente                   põe consultores sob coordenadores
--            └─ Coordenador            aprova/convida consultores
--               └─ Consultor ('rep')   só o que é dele
--
-- Cada um vê o que é seu + o de todo mundo abaixo dele (superior_id).
-- O proprietário vê a empresa inteira. Advogado e admin não mudam.
-- =====================================================================

-- ---------- 1. Tabelas e colunas --------------------------------------
create table if not exists empresas (
  id              uuid primary key default gen_random_uuid(),
  nome            text not null,
  cnpj            text,
  status          conta_status not null default 'ativo',
  proprietario_id uuid references profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
drop trigger if exists trg_empresas_updated on empresas;
create trigger trg_empresas_updated before update on empresas
  for each row execute function set_updated_at();
drop trigger if exists trg_audit_empresas on empresas;
create trigger trg_audit_empresas after insert or update on empresas
  for each row execute function log_audit();
alter table empresas enable row level security;

alter table revendas add column if not exists empresa_id uuid references empresas(id) on delete restrict;
alter table revendas add column if not exists sede boolean not null default false;
alter table profiles add column if not exists empresa_id uuid references empresas(id) on delete set null;
alter table profiles add column if not exists superior_id uuid references profiles(id) on delete set null;
alter table convites add column if not exists empresa_id uuid references empresas(id) on delete cascade;
alter table convites add column if not exists superior_id uuid references profiles(id) on delete set null;

create index if not exists idx_profiles_superior on profiles(superior_id);
create index if not exists idx_profiles_empresa on profiles(empresa_id);
create index if not exists idx_revendas_empresa on revendas(empresa_id);

-- Cada revenda existente vira a sede da sua própria empresa.
do $$
declare r record; v_emp uuid;
begin
  for r in select * from revendas where empresa_id is null loop
    insert into empresas (nome, cnpj, status) values (r.nome, r.cnpj, r.status) returning id into v_emp;
    update revendas set empresa_id = v_emp, sede = true where id = r.id;
  end loop;
end $$;
alter table revendas alter column empresa_id set not null;
create unique index if not exists uq_revendas_sede on revendas(empresa_id) where sede;

update profiles p set empresa_id = r.empresa_id from revendas r where p.revenda_id = r.id and p.empresa_id is null;
update profiles p set superior_id = r.coord_id
  from revendas r
 where p.revenda_id = r.id and p.papel = 'rep' and p.superior_id is null
   and r.coord_id is not null and r.coord_id <> p.id;
update convites c set empresa_id = r.empresa_id from revendas r where c.revenda_id = r.id and c.empresa_id is null;

-- ---------- 2. Funções de apoio ---------------------------------------
create or replace function public.rank_papel(p papel) returns int
language sql immutable set search_path = public as $$
  select case p::text when 'proprietario' then 4 when 'gerente' then 3
                      when 'coord' then 2 when 'rep' then 1 else 0 end
$$;

create or replace function public.current_empresa() returns uuid
language sql stable security definer set search_path = public as $$
  select empresa_id from profiles where id = auth.uid()
$$;

create or replace function public.is_comercial() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(current_papel()::text in ('proprietario','gerente','coord','rep'), false)
$$;

create or replace function public.is_gestor() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(current_papel()::text in ('proprietario','gerente','coord'), false)
$$;

create or replace function public.revendas_da_empresa() returns setof uuid
language sql stable security definer set search_path = public as $$
  select id from revendas where empresa_id = current_empresa()
$$;

-- Eu + todos abaixo de mim na árvore de superior_id.
create or replace function public.minha_equipe() returns setof uuid
language sql stable security definer set search_path = public as $$
  with recursive t(id) as (
    select auth.uid()
    union
    select p.id from profiles p join t on p.superior_id = t.id
  )
  select id from t where id is not null
$$;

-- Quem eu enxergo: minha equipe; o proprietário, a empresa inteira.
create or replace function public.equipe_visivel() returns setof uuid
language sql stable security definer set search_path = public as $$
  select m from minha_equipe() as m
  union
  select id from profiles
   where current_papel() = 'proprietario' and empresa_id = current_empresa()
$$;

-- Superior válido: consultor → coordenador; coordenador → gerente; mesma empresa.
create or replace function public.superior_valido(p_papel papel, p_superior uuid, p_empresa uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select p_superior is null or exists (
    select 1 from profiles s
     where s.id = p_superior
       and s.empresa_id is not distinct from p_empresa
       and ((p_papel = 'rep' and s.papel = 'coord') or (p_papel = 'coord' and s.papel = 'gerente'))
  )
$$;

-- Lead visível pela hierarquia comercial.
create or replace function public.lead_visivel(p_lead_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from leads l
     where l.id = p_lead_id
       and (l.rep_id in (select equipe_visivel())
            or (current_papel() = 'proprietario' and l.revenda_id in (select revendas_da_empresa())))
  )
$$;

-- Cadeia acima de alguém (coordenador, gerente…) para notificações.
create or replace function public.cadeia_acima(p_id uuid) returns setof uuid
language sql stable security definer set search_path = public as $$
  with recursive t(id, sup, n) as (
    select id, superior_id, 0 from profiles where id = p_id
    union all
    select p.id, p.superior_id, t.n + 1 from profiles p join t on p.id = t.sup where t.n < 10
  )
  select id from t where id <> p_id
$$;

-- Funções antigas passam a usar a hierarquia.
create or replace function public.can_access_lead(p_lead_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when current_papel() = 'admin'    then exists (select 1 from leads where id = p_lead_id)
    when current_papel() = 'advogado' then user_has_caso_for_lead(p_lead_id)
    when is_comercial()               then lead_visivel(p_lead_id)
    else false
  end
$$;

create or replace function public.can_access_caso(p_caso_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from casos c
     where c.id = p_caso_id
       and case
             when current_papel() = 'admin'    then true
             when current_papel() = 'advogado' then c.advogado_id = auth.uid()
             when is_comercial()               then lead_visivel(c.lead_id)
             else false
           end
  )
$$;

create or replace function public.advogado_em_caso_visivel(p_advogado_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select is_comercial() and exists (
    select 1 from casos c where c.advogado_id = p_advogado_id and lead_visivel(c.lead_id)
  )
$$;

-- ---------- 3. Gatilhos de proteção -----------------------------------
-- Hierarquia sempre coerente (vale para qualquer origem da escrita).
create or replace function public.valida_hierarquia() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.empresa_id is null and new.revenda_id is not null then
    select empresa_id into new.empresa_id from revendas where id = new.revenda_id;
  end if;
  if new.papel::text not in ('rep','coord') then
    new.superior_id := null;
  end if;
  if new.superior_id is not null and not superior_valido(new.papel, new.superior_id, new.empresa_id) then
    raise exception 'hierarquia: superior inválido para essa função' using errcode = '22023';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_valida_hierarquia on profiles;
create trigger trg_valida_hierarquia before insert or update on profiles
  for each row execute function public.valida_hierarquia();

-- Cliente direto só altera o próprio perfil e nunca papel/empresa/time.
-- Aprovar, mudar função, time e revenda passam pelas funções da seção 6.
create or replace function public.guard_profile_changes() returns trigger
language plpgsql set search_path = public as $$
declare
  v_jwt_email text := auth.jwt() ->> 'email';
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.id is distinct from auth.uid() then
      raise exception 'profile: só é possível criar o próprio perfil' using errcode = '42501';
    end if;
    if new.papel <> 'rep' or new.status <> 'pendente' or new.superior_id is not null then
      raise exception 'profile: cadastro público só cria consultor pendente' using errcode = '42501';
    end if;
    if v_jwt_email is not null and lower(new.email) <> lower(v_jwt_email) then
      raise exception 'profile: email diferente do da conta' using errcode = '42501';
    end if;
    return new;
  end if;

  if current_papel() = 'admin' then
    return new;
  end if;

  if new.papel is distinct from old.papel
     or new.revenda_id is distinct from old.revenda_id
     or new.empresa_id is distinct from old.empresa_id
     or new.superior_id is distinct from old.superior_id
     or new.email is distinct from old.email
     or new.id is distinct from old.id then
    raise exception 'profile: função, revenda e time só mudam pela gestão da equipe' using errcode = '42501';
  end if;

  if old.id = auth.uid() then
    if new.status is distinct from old.status and new.status <> 'suspenso' then
      raise exception 'profile: você não pode alterar o próprio status' using errcode = '42501';
    end if;
    return new;
  end if;

  raise exception 'profile: alteração não permitida' using errcode = '42501';
end;
$$;

-- Revenda: proprietário edita as da própria empresa (sem trocar empresa/sede/status).
create or replace function public.guard_revenda_changes() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.cor_primaria is not null and new.cor_primaria !~ '^#[0-9A-Fa-f]{6}$' then
    raise exception 'revenda: cor_primaria deve ser #RRGGBB' using errcode = '22023';
  end if;
  if current_user not in ('authenticated', 'anon') or current_papel() = 'admin' then
    return new;
  end if;
  if current_papel() = 'proprietario' and new.empresa_id = current_empresa() then
    if tg_op = 'INSERT' then
      if new.sede then raise exception 'revenda: a sede já existe' using errcode = '42501'; end if;
      return new;
    end if;
    if new.empresa_id is distinct from old.empresa_id or new.sede is distinct from old.sede
       or new.status is distinct from old.status or new.coord_id is distinct from old.coord_id then
      raise exception 'revenda: só o admin altera empresa, sede e status' using errcode = '42501';
    end if;
    return new;
  end if;
  raise exception 'revenda: só o proprietário altera as revendas da empresa' using errcode = '42501';
end;
$$;

-- ---------- 4. Políticas (RLS) ----------------------------------------
-- empresas
drop policy if exists "empresas_select" on empresas;
create policy "empresas_select" on empresas for select
  using (current_papel() = 'admin' or id = current_empresa());
drop policy if exists "empresas_admin_all" on empresas;
create policy "empresas_admin_all" on empresas for all
  using (current_papel() = 'admin') with check (current_papel() = 'admin');
drop policy if exists "empresas_proprietario_update" on empresas;
create policy "empresas_proprietario_update" on empresas for update
  using (current_papel() = 'proprietario' and id = current_empresa())
  with check (id = current_empresa() and proprietario_id is not distinct from auth.uid());

-- revendas
drop policy if exists "revendas_coord_create_own" on revendas;
drop policy if exists "revendas_coord_update_own" on revendas;
drop policy if exists "revendas_empresa_select" on revendas;
create policy "revendas_empresa_select" on revendas for select
  using (empresa_id = current_empresa());
drop policy if exists "revendas_proprietario_insert" on revendas;
create policy "revendas_proprietario_insert" on revendas for insert
  with check (current_papel() = 'proprietario' and empresa_id = current_empresa() and not sede);
drop policy if exists "revendas_proprietario_update" on revendas;
create policy "revendas_proprietario_update" on revendas for update
  using (current_papel() = 'proprietario' and empresa_id = current_empresa())
  with check (empresa_id = current_empresa());

-- profiles
drop policy if exists "profiles_coord_select" on profiles;
drop policy if exists "profiles_coord_approve" on profiles;
drop policy if exists "profiles_equipe_select" on profiles;
create policy "profiles_equipe_select" on profiles for select
  using (
    current_ativo() and is_comercial() and (
      id in (select equipe_visivel())
      -- pendentes da revenda (coord) / da empresa (gerente, proprietário) para aprovar
      or (status = 'pendente' and is_gestor()
          and (revenda_id = current_revenda()
               or (current_papel() in ('gerente','proprietario') and empresa_id = current_empresa())))
      -- consultores sem time, para o gerente distribuir
      or (current_papel() = 'gerente' and empresa_id = current_empresa() and superior_id is null and papel = 'rep')
      -- meus superiores (para o organograma)
      or id in (select cadeia_acima(auth.uid()))
    )
  );

-- leads
drop policy if exists "leads_rep_select" on leads;
drop policy if exists "leads_coord_select" on leads;
drop policy if exists "leads_rep_insert" on leads;
drop policy if exists "leads_coord_insert" on leads;
drop policy if exists "leads_rep_update" on leads;
drop policy if exists "leads_coord_update" on leads;
drop policy if exists "leads_equipe_select" on leads;
create policy "leads_equipe_select" on leads for select
  using (
    current_ativo() and is_comercial() and (
      rep_id in (select equipe_visivel())
      or (current_papel() = 'proprietario' and revenda_id in (select revendas_da_empresa()))
    )
  );
drop policy if exists "leads_equipe_insert" on leads;
create policy "leads_equipe_insert" on leads for insert
  with check (
    current_ativo() and is_comercial()
    and rep_id in (select equipe_visivel())
    and revenda_id in (select revendas_da_empresa())
    and (current_papel() <> 'rep' or revenda_id = current_revenda())
  );
drop policy if exists "leads_equipe_update" on leads;
create policy "leads_equipe_update" on leads for update
  using (
    current_ativo() and is_comercial() and (
      rep_id in (select equipe_visivel())
      or (current_papel() = 'proprietario' and revenda_id in (select revendas_da_empresa()))
    )
  )
  with check (
    rep_id in (select equipe_visivel())
    and revenda_id in (select revendas_da_empresa())
    and (current_papel() <> 'rep' or revenda_id = current_revenda())
  );

-- casos
drop policy if exists "casos_rep_select" on casos;
drop policy if exists "casos_coord_select" on casos;
drop policy if exists "casos_equipe_select" on casos;
create policy "casos_equipe_select" on casos for select
  using (is_comercial() and lead_visivel(lead_id));
drop policy if exists "casos_insert_scoped" on casos;
create policy "casos_insert_scoped" on casos for insert
  with check (
    current_papel() = 'admin'
    or (status = 'recebido' and advogado_id is null and is_comercial() and lead_visivel(lead_id))
  );

-- tarefas
drop policy if exists "tarefas_select" on tarefas;
create policy "tarefas_select" on tarefas for select
  using (
    autor_id = auth.uid()
    or current_papel() = 'admin'
    or (lead_id is not null and is_comercial() and lead_visivel(lead_id))
  );

-- contatos do WhatsApp
drop policy if exists "wa_contatos_select" on wa_contatos;
create policy "wa_contatos_select" on wa_contatos for select
  using (
    current_ativo() and (
      dono_id = (select auth.uid())
      or current_papel() = 'admin'
      or (is_gestor() and dono_id in (select equipe_visivel()))
    )
  );

-- mensagens rápidas / categorias compartilhadas com a revenda: qualquer gestor
drop policy if exists "mensagens_rapidas_insert" on mensagens_rapidas;
create policy "mensagens_rapidas_insert" on mensagens_rapidas for insert
  with check ((dono_id = (select auth.uid())) and current_ativo()
    and (revenda_id is null or (is_gestor() and revenda_id = current_revenda())));
drop policy if exists "mensagens_rapidas_update" on mensagens_rapidas;
create policy "mensagens_rapidas_update" on mensagens_rapidas for update
  using ((dono_id = (select auth.uid())) and current_ativo())
  with check ((dono_id = (select auth.uid()))
    and (revenda_id is null or (is_gestor() and revenda_id = current_revenda())));
drop policy if exists "mensagens_categorias_insert" on mensagens_categorias;
create policy "mensagens_categorias_insert" on mensagens_categorias for insert
  with check ((dono_id = (select auth.uid())) and current_ativo()
    and (revenda_id is null or (is_gestor() and revenda_id = current_revenda())));
drop policy if exists "mensagens_categorias_update" on mensagens_categorias;
create policy "mensagens_categorias_update" on mensagens_categorias for update
  using ((dono_id = (select auth.uid())) and current_ativo())
  with check ((dono_id = (select auth.uid()))
    and (revenda_id is null or (is_gestor() and revenda_id = current_revenda())));

-- convites
drop policy if exists "convites_coord_rep" on convites;
drop policy if exists "convites_coord_select" on convites;
drop policy if exists "convites_coord_delete" on convites;
drop policy if exists "convites_equipe_insert" on convites;
create policy "convites_equipe_insert" on convites for insert
  with check (
    current_ativo() and is_gestor()
    and invited_by = auth.uid()
    and empresa_id = current_empresa()
    and rank_papel(papel) between 1 and rank_papel(current_papel()) - 1
    and revenda_id in (select revendas_da_empresa())
    and (current_papel() <> 'coord' or revenda_id = current_revenda())
    and (superior_id is null or superior_id in (select equipe_visivel()))
    and superior_valido(papel, superior_id, empresa_id)
  );
drop policy if exists "convites_equipe_select" on convites;
create policy "convites_equipe_select" on convites for select
  using (
    current_papel() = 'admin'
    or (is_gestor() and empresa_id = current_empresa() and invited_by in (select equipe_visivel()))
  );
drop policy if exists "convites_equipe_delete" on convites;
create policy "convites_equipe_delete" on convites for delete
  using (
    aceito_em is null and is_gestor() and empresa_id = current_empresa()
    and invited_by in (select equipe_visivel())
  );

-- logos das revendas: proprietário da empresa
drop policy if exists "revenda-logos-write" on storage.objects;
create policy "revenda-logos-write" on storage.objects for insert
  with check (bucket_id = 'revenda-logos' and (current_papel() = 'admin'
    or (current_papel() = 'proprietario'
        and (storage.foldername(name))[1] in (select id::text from revendas_da_empresa() as id))));
drop policy if exists "revenda-logos-update" on storage.objects;
create policy "revenda-logos-update" on storage.objects for update
  using (bucket_id = 'revenda-logos' and (current_papel() = 'admin'
    or (current_papel() = 'proprietario'
        and (storage.foldername(name))[1] in (select id::text from revendas_da_empresa() as id))));
drop policy if exists "revenda-logos-delete" on storage.objects;
create policy "revenda-logos-delete" on storage.objects for delete
  using (bucket_id = 'revenda-logos' and (current_papel() = 'admin'
    or (current_papel() = 'proprietario'
        and (storage.foldername(name))[1] in (select id::text from revendas_da_empresa() as id))));

-- ---------- 5. Convite e notificações ---------------------------------
create or replace function public.aceitar_convite(p_token text, p_user_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_invite record;
  v_auth_email text;
  v_nome text;
  v_empresa uuid;
  v_superior uuid;
begin
  if v_uid is null or p_user_id is distinct from v_uid then
    return jsonb_build_object('error', 'nao_autorizado');
  end if;

  select * into v_invite from convites
   where token = p_token and aceito_em is null and expira_em > now()
   for update;
  if v_invite.id is null then
    return jsonb_build_object('error', 'invalido_ou_expirado');
  end if;

  select email, coalesce(nullif(trim(raw_user_meta_data->>'nome'), ''), split_part(email, '@', 1))
    into v_auth_email, v_nome
    from auth.users where id = v_uid;
  if v_auth_email is null or lower(v_auth_email) <> lower(v_invite.email) then
    return jsonb_build_object('error', 'email_nao_bate');
  end if;

  v_empresa := coalesce(v_invite.empresa_id, (select empresa_id from revendas where id = v_invite.revenda_id));
  v_superior := case when superior_valido(v_invite.papel, v_invite.superior_id, v_empresa)
                     then v_invite.superior_id end;

  insert into profiles (id, email, nome, papel, status, revenda_id, empresa_id, superior_id)
  values (v_uid, v_auth_email, v_nome, v_invite.papel, 'ativo', v_invite.revenda_id, v_empresa, v_superior)
  on conflict (id) do update
     set papel = excluded.papel,
         revenda_id = excluded.revenda_id,
         empresa_id = excluded.empresa_id,
         superior_id = excluded.superior_id,
         status = 'ativo';

  update convites set aceito_em = now() where id = v_invite.id;

  if v_invite.papel = 'proprietario' and v_empresa is not null then
    update empresas set proprietario_id = v_uid where id = v_empresa and proprietario_id is null;
  end if;

  return jsonb_build_object('ok', true, 'papel', v_invite.papel);
end;
$$;

create or replace function public.notif_caso_status_change() returns trigger
language plpgsql security definer set search_path = public as $$
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

  -- O consultor do lead e toda a cadeia acima dele (coordenador, gerente)
  insert into notificacoes (user_id, tipo, titulo, texto, link, entity_type, entity_id)
  select u, v_tipo, v_titulo, v_texto, '/casos/' || new.id, 'caso', new.id
    from (select v_lead.rep_id as u union select cadeia_acima(v_lead.rep_id)) x;

  return new;
end;
$$;

-- ---------- 6. Gestão da equipe (RPC) ---------------------------------
-- Todas checam permissão e gravam na auditoria pelo trigger de profiles.

-- Cria empresa com a revenda sede (só admin).
create or replace function public.criar_empresa(p_nome text, p_cnpj text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_emp uuid; v_rev uuid;
begin
  if current_papel() is distinct from 'admin' then
    return jsonb_build_object('error', 'Só o administrador cria empresas');
  end if;
  if coalesce(trim(p_nome), '') = '' then
    return jsonb_build_object('error', 'Informe o nome da empresa');
  end if;
  if exists (select 1 from revendas where lower(nome) = lower(trim(p_nome))) then
    return jsonb_build_object('error', 'Já existe uma revenda com esse nome');
  end if;
  insert into empresas (nome, cnpj) values (trim(p_nome), nullif(trim(p_cnpj), '')) returning id into v_emp;
  insert into revendas (nome, cnpj, empresa_id, sede) values (trim(p_nome), nullif(trim(p_cnpj), ''), v_emp, true) returning id into v_rev;
  return jsonb_build_object('ok', true, 'empresa_id', v_emp, 'revenda_id', v_rev);
end;
$$;

-- Alvo que o chamador pode gerir (abaixo dele, mesma empresa).
create or replace function public.pode_gerir(p_alvo uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select current_papel() = 'admin' or exists (
    select 1 from profiles a
     where a.id = p_alvo and a.id <> auth.uid()
       and a.empresa_id = current_empresa()
       and rank_papel(a.papel) < rank_papel(current_papel())
       and (a.id in (select equipe_visivel())
            or (a.status = 'pendente' and is_gestor()
                and (a.revenda_id = current_revenda() or current_papel() in ('gerente','proprietario')))
            or (current_papel() = 'gerente' and a.papel = 'rep' and a.superior_id is null))
  )
$$;

-- Aprovar / recusar cadastro pendente (e já colocar no time).
create or replace function public.aprovar_membro(p_alvo uuid, p_aprovar boolean, p_superior uuid default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_alvo profiles; v_sup uuid := p_superior;
begin
  select * into v_alvo from profiles where id = p_alvo;
  if v_alvo.id is null or v_alvo.status <> 'pendente' or not pode_gerir(p_alvo) then
    return jsonb_build_object('error', 'Você não pode aprovar esse cadastro');
  end if;
  if not p_aprovar then
    update profiles set status = 'recusado' where id = p_alvo;
    return jsonb_build_object('ok', true);
  end if;
  if current_papel() = 'coord' then v_sup := auth.uid(); end if;
  if v_sup is not null and current_papel() <> 'admin' and v_sup not in (select equipe_visivel()) then
    return jsonb_build_object('error', 'Escolha um coordenador do seu time');
  end if;
  if not superior_valido(v_alvo.papel, v_sup, v_alvo.empresa_id) then
    return jsonb_build_object('error', 'O consultor só pode ficar no time de um coordenador');
  end if;
  update profiles set status = 'ativo', superior_id = v_sup where id = p_alvo;
  return jsonb_build_object('ok', true);
end;
$$;

-- Colocar no time: proprietário põe coordenador sob gerente;
-- gerente (e proprietário) põe consultor sob coordenador.
create or replace function public.definir_superior(p_alvo uuid, p_superior uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_alvo profiles;
begin
  select * into v_alvo from profiles where id = p_alvo;
  if v_alvo.id is null or not pode_gerir(p_alvo) then
    return jsonb_build_object('error', 'Você não pode mudar o time dessa pessoa');
  end if;
  if v_alvo.papel = 'coord' and current_papel() not in ('proprietario', 'admin') then
    return jsonb_build_object('error', 'Só o proprietário coloca coordenadores no time de um gerente');
  end if;
  if v_alvo.papel = 'rep' and current_papel() not in ('gerente', 'proprietario', 'admin') then
    return jsonb_build_object('error', 'Só o gerente ou o proprietário mudam o consultor de time');
  end if;
  if v_alvo.papel not in ('rep', 'coord') then
    return jsonb_build_object('error', 'Essa função não fica no time de ninguém');
  end if;
  if p_superior is not null and current_papel() <> 'admin' and p_superior not in (select equipe_visivel()) then
    return jsonb_build_object('error', 'Escolha alguém do seu time');
  end if;
  if not superior_valido(v_alvo.papel, p_superior, v_alvo.empresa_id) then
    return jsonb_build_object('error', case v_alvo.papel when 'rep'
      then 'O consultor só pode ficar no time de um coordenador'
      else 'O coordenador só pode ficar no time de um gerente' end);
  end if;
  update profiles set superior_id = p_superior where id = p_alvo;
  return jsonb_build_object('ok', true);
end;
$$;

-- Mudar a função (só proprietário). Quem mudou de função sai do time e
-- quem estava abaixo dela fica sem time até ser redistribuído.
create or replace function public.definir_funcao(p_alvo uuid, p_papel papel) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_alvo profiles;
begin
  select * into v_alvo from profiles where id = p_alvo;
  if v_alvo.id is null or current_papel() not in ('proprietario', 'admin')
     or (current_papel() = 'proprietario' and (v_alvo.empresa_id is distinct from current_empresa() or v_alvo.id = auth.uid())) then
    return jsonb_build_object('error', 'Só o proprietário muda a função das pessoas da empresa');
  end if;
  if p_papel::text not in ('gerente', 'coord', 'rep') or v_alvo.papel::text not in ('gerente', 'coord', 'rep') then
    return jsonb_build_object('error', 'Função inválida');
  end if;
  if p_papel = v_alvo.papel then return jsonb_build_object('ok', true); end if;
  update profiles set superior_id = null where superior_id = p_alvo;
  update profiles set papel = p_papel, superior_id = null where id = p_alvo;
  return jsonb_build_object('ok', true);
end;
$$;

-- Alocar em revenda (só proprietário, revendas da própria empresa).
create or replace function public.alocar_revenda(p_alvo uuid, p_revenda uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_alvo profiles; v_emp uuid;
begin
  select * into v_alvo from profiles where id = p_alvo;
  select empresa_id into v_emp from revendas where id = p_revenda;
  if v_alvo.id is null or v_emp is null or current_papel() not in ('proprietario', 'admin')
     or (current_papel() = 'proprietario' and (v_alvo.empresa_id is distinct from current_empresa() or v_emp <> current_empresa())) then
    return jsonb_build_object('error', 'Só o proprietário aloca pessoas nas revendas da empresa');
  end if;
  if v_alvo.empresa_id is distinct from v_emp then
    return jsonb_build_object('error', 'A revenda é de outra empresa');
  end if;
  update profiles set revenda_id = p_revenda where id = p_alvo;
  return jsonb_build_object('ok', true);
end;
$$;

-- Suspender / reativar alguém abaixo de mim.
create or replace function public.definir_status_membro(p_alvo uuid, p_status conta_status) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if p_status not in ('ativo', 'suspenso') then
    return jsonb_build_object('error', 'Status inválido');
  end if;
  if not pode_gerir(p_alvo) then
    return jsonb_build_object('error', 'Você não pode alterar essa pessoa');
  end if;
  update profiles set status = p_status where id = p_alvo;
  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.criar_empresa(text, text) from public, anon;
revoke all on function public.aprovar_membro(uuid, boolean, uuid) from public, anon;
revoke all on function public.definir_superior(uuid, uuid) from public, anon;
revoke all on function public.definir_funcao(uuid, papel) from public, anon;
revoke all on function public.alocar_revenda(uuid, uuid) from public, anon;
revoke all on function public.definir_status_membro(uuid, conta_status) from public, anon;
grant execute on function public.criar_empresa(text, text) to authenticated;
grant execute on function public.aprovar_membro(uuid, boolean, uuid) to authenticated;
grant execute on function public.definir_superior(uuid, uuid) to authenticated;
grant execute on function public.definir_funcao(uuid, papel) to authenticated;
grant execute on function public.alocar_revenda(uuid, uuid) to authenticated;
grant execute on function public.definir_status_membro(uuid, conta_status) to authenticated;

-- Realtime
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'empresas') then
    alter publication supabase_realtime add table empresas;
  end if;
end $$;
