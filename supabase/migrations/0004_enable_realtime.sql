-- =====================================================================
-- Habilita Realtime nas tabelas principais
-- Sem isso, as subscriptions postgres_changes não recebem nada.
-- =====================================================================

alter publication supabase_realtime add table profiles;
alter publication supabase_realtime add table leads;
alter publication supabase_realtime add table casos;
alter publication supabase_realtime add table tarefas;
alter publication supabase_realtime add table revendas;
