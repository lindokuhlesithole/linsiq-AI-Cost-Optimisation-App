CREATE OR REPLACE FUNCTION public.stamp_action_identity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  jwt_email text;
  profile_email text;
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Cannot record audit action without an authenticated user';
  END IF;

  -- Always trust the JWT for identity, ignore client-supplied user_id/actor.
  NEW.user_id := uid;

  BEGIN
    jwt_email := (auth.jwt() ->> 'email');
  EXCEPTION WHEN OTHERS THEN
    jwt_email := NULL;
  END;

  IF jwt_email IS NULL OR jwt_email = '' THEN
    SELECT email INTO profile_email FROM public.profiles WHERE id = uid;
  END IF;

  NEW.actor := COALESCE(NULLIF(jwt_email, ''), NULLIF(profile_email, ''), 'unknown');

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS stamp_action_identity_trg ON public.optimization_actions;
CREATE TRIGGER stamp_action_identity_trg
BEFORE INSERT ON public.optimization_actions
FOR EACH ROW EXECUTE FUNCTION public.stamp_action_identity();