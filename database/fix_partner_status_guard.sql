CREATE OR REPLACE FUNCTION public.guard_partner_profile()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
BEGIN
    IF auth.uid() IS NOT NULL
       AND auth.role() <> 'service_role'
       AND NOT public.is_partner_admin()
       AND NOT public.is_coreone_partnerhub_admin() THEN

        IF NEW.role IS DISTINCT FROM OLD.role THEN
            RAISE EXCEPTION 'Only an administrator can change a role';
        END IF;

        IF NEW.application_status IS DISTINCT FROM OLD.application_status THEN
            RAISE EXCEPTION 'Only an administrator can change application status';
        END IF;

        IF NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at
           OR NEW.reviewed_by IS DISTINCT FROM OLD.reviewed_by
           OR NEW.review_notes IS DISTINCT FROM OLD.review_notes THEN
            RAISE EXCEPTION 'Only an administrator can change review details';
        END IF;
    END IF;

    NEW.updated_at = now();
    RETURN NEW;
END;
$function$;
