SELECT
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN (
    'partner_profiles',
    'partner_referrals',
    'partner_commissions',
    'partner_payout_requests'
  )
ORDER BY table_name, ordinal_position;
