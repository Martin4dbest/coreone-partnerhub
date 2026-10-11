-- CoreOne PartnerHub: secure admin payout functions.
-- Partners retain access only to their own payout records.

-- Ensure the payout table contains the fields used by the app.
ALTER TABLE public.coreone_partner_payouts
    ADD COLUMN IF NOT EXISTS payment_reference text,
    ADD COLUMN IF NOT EXISTS bank_name text,
    ADD COLUMN IF NOT EXISTS account_name text,
    ADD COLUMN IF NOT EXISTS account_number text,
    ADD COLUMN IF NOT EXISTS processed_at timestamptz;

-- Admin-only payout listing.
CREATE OR REPLACE FUNCTION public.coreone_partnerhub_list_payouts()
RETURNS SETOF jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF NOT COALESCE(public.is_coreone_partnerhub_admin(), false) THEN
        RAISE EXCEPTION 'Administrator access required';
    END IF;

    RETURN QUERY
    SELECT to_jsonb(p)
    FROM public.coreone_partner_payouts AS p
    ORDER BY p.requested_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.coreone_partnerhub_list_payouts()
    FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.coreone_partnerhub_list_payouts()
    TO authenticated;


-- Admin-only payout status updates.
CREATE OR REPLACE FUNCTION public.coreone_partnerhub_update_payout(
    target_payout_id uuid,
    new_status text,
    payment_reference text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF NOT COALESCE(public.is_coreone_partnerhub_admin(), false) THEN
        RAISE EXCEPTION 'Administrator access required';
    END IF;

    IF new_status NOT IN ('requested', 'processing', 'paid', 'rejected') THEN
        RAISE EXCEPTION 'Invalid payout status';
    END IF;

    UPDATE public.coreone_partner_payouts AS p
    SET
        status = new_status,
        payment_reference = COALESCE($3, p.payment_reference),
        processed_at = CASE
            WHEN new_status IN ('paid', 'rejected')
                THEN COALESCE(p.processed_at, now())
            ELSE p.processed_at
        END
    WHERE p.id = target_payout_id;

    RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.coreone_partnerhub_update_payout(uuid, text, text)
    FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.coreone_partnerhub_update_payout(uuid, text, text)
    TO authenticated;
