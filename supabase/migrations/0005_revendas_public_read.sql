-- =====================================================================
-- Permitir que visitantes não logados (anon) leiam revendas ativas
-- — necessário pra mostrar a lista no formulário de cadastro de Rep.
--
-- Segurança: anon só vê revendas com status='ativo' (não vê suspensas/desabilitadas)
-- e não tem permissão de insert/update/delete.
-- =====================================================================

drop policy if exists "revendas_select_all_authenticated" on revendas;

create policy "revendas_select_public_active" on revendas for select
  using (status = 'ativo');
