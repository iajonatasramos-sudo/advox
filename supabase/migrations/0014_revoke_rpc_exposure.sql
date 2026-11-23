-- =====================================================================
-- Migration 0014 — Reduz exposição de funções SECURITY DEFINER via /rpc
--
-- Advisors (lints 0028/0029) apontaram que todas as funções security
-- definer do schema public podiam ser chamadas via /rest/v1/rpc.
--
-- Revogado aqui:
--   - Funções de TRIGGER (log_audit, notif_*): não fazem sentido como RPC.
--     O Postgres não checa EXECUTE ao disparar trigger, então os triggers
--     continuam funcionando normalmente.
--   - aceitar_convite: exige auth.uid(); anon não precisa chamar.
--
-- MANTIDO de propósito (aviso dos advisors é esperado):
--   - current_papel, current_revenda, current_ativo, can_access_*,
--     user_owns_lead, lead_in_user_revenda, user_has_caso_for_lead,
--     advogado_em_caso_visivel: usadas em policies RLS que valem para o
--     papel `public` (inclui anon, ex.: leitura de revendas no cadastro).
--     Sem EXECUTE, o Postgres dá "permission denied for function" mesmo
--     para anon. Elas só retornam dados do próprio chamador (null/false
--     para anon), então a exposição é inócua.
--   - get_invite: precisa ser pública (convidado ainda não tem conta).
-- =====================================================================

revoke execute on function public.log_audit()                from public, anon, authenticated;
revoke execute on function public.notif_caso_atribuido()     from public, anon, authenticated;
revoke execute on function public.notif_caso_criado()        from public, anon, authenticated;
revoke execute on function public.notif_caso_status_change() from public, anon, authenticated;
revoke execute on function public.notif_rep_aprovado()       from public, anon, authenticated;

revoke execute on function public.aceitar_convite(text, uuid) from public, anon;
grant  execute on function public.aceitar_convite(text, uuid) to authenticated;
