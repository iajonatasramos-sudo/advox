-- =====================================================================
-- Migration 0015 — Base de CRM: contato, fidelidade, perda e atividades
--
-- leads:
--   telefone        WhatsApp/celular do contato, só dígitos com DDI
--                   (ex.: 5511987654321). Normalizado por trigger. É a
--                   chave usada pela extensão do WhatsApp Web.
--   email           e-mail do contato
--   fim_fidelidade  data em que a fidelidade com a operadora acaba
--                   (momento certo de abordar sem multa)
--   motivo_perda    obrigatório na UI ao mover para "perdido"
--
-- tarefas:
--   tipo            ligacao | whatsapp | visita | reuniao | email | tarefa
--
-- Só adiciona colunas/índices/funções: não altera policies existentes.
-- =====================================================================

alter table public.leads
  add column if not exists telefone       text,
  add column if not exists email          text,
  add column if not exists fim_fidelidade date,
  add column if not exists motivo_perda   text;

alter table public.tarefas
  add column if not exists tipo text not null default 'tarefa';

alter table public.tarefas
  drop constraint if exists tarefas_tipo_check;
alter table public.tarefas
  add constraint tarefas_tipo_check
  check (tipo in ('ligacao', 'whatsapp', 'visita', 'reuniao', 'email', 'tarefa'));

-- Normaliza telefone: só dígitos; número BR sem DDI (10/11 dígitos) ganha 55.
create or replace function public.normaliza_telefone(v text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when v is null then null
    when length(regexp_replace(v, '\D', '', 'g')) = 0 then null
    when length(regexp_replace(v, '\D', '', 'g')) in (10, 11)
      then '55' || regexp_replace(v, '\D', '', 'g')
    else regexp_replace(v, '\D', '', 'g')
  end
$$;

create or replace function public.leads_normaliza_telefone()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.telefone := public.normaliza_telefone(new.telefone);
  new.email := nullif(lower(trim(new.email)), '');
  return new;
end;
$$;

drop trigger if exists trg_leads_normaliza_telefone on public.leads;
create trigger trg_leads_normaliza_telefone
  before insert or update of telefone, email on public.leads
  for each row execute function public.leads_normaliza_telefone();

revoke execute on function public.leads_normaliza_telefone() from public, anon, authenticated;

create index if not exists leads_telefone_idx on public.leads (telefone) where telefone is not null;
create index if not exists leads_fim_fidelidade_idx on public.leads (fim_fidelidade) where fim_fidelidade is not null;
