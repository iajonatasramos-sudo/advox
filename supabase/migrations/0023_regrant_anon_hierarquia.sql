-- Desfaz a 0022: as policies (ex.: revendas na tela de cadastro, sem login)
-- chamam essas funções também para o papel anon. Sem EXECUTE o Postgres
-- recusa a consulta inteira ("permission denied for function current_empresa").
-- Para visitante sem login elas devolvem vazio/false (auth.uid() é nulo).
grant execute on function public.current_empresa() to anon;
grant execute on function public.is_comercial() to anon;
grant execute on function public.is_gestor() to anon;
grant execute on function public.revendas_da_empresa() to anon;
grant execute on function public.minha_equipe() to anon;
grant execute on function public.equipe_visivel() to anon;
grant execute on function public.superior_valido(papel, uuid, uuid) to anon;
grant execute on function public.lead_visivel(uuid) to anon;
grant execute on function public.cadeia_acima(uuid) to anon;
grant execute on function public.pode_gerir(uuid) to anon;
