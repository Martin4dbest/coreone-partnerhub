-- CoreOne PartnerHub applicant details and private documents.
-- Existing partner_profiles and approval RPCs remain in place.

CREATE TABLE IF NOT EXISTS public.coreone_partner_applications (
    user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    education_level text NOT NULL
        CHECK (education_level IN ('undergraduate', 'graduate')),
    nysc_completed boolean,
    age integer NOT NULL CHECK (age BETWEEN 16 AND 100),
    gender text NOT NULL CHECK (gender IN ('male', 'female')),
    id_document_path text NOT NULL,
    ssce_document_path text NOT NULL,
    degree_document_path text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT coreone_application_nysc_rule CHECK (
        (education_level = 'undergraduate' AND nysc_completed IS NULL)
        OR
        (education_level = 'graduate' AND nysc_completed IS NOT NULL)
    ),
    CONSTRAINT coreone_application_degree_rule CHECK (
        (education_level = 'undergraduate' AND degree_document_path IS NULL)
        OR
        (education_level = 'graduate' AND degree_document_path IS NOT NULL)
    )
);

ALTER TABLE public.coreone_partner_applications
    ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.coreone_partner_applications FROM anon, authenticated;

DROP POLICY IF EXISTS "coreone_partner_documents_private_read"
    ON storage.objects;
DROP POLICY IF EXISTS "coreone_partner_documents_private_insert"
    ON storage.objects;
DROP POLICY IF EXISTS "coreone_partner_documents_private_update"
    ON storage.objects;
DROP POLICY IF EXISTS "coreone_partner_documents_private_delete"
    ON storage.objects;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'coreone-partner-documents',
    'coreone-partner-documents',
    false,
    10485760,
    ARRAY['application/pdf', 'image/jpeg', 'image/png']
)
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = 10485760,
    allowed_mime_types = ARRAY['application/pdf', 'image/jpeg', 'image/png'];

-- Applicants can access only files stored under their own user ID.
CREATE POLICY "coreone_partner_documents_private_read"
ON storage.objects FOR SELECT TO authenticated
USING (
    bucket_id = 'coreone-partner-documents'
    AND (
        (storage.foldername(name))[1] = (SELECT auth.uid())::text
        OR public.is_coreone_partnerhub_admin()
    )
);

CREATE POLICY "coreone_partner_documents_private_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
    bucket_id = 'coreone-partner-documents'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
);

CREATE POLICY "coreone_partner_documents_private_update"
ON storage.objects FOR UPDATE TO authenticated
USING (
    bucket_id = 'coreone-partner-documents'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
)
WITH CHECK (
    bucket_id = 'coreone-partner-documents'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
);

CREATE POLICY "coreone_partner_documents_private_delete"
ON storage.objects FOR DELETE TO authenticated
USING (
    bucket_id = 'coreone-partner-documents'
    AND (
        (storage.foldername(name))[1] = (SELECT auth.uid())::text
        OR public.is_coreone_partnerhub_admin()
    )
);

-- Only the existing allowlisted administrator may list application details.
CREATE OR REPLACE FUNCTION public.coreone_partnerhub_list_partners()
RETURNS SETOF jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF NOT public.is_coreone_partnerhub_admin() THEN
        RAISE EXCEPTION 'Administrator access required';
    END IF;

    RETURN QUERY
    SELECT
        to_jsonb(p) ||
        jsonb_build_object(
            'application_details',
            to_jsonb(a)
        )
    FROM public.partner_profiles p
    LEFT JOIN public.coreone_partner_applications a
        ON a.user_id = p.id;
END;
$$;

REVOKE ALL ON FUNCTION public.coreone_partnerhub_list_partners() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.coreone_partnerhub_list_partners()
    TO authenticated;

NOTIFY pgrst, 'reload schema';
