-- =====================================================================
-- Migration 0013 — Endurecimento de segurança + lacunas funcionais de RLS
--
-- Resultado da varredura de 2026-11-23. Corrige:
--   [CRÍTICO] usuário comum conseguia virar admin (update/insert no próprio profile)
--   [ALTO]    rep criava caso em lead de outra revenda / já "liberado"
--   [ALTO]    advogado trocava lead_id do caso e lia lead alheio
--   [ALTO]    documentos: row forjada dava acesso a arquivo de terceiros
--   [ALTO]    view revenda_stats ignorava RLS (e somava valor em dobro)
--   [MÉDIO]   aceitar_convite confiava no p_user_id do cliente
--   [MÉDIO]   usuários suspensos/pendentes continuavam lendo dados
--   [MÉDIO]   leads: rep/coord moviam lead para outra revenda / outro rep
--   [MÉDIO]   notas/tarefas/documentos podiam ser criados em lead/caso alheio
--   [FUNC]    admin não via revendas suspensas (não conseguia reativar)
--   [FUNC]    rep/coord não viam nome do advogado nem notas/docs do caso
--   [FUNC]    advogado não via docs anexados no lead do seu caso
--   [FUNC]    faltavam policies de DELETE (documentos, tarefas) e UPDATE (prazos)
--   [FUNC]    notas/documentos/convites/auditoria/prazos fora do realtime
--
-- Idempotente o suficiente para rodar uma vez no SQL Editor do Supabase.
-- =====================================================================

-- ---------- 1. Helpers: search_path fixo + papel só vale se ATIVO ------
-- current_papel() passa a retornar NULL para pendente/suspenso/recusado.
-- Como praticamente toda policy depende de current_papel(), isso fecha
-- de uma vez o acesso de contas não-ativas (inclusive admin suspenso).
create or replace function public.current_papel() returns papel
language sql stable security definer set search_path = public as $$
  select papel from profiles where id = auth.uid() and status = 'ativo'
$$;

create or replace function public.current_revenda() returns uuid
language sql stable security definer set search_path = public as $$
  select revenda_id from profiles where id = auth.uid()
$$;

create or replace function public.current_ativo() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select status = 'ativo' from profiles where id = auth.uid()), false)
$$;

alter function public.log_audit() set search_path = public;
alter function public.set_updated_at() set search_path = public;

