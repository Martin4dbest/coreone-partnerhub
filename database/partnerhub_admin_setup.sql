-- CoreOne PartnerHub administrator access.
-- Creates a separate allowlist; does not approve any partner.

CREATE TABLE IF NOT EXISTS public.coreone_partnerhub_admins (
    user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.coreone_partnerhub_admins
    ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.coreone_partnerhub_admins FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.is_coreone_partnerhub_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.coreone_partnerhub_admins a
        WHERE a.user_id = (SELECT auth.uid())
    );
$$;

REVOKE ALL ON FUNCTION public.is_coreone_partnerhub_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_coreone_partnerhub_admin()
    TO authenticated;

-- Returns partner records only to an allowlisted administrator.
CREATE OR REPLACE FUNCTION public.coreone_partnerhub_list_partners()
RETURNS SETOF jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF NOT public.is_coreone_partnerhub_admin() THEN
        RAISE EXCEPTION 'Administrator access required';
    END IF;

    RETURN QUERY
    EXECUTE 'SELECT to_jsonb(p) FROM public.partner_profiles p';
END;
$$;

REVOKE ALL ON FUNCTION public.coreone_partnerhub_list_partners() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.coreone_partnerhub_list_partners()
    TO authenticated;

-- Approves or rejects a partner using the existing status/state column.
CREATE OR REPLACE FUNCTION public.coreone_partnerhub_set_partner_status(
    target_user_id uuid,
    new_status text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    status_column text;
BEGIN
    IF NOT public.is_coreone_partnerhub_admin() THEN
        RAISE EXCEPTION 'Administrator access required';
    END IF;

    IF new_status NOT IN ('approved', 'rejected', 'pending') THEN
        RAISE EXCEPTION 'Invalid partner status';
    END IF;

    SELECT c.column_name
      INTO status_column
      FROM information_schema.columns c
     WHERE c.table_schema = 'public'
       AND c.table_name = 'partner_profiles'
       AND c.column_name IN ('status', 'state')
     ORDER BY CASE c.column_name WHEN 'status' THEN 1 ELSE 2 END
     LIMIT 1;

    IF status_column IS NULL THEN
        RAISE EXCEPTION 'No status or state column exists on partner_profiles';
    END IF;

    EXECUTE format(
        'UPDATE public.partner_profiles SET %I = $1 WHERE id = $2',
        status_column
    )
    USING new_status, target_user_id;

    RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.coreone_partnerhub_set_partner_status(uuid, text)
    FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.coreone_partnerhub_set_partner_status(uuid, text)
    TO authenticated;
