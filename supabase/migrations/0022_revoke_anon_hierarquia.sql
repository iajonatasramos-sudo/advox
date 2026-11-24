-- As funções de apoio da hierarquia (0021) são usadas pelas policies e por
-- usuários logados; visitantes sem login não precisam chamá-las.
revoke execute on function public.current_empresa() from anon, public;
revoke execute on function public.is_comercial() from anon, public;
revoke execute on function public.is_gestor() from anon, public;
revoke execute on function public.revendas_da_empresa() from anon, public;
revoke execute on function public.minha_equipe() from anon, public;
revoke execute on function public.equipe_visivel() from anon, public;
revoke execute on function public.superior_valido(papel, uuid, uuid) from anon, public;
revoke execute on function public.lead_visivel(uuid) from anon, public;
revoke execute on function public.cadeia_acima(uuid) from anon, public;
revoke execute on function public.pode_gerir(uuid) from anon, public;
grant execute on function public.current_empresa() to authenticated;
grant execute on function public.is_comercial() to authenticated;
grant execute on function public.is_gestor() to authenticated;
grant execute on function public.revendas_da_empresa() to authenticated;
grant execute on function public.minha_equipe() to authenticated;
grant execute on function public.equipe_visivel() to authenticated;
grant execute on function public.superior_valido(papel, uuid, uuid) to authenticated;
grant execute on function public.lead_visivel(uuid) to authenticated;
grant execute on function public.cadeia_acima(uuid) to authenticated;
grant execute on function public.pode_gerir(uuid) to authenticated;
