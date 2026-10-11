CREATE OR REPLACE FUNCTION public.coreone_partnerhub_public_overview()
RETURNS TABLE (
  total_referrals bigint,
  onboarded_schools bigint,
  commission_earned numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT
    COUNT(r.id)::bigint,
    COUNT(r.id) FILTER (WHERE r.stage = 'onboarded')::bigint,
    COALESCE((
      SELECT SUM(c.amount)
      FROM public.coreone_partner_commissions c
      WHERE c.currency = 'NGN'
        AND c.status IN ('approved', 'paid')
    ), 0)::numeric
  FROM public.coreone_partner_referrals r;
$$;

REVOKE ALL
ON FUNCTION public.coreone_partnerhub_public_overview()
FROM PUBLIC;

GRANT EXECUTE
ON FUNCTION public.coreone_partnerhub_public_overview()
TO anon, authenticated;
