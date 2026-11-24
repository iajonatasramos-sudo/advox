-- 0019 — "Visualizando como" (impersonação do admin, como no BuildClinic)
--
-- Cada vez que um admin entra como outro usuário, a Edge Function
-- `impersonar` (service role) grava uma linha aqui. O id fica só no navegador
-- do admin e é a prova para "Voltar ao meu usuário" (ou trocar de pessoa sem
-- voltar). Ninguém lê/escreve pelo cliente: RLS ligado e sem policies.

create table if not exists public.impersonacoes (
  id           uuid primary key default gen_random_uuid(),
  admin_id     uuid not null references public.profiles(id) on delete cascade,
  alvo_id      uuid not null references public.profiles(id) on delete cascade,
  iniciada_em  timestamptz not null default now(),
  encerrada_em timestamptz
);
create index if not exists impersonacoes_alvo_idx on public.impersonacoes (alvo_id) where encerrada_em is null;

alter table public.impersonacoes enable row level security;
revoke all on public.impersonacoes from anon, authenticated;