-- Acesso a lead/caso (security definer → sem recursão de RLS)
create or replace function public.can_access_lead(p_lead_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select case current_papel()
    when 'admin'    then exists (select 1 from leads where id = p_lead_id)
    when 'rep'      then user_owns_lead(p_lead_id)
    when 'coord'    then lead_in_user_revenda(p_lead_id)
    when 'advogado' then user_has_caso_for_lead(p_lead_id)
    else false
  end
$$;

create or replace function public.can_access_caso(p_caso_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from casos c
     where c.id = p_caso_id
       and case current_papel()
             when 'admin'    then true
             when 'rep'      then user_owns_lead(c.lead_id)
             when 'coord'    then lead_in_user_revenda(c.lead_id)
             when 'advogado' then c.advogado_id = auth.uid()
             else false
           end
  )
$$;

-- Advogado atribuído a algum caso que o usuário corrente enxerga
create or replace function public.advogado_em_caso_visivel(p_advogado_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from casos c
     where c.advogado_id = p_advogado_id
       and case current_papel()
             when 'rep'   then user_owns_lead(c.lead_id)
             when 'coord' then lead_in_user_revenda(c.lead_id)
             else false
           end
  )
$$;

grant execute on function public.can_access_lead(uuid) to authenticated;
grant execute on function public.can_access_caso(uuid) to authenticated;
grant execute on function public.advogado_em_caso_visivel(uuid) to authenticated;

-- ---------- 2. Profiles: bloqueia escalonamento de privilégio ----------
-- Trigger SECURITY INVOKER: só restringe chamadas diretas do cliente
-- (current_user = authenticated/anon). Funções security definer
-- (aceitar_convite), service_role e SQL Editor passam livres.
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
    if new.papel <> 'rep' or new.status <> 'pendente' then
      raise exception 'profile: cadastro público só cria rep pendente' using errcode = '42501';
    end if;
    if v_jwt_email is not null and lower(new.email) <> lower(v_jwt_email) then
      raise exception 'profile: email diferente do da conta' using errcode = '42501';
    end if;
    return new;
  end if;

  -- UPDATE
  if current_papel() = 'admin' then
    return new;
  end if;

  if new.papel is distinct from old.papel
     or new.revenda_id is distinct from old.revenda_id
     or new.email is distinct from old.email
     or new.id is distinct from old.id then
    raise exception 'profile: papel, revenda e email só podem ser alterados por admin' using errcode = '42501';
  end if;

  if old.id = auth.uid() then
    -- próprio usuário: só pode se auto-suspender (LGPD "excluir conta")
    if new.status is distinct from old.status and new.status <> 'suspenso' then
      raise exception 'profile: você não pode alterar o próprio status' using errcode = '42501';
    end if;
    return new;
  end if;

  -- Terceiro não-admin: só coord ativo aprovando/recusando/suspendendo rep
  -- da própria revenda (a policy profiles_coord_approve já limita as linhas).
  if current_papel() = 'coord' and old.papel = 'rep'
     and old.revenda_id = current_revenda() then
    return new;
  end if;

  raise exception 'profile: alteração não permitida' using errcode = '42501';
end;
$$;

drop trigger if exists trg_guard_profile on profiles;
create trigger trg_guard_profile before insert or update on profiles
  for each row execute function public.guard_profile_changes();

-- Rep/Coord enxergam o advogado dos seus casos (nome/OAB na UI)
drop policy if exists "profiles_advogado_visivel" on profiles;
create policy "profiles_advogado_visivel" on profiles for select
  using (papel = 'advogado' and advogado_em_caso_visivel(id));

-- ---------- 3. aceitar_convite: usa auth.uid() e email do auth ---------
create or replace function public.aceitar_convite(p_token text, p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_invite record;
  v_auth_email text;
  v_nome text;
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

  -- Cria o profile se ainda não existir (ex.: falhou no frontend)
  insert into profiles (id, email, nome, papel, status, revenda_id)
  values (v_uid, v_auth_email, v_nome, v_invite.papel, 'ativo', v_invite.revenda_id)
  on conflict (id) do update
     set papel = excluded.papel,
         revenda_id = excluded.revenda_id,
         status = 'ativo';

  update convites set aceito_em = now() where id = v_invite.id;

  if v_invite.papel = 'coord' and v_invite.revenda_id is not null then
    update revendas set coord_id = v_uid
     where id = v_invite.revenda_id and coord_id is null;
  end if;

  return jsonb_build_object('ok', true, 'papel', v_invite.papel);
end;
$$;
grant execute on function public.aceitar_convite(text, uuid) to authenticated;

-- ---------- 4. Revendas ------------------------------------------------
-- Admin precisa ver suspensas (para reativar); coord vê a própria sempre.
drop policy if exists "revendas_admin_select" on revendas;
create policy "revendas_admin_select" on revendas for select
  using (current_papel() = 'admin');
drop policy if exists "revendas_coord_select_own" on revendas;
create policy "revendas_coord_select_own" on revendas for select
  using (id = current_revenda());

-- Coord não altera status/coord_id/nome da revenda; cor precisa ser hex
create or replace function public.guard_revenda_changes() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.cor_primaria is not null and new.cor_primaria !~ '^#[0-9A-Fa-f]{6}$' then
    raise exception 'revenda: cor_primaria deve ser #RRGGBB' using errcode = '22023';
  end if;
  if current_user not in ('authenticated', 'anon') or current_papel() = 'admin' then
    return new;
  end if;
  if tg_op = 'UPDATE' and (new.status is distinct from old.status
      or new.coord_id is distinct from old.coord_id
      or new.nome is distinct from old.nome) then
    raise exception 'revenda: só admin altera status, nome e coordenador' using errcode = '42501';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_guard_revenda on revendas;
create trigger trg_guard_revenda before insert or update on revendas
  for each row execute function public.guard_revenda_changes();

-- View de stats: respeita RLS do chamador e não multiplica valores
drop view if exists revenda_stats;
create view revenda_stats with (security_invoker = true) as
  select
    r.id as revenda_id,
    r.nome,
    (select count(*) from profiles p
      where p.revenda_id = r.id and p.papel = 'rep' and p.status = 'ativo') as reps_ativos,
    (select count(*) from leads l
      where l.revenda_id = r.id and l.status not in ('fechado','perdido')) as leads_ativos,
    (select count(*) from leads l
      where l.revenda_id = r.id and l.status = 'fechado') as leads_fechados,
    (select coalesce(sum(l.valor), 0) from leads l
      where l.revenda_id = r.id and l.status = 'fechado') as valor_fechado
  from revendas r;
revoke all on revenda_stats from anon;

-- ---------- 5. Leads: update não pode mudar dono/revenda ---------------
drop policy if exists "leads_rep_update" on leads;
create policy "leads_rep_update" on leads for update
  using (current_papel() = 'rep' and rep_id = auth.uid())
  with check (rep_id = auth.uid() and revenda_id = current_revenda());

drop policy if exists "leads_coord_update" on leads;
create policy "leads_coord_update" on leads for update
  using (current_papel() = 'coord' and revenda_id = current_revenda())
  with check (
    revenda_id = current_revenda()
    and exists (select 1 from profiles p where p.id = rep_id and p.revenda_id = current_revenda())
  );

-- ---------- 6. Casos ---------------------------------------------------
-- Insert: só em lead que o usuário controla, sempre "recebido"
drop policy if exists "casos_insert_rep" on casos;
drop policy if exists "casos_insert_scoped" on casos;
create policy "casos_insert_scoped" on casos for insert
  with check (
    current_papel() = 'admin'
    or (
      status = 'recebido'
      and advogado_id is null
      and (
        (current_papel() = 'rep'   and user_owns_lead(lead_id))
        or (current_papel() = 'coord' and lead_in_user_revenda(lead_id))
      )
    )
  );

-- Advogado não pode reapontar o caso para outro lead
create or replace function public.guard_caso_changes() returns trigger
language plpgsql set search_path = public as $$
begin
  if current_user not in ('authenticated', 'anon') or current_papel() = 'admin' then
    return new;
  end if;
  if new.lead_id is distinct from old.lead_id then
    raise exception 'caso: lead_id não pode ser alterado' using errcode = '42501';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_guard_caso on casos;
create trigger trg_guard_caso before update on casos
  for each row execute function public.guard_caso_changes();

drop policy if exists "casos_update_advogado" on casos;
create policy "casos_update_advogado" on casos for update
  using (current_papel() = 'advogado' and advogado_id = auth.uid())
  with check (advogado_id = auth.uid());

-- ---------- 7. Notas ---------------------------------------------------
drop policy if exists "notas_select" on notas;
create policy "notas_select" on notas for select
  using (
    autor_id = auth.uid()
    or current_papel() = 'admin'
    or (
      not interno and (
        (lead_id is not null and can_access_lead(lead_id))
        or (caso_id is not null and can_access_caso(caso_id))
      )
    )
    or (
      interno and current_papel() = 'advogado'
      and caso_id is not null and can_access_caso(caso_id)
    )
  );

drop policy if exists "notas_insert_self" on notas;
create policy "notas_insert_self" on notas for insert
  with check (
    autor_id = auth.uid() and current_ativo()
    and (lead_id is null or can_access_lead(lead_id))
    and (caso_id is null or can_access_caso(caso_id))
    and (not interno or current_papel() in ('advogado', 'admin'))
  );

-- ---------- 8. Tarefas -------------------------------------------------
drop policy if exists "tarefas_insert_self" on tarefas;
create policy "tarefas_insert_self" on tarefas for insert
  with check (
    autor_id = auth.uid() and current_ativo()
    and (lead_id is null or can_access_lead(lead_id))
    and (caso_id is null or can_access_caso(caso_id))
  );

drop policy if exists "tarefas_update_self" on tarefas;
create policy "tarefas_update_self" on tarefas for update
  using (autor_id = auth.uid() or current_papel() = 'admin')
  with check (autor_id = auth.uid() or current_papel() = 'admin');

drop policy if exists "tarefas_delete_self" on tarefas;
create policy "tarefas_delete_self" on tarefas for delete
  using (autor_id = auth.uid() or current_papel() = 'admin');

-- ---------- 9. Documentos ----------------------------------------------
drop policy if exists "documentos_select" on documentos;
create policy "documentos_select" on documentos for select
  using (
    current_papel() is not null and (
      uploaded_by = auth.uid()
      or (lead_id is not null and can_access_lead(lead_id))
      or (caso_id is not null and can_access_caso(caso_id))
    )
  );

-- Path obrigatoriamente dentro da pasta do lead/caso ao qual o usuário tem acesso
drop policy if exists "documentos_insert" on documentos;
create policy "documentos_insert" on documentos for insert
  with check (
    uploaded_by = auth.uid() and current_ativo()
    and (
      (lead_id is not null and caso_id is null and can_access_lead(lead_id)
        and storage_path like 'leads/' || lead_id::text || '/%')
      or
      (caso_id is not null and lead_id is null and can_access_caso(caso_id)
        and storage_path like 'casos/' || caso_id::text || '/%')
    )
  );

drop policy if exists "documentos_delete" on documentos;
create policy "documentos_delete" on documentos for delete
  using (uploaded_by = auth.uid() or current_papel() = 'admin');

-- Storage: upload só em pasta de lead/caso acessível, por usuário ativo
drop policy if exists "docs_insert" on storage.objects;
create policy "docs_insert" on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'documentos'
    and public.current_ativo()
    and (
      ((storage.foldername(name))[1] = 'leads'
        and public.can_access_lead(((storage.foldername(name))[2])::uuid))
      or
      ((storage.foldername(name))[1] = 'casos'
        and public.can_access_caso(((storage.foldername(name))[2])::uuid))
    )
  );

-- ---------- 10. Prazos -------------------------------------------------
drop policy if exists "prazos_select" on prazos;
create policy "prazos_select" on prazos for select
  using (can_access_caso(caso_id));

drop policy if exists "prazos_insert_advogado" on prazos;
create policy "prazos_insert_advogado" on prazos for insert
  with check (current_papel() in ('advogado', 'admin') and can_access_caso(caso_id));

drop policy if exists "prazos_update_advogado" on prazos;
create policy "prazos_update_advogado" on prazos for update
  using (current_papel() in ('advogado', 'admin') and can_access_caso(caso_id))
  with check (can_access_caso(caso_id));

drop policy if exists "prazos_delete_advogado" on prazos;
create policy "prazos_delete_advogado" on prazos for delete
  using (current_papel() in ('advogado', 'admin') and can_access_caso(caso_id));

-- ---------- 11. Convites -----------------------------------------------
drop policy if exists "convites_coord_rep" on convites;
create policy "convites_coord_rep" on convites for insert
  with check (
    current_papel() = 'coord'
    and invited_by = auth.uid()
    and papel = 'rep'
    and revenda_id = current_revenda()
  );

drop policy if exists "convites_coord_select" on convites;
create policy "convites_coord_select" on convites for select
  using (
    current_papel() = 'admin'
    or (current_papel() = 'coord' and revenda_id = current_revenda())
  );

drop policy if exists "convites_coord_delete" on convites;
create policy "convites_coord_delete" on convites for delete
  using (current_papel() = 'coord' and revenda_id = current_revenda() and aceito_em is null);

-- ---------- 12. Realtime nas tabelas que o frontend assina -------------
do $$
declare t text;
begin
  foreach t in array array['notas', 'documentos', 'convites', 'auditoria', 'prazos'] loop
    if not exists (
      select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
