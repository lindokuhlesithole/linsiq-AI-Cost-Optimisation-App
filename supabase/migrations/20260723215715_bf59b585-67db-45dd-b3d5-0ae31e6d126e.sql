
REVOKE EXECUTE ON FUNCTION public.user_in_org(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.current_org_id() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.user_in_org(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_org_id() TO authenticated;
