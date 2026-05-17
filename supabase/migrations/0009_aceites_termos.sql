-- =====================================================================
-- Aceite de termos (LGPD)
-- Registra quando cada usuário aceitou os Termos de Uso e a Política
-- de Privacidade. Cada nova versão de termo gera um novo aceite.
-- =====================================================================

create table aceites_termos (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles(id) on delete cascade,
  tipo        text not null check (tipo in ('termos_uso','politica_privacidade')),
  versao      text not null,
  aceito_em   timestamptz not null default now(),
  ip          text,
  user_agent  text,
  unique (user_id, tipo, versao)
);
create index idx_aceites_user on aceites_termos(user_id);

alter table aceites_termos enable row level security;

-- Usuário vê seus próprios aceites
create policy "aceites_self_select" on aceites_termos for select
  using (user_id = auth.uid());

-- Admin vê todos (compliance)
create policy "aceites_admin_select" on aceites_termos for select
  using (current_papel() = 'admin');

-- Usuário registra seus próprios aceites
create policy "aceites_self_insert" on aceites_termos for insert
  with check (user_id = auth.uid());
