-- Core1 PartnerHub referral activity tracking.
-- This is separate from existing commission and payout tables.

create table if not exists public.coreone_partner_referral_events (
    id uuid primary key default gen_random_uuid(),
    partner_id uuid not null references auth.users(id) on delete cascade,
    referral_code text not null,
    product text not null
        check (product in ('coreone_school_app', 'brainleague')),
    event_type text not null,
    external_entity_id text not null,
    created_at timestamptz not null default now(),

    constraint coreone_partner_referral_event_type_check
        check (
            (product = 'coreone_school_app' and event_type = 'school_created')
            or
            (product = 'brainleague' and event_type = 'user_registered')
        ),

    constraint coreone_partner_referral_event_unique
        unique (product, event_type, external_entity_id)
);

create index if not exists coreone_partner_referral_events_partner_idx
    on public.coreone_partner_referral_events (partner_id, created_at desc);

create index if not exists coreone_partner_referral_events_product_idx
    on public.coreone_partner_referral_events (product, created_at desc);

alter table public.coreone_partner_referral_events enable row level security;

-- Raw referral events are accessible only to trusted server-side code.
revoke all on table public.coreone_partner_referral_events
    from public, anon, authenticated;

grant all on table public.coreone_partner_referral_events to service_role;

-- Permit the trusted server integration to validate referral codes.
grant execute on function
    public.coreone_partnerhub_is_approved_staff(uuid)
    to service_role;

grant execute on function
    public.coreone_partnerhub_validate_referral_code(text)
    to service_role;


-- Admin report: referral totals for each approved staff member.
create or replace function public.coreone_partnerhub_list_referral_activity()
returns table (
    partner_id uuid,
    referral_code text,
    staff_name text,
    email text,
    created_at timestamptz,
    school_count bigint,
    brainleague_count bigint
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
    if not public.is_coreone_partnerhub_admin() then
        raise exception 'Administrator access required.';
    end if;

    return query
    select
        c.partner_id,
        c.referral_code,
        coalesce(
            u.raw_user_meta_data ->> 'full_name',
            u.raw_user_meta_data ->> 'name',
            u.email,
            'Approved staff'
        )::text as staff_name,
        u.email::text,
        c.created_at,
        count(e.id) filter (
            where e.product = 'coreone_school_app'
              and e.event_type = 'school_created'
        )::bigint as school_count,
        count(e.id) filter (
            where e.product = 'brainleague'
              and e.event_type = 'user_registered'
        )::bigint as brainleague_count
    from public.coreone_partner_referral_codes c
    join auth.users u on u.id = c.partner_id
    left join public.coreone_partner_referral_events e
        on e.partner_id = c.partner_id
    where public.coreone_partnerhub_is_approved_staff(c.partner_id)
    group by
        c.partner_id,
        c.referral_code,
        u.raw_user_meta_data,
        u.email,
        c.created_at
    order by c.created_at desc;
end;
$$;

revoke all on function
    public.coreone_partnerhub_list_referral_activity()
    from public, anon;

grant execute on function
    public.coreone_partnerhub_list_referral_activity()
    to authenticated;


-- Staff report: show only the signed-in staff member's own totals.
create or replace function public.coreone_partnerhub_my_referral_activity()
returns table (
    product text,
    referral_count bigint
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_user_id uuid := auth.uid();
begin
    if v_user_id is null then
        raise exception 'Please sign in first.';
    end if;

    if not public.coreone_partnerhub_is_approved_staff(v_user_id) then
        raise exception 'Approved staff access required.';
    end if;

    return query
    select
        p.product,
        count(e.id)::bigint as referral_count
    from (
        values
            ('coreone_school_app'::text),
            ('brainleague'::text)
    ) as p(product)
    left join public.coreone_partner_referral_events e
        on e.partner_id = v_user_id
       and e.product = p.product
    group by p.product
    order by p.product;
end;
$$;

revoke all on function
    public.coreone_partnerhub_my_referral_activity()
    from public, anon;

grant execute on function
    public.coreone_partnerhub_my_referral_activity()
    to authenticated;
