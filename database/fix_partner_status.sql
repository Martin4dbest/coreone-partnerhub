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
    identity_conditions text := '';
    affected_rows integer;
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

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = 'partner_profiles'
           AND column_name = 'id'
    ) THEN
        identity_conditions := 'id::text = $2::text';
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = 'partner_profiles'
           AND column_name = 'user_id'
    ) THEN
        IF identity_conditions <> '' THEN
            identity_conditions := identity_conditions || ' OR ';
        END IF;
        identity_conditions := identity_conditions || 'user_id::text = $2::text';
    END IF;

    IF identity_conditions = '' THEN
        RAISE EXCEPTION 'No matching identity column exists on partner_profiles';
    END IF;

    EXECUTE format(
        'UPDATE public.partner_profiles SET %I = $1 WHERE (%s)',
        status_column,
        identity_conditions
    )
    USING new_status, target_user_id;

    GET DIAGNOSTICS affected_rows = ROW_COUNT;
    RETURN affected_rows > 0;
END;
$$;
