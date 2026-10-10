CREATE OR REPLACE FUNCTION public.coreone_partnerhub_public_referral_count()
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT COUNT(*)
  FROM public.coreone_partner_referrals;
$$;

REVOKE ALL ON FUNCTION public.coreone_partnerhub_public_referral_count()
FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.coreone_partnerhub_public_referral_count()
TO anon, authenticated;
