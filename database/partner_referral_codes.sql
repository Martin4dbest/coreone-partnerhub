-- Core1 PartnerHub: simple referral codes for approved staff.
-- This does not modify existing commission or payout tables.

create table if not exists public.coreone_partner_referral_codes (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null unique references auth.users(id) on delete cascade,
  referral_code text not null unique,
  created_at timestamptz not null default now()
);

alter table public.coreone_partner_referral_codes enable row level security;

drop policy if exists "Partners view own referral code"
  on public.coreone_partner_referral_codes;

create policy "Partners view own referral code"
  on public.coreone_partner_referral_codes
  for select to authenticated
  using (
    partner_id = auth.uid()
    or public.is_coreone_partnerhub_admin()
  );

revoke all on public.coreone_partner_referral_codes from anon, authenticated;
grant select on public.coreone_partner_referral_codes to authenticated;


-- Check approval without assuming which of the existing profile status
-- columns is used by this version of PartnerHub.
create or replace function public.coreone_partnerhub_is_approved_staff(
  target_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from (
      select to_jsonb(p) as profile
      from public.partner_profiles p
    ) profiles
    where (
      profiles.profile ->> 'id' = target_user_id::text
      or profiles.profile ->> 'user_id' = target_user_id::text
      or profiles.profile ->> 'auth_user_id' = target_user_id::text
    )
    and (
      lower(coalesce(profiles.profile ->> 'application_status', ''))
        in ('approved', 'active')
      or lower(coalesce(profiles.profile ->> 'status', ''))
        in ('approved', 'active')
      or lower(coalesce(profiles.profile ->> 'state', ''))
        in ('approved', 'active')
    )
  );
$$;

revoke all on function public.coreone_partnerhub_is_approved_staff(uuid)
  from public, anon, authenticated;


-- Give the signed-in approved staff member their own code.
-- Calling this again returns the existing code rather than creating another.
create or replace function public.coreone_partnerhub_my_referral_code()
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_code text;
begin
  if v_user_id is null then
    raise exception 'Please sign in first.';
  end if;

  if not public.coreone_partnerhub_is_approved_staff(v_user_id) then
    raise exception 'Referral codes are available to approved staff only.';
  end if;

  select referral_code
    into v_code
  from public.coreone_partner_referral_codes
  where partner_id = v_user_id;

  if v_code is not null then
    return v_code;
  end if;

  loop
    v_code := 'C1-' || upper(substr(
      md5(random()::text || clock_timestamp()::text || v_user_id::text),
      1, 8
    ));

    insert into public.coreone_partner_referral_codes (
      partner_id, referral_code
    )
    values (v_user_id, v_code)
    on conflict do nothing;

    select referral_code
      into v_code
    from public.coreone_partner_referral_codes
    where partner_id = v_user_id;

    exit when v_code is not null;
  end loop;

  return v_code;
end;
$$;

revoke all on function public.coreone_partnerhub_my_referral_code()
  from public, anon;
grant execute on function public.coreone_partnerhub_my_referral_code()
  to authenticated;


-- Validate a code during registration in CoreOne or BrainLeague.
-- A valid code returns the linked staff account ID; an invalid code
-- returns no rows. Registration can continue without calling this function.
create or replace function public.coreone_partnerhub_validate_referral_code(
  supplied_code text
)
returns table (
  partner_id uuid,
  referral_code text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select c.partner_id, c.referral_code
  from public.coreone_partner_referral_codes c
  where upper(trim(coalesce(supplied_code, ''))) = upper(c.referral_code)
    and public.coreone_partnerhub_is_approved_staff(c.partner_id);
$$;

revoke all on function public.coreone_partnerhub_validate_referral_code(text)
  from public;
grant execute on function public.coreone_partnerhub_validate_referral_code(text)
  to anon, authenticated;


-- Admin report: all staff who have a referral code.
create or replace function public.coreone_partnerhub_list_referral_codes()
returns table (
  partner_id uuid,
  referral_code text,
  staff_name text,
  email text,
  created_at timestamptz
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
    ) as staff_name,
    u.email::text,
    c.created_at
  from public.coreone_partner_referral_codes c
  join auth.users u on u.id = c.partner_id
  where public.coreone_partnerhub_is_approved_staff(c.partner_id)
  order by c.created_at desc;
end;
$$;

revoke all on function public.coreone_partnerhub_list_referral_codes()
  from public, anon;
grant execute on function public.coreone_partnerhub_list_referral_codes()
  to authenticated;
