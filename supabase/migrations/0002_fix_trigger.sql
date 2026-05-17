-- =====================================================================
-- Fix: handle_new_auth_user
-- Causa do erro "Database error creating new user":
--   - search_path do trigger não estava explícito (não achava o enum 'papel')
--   - sem EXCEPTION handler, qualquer falha no INSERT em profiles
--     bloqueia a criação do auth.users
-- =====================================================================

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nome  text;
  v_papel papel;
begin
  -- nome: usa metadata ou parte antes do @ do email
  v_nome := coalesce(
    nullif(trim(new.raw_user_meta_data->>'nome'), ''),
    split_part(new.email, '@', 1)
  );

  -- papel: usa metadata se válido, senão 'rep' (default público)
  begin
    v_papel := coalesce(
      (new.raw_user_meta_data->>'papel')::papel,
      'rep'::papel
    );
  exception when others then
    v_papel := 'rep'::papel;
  end;

  insert into public.profiles (id, email, nome, papel, status)
  values (new.id, new.email, v_nome, v_papel, 'pendente')
  on conflict (id) do nothing;

  return new;
exception when others then
  -- nunca bloqueia a criação do usuário; loga warning e segue
  raise warning '[handle_new_auth_user] falha ao criar profile para %: %', new.email, sqlerrm;
  return new;
end;
$$;

-- O trigger continua o mesmo (já criado na migration 0001).
