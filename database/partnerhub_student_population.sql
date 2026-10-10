ALTER TABLE public.coreone_partner_referrals
    ADD COLUMN IF NOT EXISTS expected_students bigint;

ALTER TABLE public.coreone_partner_referrals
    ADD COLUMN IF NOT EXISTS expected_student_range text;

ALTER TABLE public.coreone_partner_referrals
    ALTER COLUMN expected_students TYPE bigint
    USING expected_students::bigint;

ALTER TABLE public.coreone_partner_referrals
    DROP CONSTRAINT IF EXISTS coreone_partner_referrals_expected_students_check;

ALTER TABLE public.coreone_partner_referrals
    ADD CONSTRAINT coreone_partner_referrals_expected_students_check
    CHECK (expected_students IS NULL OR expected_students >= 1);

NOTIFY pgrst, 'reload schema';
