-- Migration 0010 — Quebra recursão infinita nas policies de leads <-> casos
--
-- Problema: leads_advogado_select fazia EXISTS em casos;
-- casos_rep_select / casos_coord_select fazem EXISTS em leads.
-- O Postgres avalia TODAS policies SELECT (com OR), então cada query em
-- leads aciona casos, que aciona leads de volta = infinite recursion.
--
-- Fix: extrai as subqueries em SECURITY DEFINER functions, que rodam com
-- privilégios elevados e bypassam RLS dentro do EXISTS.

-- ---------- Funções helper (security definer = não invocam RLS) ---------

create or replace function user_owns_lead(p_lead_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from leads where id = p_lead_id and rep_id = auth.uid()
  );
$$;

create or replace function lead_in_user_revenda(p_lead_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from leads where id = p_lead_id and revenda_id = current_revenda()
  );
$$;

create or replace function user_has_caso_for_lead(p_lead_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from casos where lead_id = p_lead_id and advogado_id = auth.uid()
  );
$$;

-- ---------- Recria policies sem cross-reference direto ------------------

-- leads: advogado vê leads que têm caso atribuído a ele
drop policy if exists "leads_advogado_select" on leads;
create policy "leads_advogado_select" on leads for select
  using (
    current_papel() = 'advogado'
    and current_ativo()
    and user_has_caso_for_lead(leads.id)
  );

-- casos: rep vê casos dos leads dele
drop policy if exists "casos_rep_select" on casos;
create policy "casos_rep_select" on casos for select
  using (
    current_papel() = 'rep'
    and user_owns_lead(casos.lead_id)
  );

-- casos: coord vê casos dos leads da sua revenda
drop policy if exists "casos_coord_select" on casos;
create policy "casos_coord_select" on casos for select
  using (
    current_papel() = 'coord'
    and lead_in_user_revenda(casos.lead_id)
  );

-- ---------- Grants ------------------------------------------------------

grant execute on function user_owns_lead(uuid) to authenticated;
grant execute on function lead_in_user_revenda(uuid) to authenticated;
grant execute on function user_has_caso_for_lead(uuid) to authenticated;
