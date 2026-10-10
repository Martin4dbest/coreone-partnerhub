CREATE OR REPLACE FUNCTION public.coreone_partnerhub_public_leaderboard()
RETURNS TABLE (
  first_name text,
  referral_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  WITH profile_names AS (
    SELECT
      p.id AS partner_id,
      split_part(
        trim(
          coalesce(
            nullif(to_jsonb(p)->>'first_name', ''),
            nullif(to_jsonb(p)->>'full_name', ''),
            nullif(to_jsonb(p)->>'display_name', ''),
            nullif(to_jsonb(p)->>'name', ''),
            'Partner'
          )
        ),
        ' ',
        1
      ) AS first_name
    FROM public.partner_profiles p
    WHERE lower(
      coalesce(
        to_jsonb(p)->>'status',
        to_jsonb(p)->>'state',
        'pending'
      )
    ) IN ('approved', 'active')
  ),
  referral_totals AS (
    SELECT
      r.partner_id,
      count(*)::bigint AS referral_count
    FROM public.coreone_partner_referrals r
    GROUP BY r.partner_id
  )
  SELECT
    pn.first_name,
    rt.referral_count
  FROM referral_totals rt
  JOIN profile_names pn ON pn.partner_id = rt.partner_id
  WHERE rt.referral_count > 0
  ORDER BY rt.referral_count DESC, pn.first_name ASC
  LIMIT 5;
$$;

REVOKE ALL
ON FUNCTION public.coreone_partnerhub_public_leaderboard()
FROM PUBLIC;

GRANT EXECUTE
ON FUNCTION public.coreone_partnerhub_public_leaderboard()
TO anon, authenticated;
