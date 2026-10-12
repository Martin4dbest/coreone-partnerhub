-- Fix CoreOne PartnerHub admin partner listing.
-- Read registration location from Supabase Auth metadata.
-- Keep approval status separate from location.

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
        to_jsonb(p)
        || jsonb_build_object(
            'status',
            COALESCE(
                NULLIF(to_jsonb(p)->>'application_status', ''),
                NULLIF(to_jsonb(p)->>'approval_status', ''),
                NULLIF(to_jsonb(p)->>'status', ''),
                NULLIF(to_jsonb(a)->>'application_status', ''),
                NULLIF(to_jsonb(a)->>'status', ''),
                CASE
                    WHEN lower(COALESCE(to_jsonb(p)->>'state', ''))
                         IN ('pending', 'approved', 'rejected')
                    THEN lower(to_jsonb(p)->>'state')
                    ELSE 'pending'
                END
            ),
            'state',
            COALESCE(
                NULLIF(u.raw_user_meta_data->>'state', ''),
                CASE
                    WHEN lower(COALESCE(to_jsonb(p)->>'state', ''))
                         IN ('pending', 'approved', 'rejected')
                    THEN NULL
                    ELSE NULLIF(to_jsonb(p)->>'state', '')
                END
            ),
            'city',
            COALESCE(
                NULLIF(u.raw_user_meta_data->>'city', ''),
                NULLIF(to_jsonb(p)->>'city', '')
            ),
            'address',
            COALESCE(
                NULLIF(u.raw_user_meta_data->>'address', ''),
                NULLIF(to_jsonb(p)->>'address', '')
            ),
            'registration_details',
            COALESCE(
                to_jsonb(p)->'registration_details',
                '{}'::jsonb
            )
            || jsonb_build_object(
                'full_name',
                COALESCE(
                    NULLIF(u.raw_user_meta_data->>'full_name', ''),
                    to_jsonb(p)->>'full_name',
                    to_jsonb(p)->>'name'
                ),
                'phone',
                COALESCE(
                    NULLIF(u.raw_user_meta_data->>'phone', ''),
                    to_jsonb(p)->>'phone'
                ),
                'organization',
                COALESCE(
                    NULLIF(u.raw_user_meta_data->>'organization', ''),
                    to_jsonb(p)->>'organization'
                ),
                'state',
                NULLIF(u.raw_user_meta_data->>'state', ''),
                'city',
                NULLIF(u.raw_user_meta_data->>'city', ''),
                'address',
                NULLIF(u.raw_user_meta_data->>'address', ''),
                'education_level',
                NULLIF(u.raw_user_meta_data->>'education_level', ''),
                'nysc_completed',
                u.raw_user_meta_data->'nysc_completed',
                'age',
                u.raw_user_meta_data->'age',
                'gender',
                NULLIF(u.raw_user_meta_data->>'gender', '')
            ),
            'application_details',
            to_jsonb(a)
        )
    FROM public.partner_profiles AS p
    LEFT JOIN auth.users AS u
        ON u.id = p.id
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
