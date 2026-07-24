
-- 1. Organizations
CREATE TABLE public.orgs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.orgs TO authenticated;
GRANT ALL ON public.orgs TO service_role;
ALTER TABLE public.orgs ENABLE ROW LEVEL SECURITY;

-- 2. Profiles (one per auth user, points to an org)
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE RESTRICT,
  email text,
  display_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_orgs_updated_at
  BEFORE UPDATE ON public.orgs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. Security-definer helper: does this user belong to this org?
CREATE OR REPLACE FUNCTION public.user_in_org(_user_id uuid, _org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = _user_id AND org_id = _org_id
  );
$$;

CREATE OR REPLACE FUNCTION public.current_org_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT org_id FROM public.profiles WHERE id = auth.uid();
$$;

-- 4. Auto-create org + profile on new signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_org_id uuid;
  base_name text;
BEGIN
  base_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    split_part(NEW.email, '@', 1),
    'My Org'
  );
  INSERT INTO public.orgs (name) VALUES (base_name || '''s org') RETURNING id INTO new_org_id;
  INSERT INTO public.profiles (id, org_id, email, display_name)
  VALUES (NEW.id, new_org_id, NEW.email, base_name);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 5. Profiles + orgs policies
CREATE POLICY "Users read own profile" ON public.profiles
  FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE POLICY "Members read own org" ON public.orgs
  FOR SELECT TO authenticated USING (public.user_in_org(auth.uid(), id));
CREATE POLICY "Members update own org" ON public.orgs
  FOR UPDATE TO authenticated
  USING (public.user_in_org(auth.uid(), id))
  WITH CHECK (public.user_in_org(auth.uid(), id));

-- 6. Add org_id to existing tables + backfill to a demo org
INSERT INTO public.orgs (id, name)
VALUES ('00000000-0000-0000-0000-000000000001', 'Demo Org');

ALTER TABLE public.optimizations
  ADD COLUMN org_id uuid REFERENCES public.orgs(id) ON DELETE CASCADE;
UPDATE public.optimizations SET org_id = '00000000-0000-0000-0000-000000000001' WHERE org_id IS NULL;
ALTER TABLE public.optimizations ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE public.optimizations
  ALTER COLUMN org_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
CREATE INDEX idx_optimizations_org_id ON public.optimizations(org_id);

ALTER TABLE public.optimization_actions
  ADD COLUMN org_id uuid REFERENCES public.orgs(id) ON DELETE CASCADE,
  ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
UPDATE public.optimization_actions
  SET org_id = '00000000-0000-0000-0000-000000000001' WHERE org_id IS NULL;
ALTER TABLE public.optimization_actions ALTER COLUMN org_id SET NOT NULL;
CREATE INDEX idx_optimization_actions_org_id ON public.optimization_actions(org_id);

-- 7. Replace permissive policies with auth-scoped ones
DROP POLICY IF EXISTS "Public read optimizations" ON public.optimizations;
DROP POLICY IF EXISTS "Public insert optimizations" ON public.optimizations;
DROP POLICY IF EXISTS "Public update optimizations" ON public.optimizations;
DROP POLICY IF EXISTS "Public read actions" ON public.optimization_actions;
DROP POLICY IF EXISTS "Public insert actions" ON public.optimization_actions;

REVOKE SELECT, INSERT, UPDATE, DELETE ON public.optimizations FROM anon;
REVOKE SELECT, INSERT ON public.optimization_actions FROM anon;

CREATE POLICY "Members read org optimizations" ON public.optimizations
  FOR SELECT TO authenticated
  USING (public.user_in_org(auth.uid(), org_id));
CREATE POLICY "Members insert org optimizations" ON public.optimizations
  FOR INSERT TO authenticated
  WITH CHECK (public.user_in_org(auth.uid(), org_id));
CREATE POLICY "Members update org optimizations" ON public.optimizations
  FOR UPDATE TO authenticated
  USING (public.user_in_org(auth.uid(), org_id))
  WITH CHECK (public.user_in_org(auth.uid(), org_id));

CREATE POLICY "Members read org actions" ON public.optimization_actions
  FOR SELECT TO authenticated
  USING (public.user_in_org(auth.uid(), org_id));
CREATE POLICY "Members insert org actions" ON public.optimization_actions
  FOR INSERT TO authenticated
  WITH CHECK (
    public.user_in_org(auth.uid(), org_id)
    AND (user_id IS NULL OR user_id = auth.uid())
  );

-- 8. Make every new auth user a member of the Demo Org too, so seeded rows are visible.
--    (Simple approach for this SaaS demo: dual membership via a second profile row
--    isn't possible because profiles is one-per-user. Instead, seed rows live in
--    Demo Org and each new user's own org gets its own future rows. Since the
--    user requested "assign existing data to a demo org" and "per-user org",
--    we grant read access to Demo Org rows via an extra policy for any
--    authenticated user, but keep writes scoped to their own org.)
CREATE POLICY "Anyone signed in reads demo-org optimizations" ON public.optimizations
  FOR SELECT TO authenticated
  USING (org_id = '00000000-0000-0000-0000-000000000001');
CREATE POLICY "Anyone signed in reads demo-org actions" ON public.optimization_actions
  FOR SELECT TO authenticated
  USING (org_id = '00000000-0000-0000-0000-000000000001');
