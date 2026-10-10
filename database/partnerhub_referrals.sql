-- CoreOne PartnerHub: dedicated referral and commission tables.
-- Does not modify existing PartnerHub or CoreOne tables.

CREATE TABLE IF NOT EXISTS public.coreone_partner_referrals (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    school_name text NOT NULL,
    contact_name text NOT NULL,
    contact_email text,
    contact_phone text NOT NULL,
    state text,
    notes text,
    stage text NOT NULL DEFAULT 'submitted'
        CHECK (stage IN (
            'submitted',
            'demo_scheduled',
            'demo_completed',
            'onboarding',
            'onboarded',
            'rejected'
        )),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.coreone_partner_commissions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    referral_id uuid NOT NULL UNIQUE
        REFERENCES public.coreone_partner_referrals(id) ON DELETE CASCADE,
    amount numeric(12,2) NOT NULL CHECK (amount >= 0),
    currency text NOT NULL DEFAULT 'NGN',
    status text NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'paid')),
    created_at timestamptz NOT NULL DEFAULT now(),
    paid_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.coreone_partner_payouts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    amount numeric(12,2) NOT NULL CHECK (amount > 0),
    currency text NOT NULL DEFAULT 'NGN',
    status text NOT NULL DEFAULT 'requested'
        CHECK (status IN ('requested', 'processing', 'paid', 'rejected')),
    payment_reference text,
    requested_at timestamptz NOT NULL DEFAULT now(),
    processed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_coreone_referrals_partner
    ON public.coreone_partner_referrals(partner_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_coreone_commissions_partner
    ON public.coreone_partner_commissions(partner_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_coreone_payouts_partner
    ON public.coreone_partner_payouts(partner_id, requested_at DESC);

ALTER TABLE public.coreone_partner_referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coreone_partner_commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coreone_partner_payouts ENABLE ROW LEVEL SECURITY;

-- Partners can view and manage only their own school referrals.
DROP POLICY IF EXISTS "Partners view own CoreOne referrals"
    ON public.coreone_partner_referrals;
CREATE POLICY "Partners view own CoreOne referrals"
    ON public.coreone_partner_referrals
    FOR SELECT TO authenticated
    USING (partner_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Partners submit own CoreOne referrals"
    ON public.coreone_partner_referrals;
CREATE POLICY "Partners submit own CoreOne referrals"
    ON public.coreone_partner_referrals
    FOR INSERT TO authenticated
    WITH CHECK (partner_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Partners update own submitted CoreOne referrals"
    ON public.coreone_partner_referrals;
CREATE POLICY "Partners update own submitted CoreOne referrals"
    ON public.coreone_partner_referrals
    FOR UPDATE TO authenticated
    USING (
        partner_id = (SELECT auth.uid())
        AND stage = 'submitted'
    )
    WITH CHECK (
        partner_id = (SELECT auth.uid())
        AND stage = 'submitted'
    );

-- Partners can view their own commissions but cannot create or alter them.
DROP POLICY IF EXISTS "Partners view own CoreOne commissions"
    ON public.coreone_partner_commissions;
CREATE POLICY "Partners view own CoreOne commissions"
    ON public.coreone_partner_commissions
    FOR SELECT TO authenticated
    USING (partner_id = (SELECT auth.uid()));

-- Partners can view their own payout history and request payouts.
DROP POLICY IF EXISTS "Partners view own CoreOne payouts"
    ON public.coreone_partner_payouts;
CREATE POLICY "Partners view own CoreOne payouts"
    ON public.coreone_partner_payouts
    FOR SELECT TO authenticated
    USING (partner_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Partners request own CoreOne payouts"
    ON public.coreone_partner_payouts;
CREATE POLICY "Partners request own CoreOne payouts"
    ON public.coreone_partner_payouts
    FOR INSERT TO authenticated
    WITH CHECK (
        partner_id = (SELECT auth.uid())
        AND status = 'requested'
    );

-- Restrict direct browser access to authenticated users.
GRANT SELECT, INSERT, UPDATE
    ON public.coreone_partner_referrals TO authenticated;
GRANT SELECT
    ON public.coreone_partner_commissions TO authenticated;
GRANT SELECT, INSERT
    ON public.coreone_partner_payouts TO authenticated;
