-- =====================================================================
-- Sistema de convites: RPC functions seguras para uso público/autenticado.
--
-- Por que RPC? Convites têm um caso específico:
--   - A pessoa convidada AINDA NÃO ESTÁ LOGADA
--   - Precisa ver os dados do convite (email, papel, revenda) antes
--     de criar a conta
--   - Não queremos expor a tabela convites para anon (risco de enumerar)
--
-- Por isso, expomos duas funções security-definer que validam o token:
--   - get_invite(token)        → retorna dados do convite (público)
--   - aceitar_convite(token,uid) → marca convite como aceito e ativa o profile
-- =====================================================================

-- ---------- get_invite (público) -------------------------------------
create or replace function public.get_invite(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row record;
  v_revenda_nome text;
begin
  select c.*, r.nome as revenda_nome
    into v_row
  from convites c
  left join revendas r on r.id = c.revenda_id
  where c.token = p_token;

  if v_row.id is null then
    return jsonb_build_object('error', 'invalido');
  end if;
  if v_row.aceito_em is not null then
    return jsonb_build_object('error', 'usado');
  end if;
  if v_row.expira_em < now() then
    return jsonb_build_object('error', 'expirado');
  end if;

  return jsonb_build_object(
    'id', v_row.id,
    'email', v_row.email,
    'papel', v_row.papel,
    'revenda_id', v_row.revenda_id,
    'revenda_nome', v_row.revenda_nome,
    'expira_em', v_row.expira_em
  );
end;
$$;

grant execute on function public.get_invite(text) to anon, authenticated;

-- ---------- aceitar_convite ------------------------------------------
-- Chamado pelo frontend logo após o signUp() do usuário convidado.
-- Atualiza o profile com papel/revenda do convite e marca como ativo.
create or replace function public.aceitar_convite(p_token text, p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite record;
  v_profile_email text;
begin
  -- Validar convite
  select * into v_invite from convites
   where token = p_token and aceito_em is null and expira_em > now();
  if v_invite.id is null then
    return jsonb_build_object('error', 'invalido_ou_expirado');
  end if;

  -- Confirma que o user_id passado bate com o email do convite
  select email into v_profile_email from profiles where id = p_user_id;
  if lower(v_profile_email) <> lower(v_invite.email) then
    return jsonb_build_object('error', 'email_nao_bate');
  end if;

  -- Atualiza o profile com papel/revenda do convite e ativa
  update profiles
     set papel = v_invite.papel,
         revenda_id = v_invite.revenda_id,
         status = 'ativo',
         updated_at = now()
   where id = p_user_id;

  -- Marca convite como aceito
  update convites set aceito_em = now() where id = v_invite.id;

  -- Se for Coord, vincula como coord da revenda (se ainda não tiver)
  if v_invite.papel = 'coord' and v_invite.revenda_id is not null then
    update revendas
       set coord_id = p_user_id
     where id = v_invite.revenda_id and coord_id is null;
  end if;

  return jsonb_build_object('ok', true, 'papel', v_invite.papel);
end;
$$;

grant execute on function public.aceitar_convite(text, uuid) to authenticated;

-- ---------- Policy: permitir Coord ler os convites que ele criou ------
-- (já existe convites_coord_select na migration 0001, mas vamos garantir)

drop policy if exists "convites_coord_select" on convites;
create policy "convites_coord_select" on convites for select
  using (
    invited_by = auth.uid()
    or (current_papel() = 'coord' and revenda_id = current_revenda())
    or current_papel() = 'admin'
  );
