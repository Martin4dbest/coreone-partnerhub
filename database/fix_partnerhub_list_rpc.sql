-- Restore the CoreOne PartnerHub partner-list RPC.

CREATE OR REPLACE FUNCTION public.coreone_partnerhub_list_partners()
RETURNS SETOF jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
    IF NOT public.is_coreone_partnerhub_admin() THEN
        RAISE EXCEPTION 'Administrator access required'
            USING ERRCODE = '42501';
    END IF;

    RETURN QUERY
    SELECT
        to_jsonb(p) ||
        jsonb_build_object(
            'application_details',
            to_jsonb(a)
        )
    FROM public.partner_profiles AS p
    LEFT JOIN public.coreone_partner_applications AS a
        ON a.user_id = p.id;
END;
$function$;

REVOKE ALL
ON FUNCTION public.coreone_partnerhub_list_partners()
FROM PUBLIC;

GRANT EXECUTE
ON FUNCTION public.coreone_partnerhub_list_partners()
TO authenticated;

NOTIFY pgrst, 'reload schema';
