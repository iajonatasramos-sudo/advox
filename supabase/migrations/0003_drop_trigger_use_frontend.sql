-- =====================================================================
-- Solução robusta: remover o trigger automático e deixar o frontend
-- criar o profile explicitamente após o signup.
--
-- Vantagens:
--   - signup nunca falha por causa do trigger
--   - erros são visíveis no frontend (não em logs do PG)
--   - mais fácil de debugar
-- =====================================================================

-- 1) Remove o trigger e a função
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_auth_user();

-- 2) Permite inserts em profiles pelo próprio usuário (auth.uid() = id)
--    Isso é seguro: o usuário só pode criar o próprio profile, com o próprio id.
create policy "profiles_self_insert" on profiles for insert
  to authenticated
  with check (id = auth.uid());

-- 3) Garante que a coluna nome possa ser temporariamente NULL
--    para o caso de signup via Google OAuth (o nome vem do provider depois)
alter table profiles alter column nome drop not null;

-- Pronto. O frontend chama supabase.auth.signUp() e depois faz
-- supabase.from('profiles').insert({id, email, nome, papel, ...}).
