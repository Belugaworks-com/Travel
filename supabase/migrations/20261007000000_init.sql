-- SkyPlan initial schema.
-- Users come from Supabase Auth (auth.users); `profiles` holds app data.
-- Every table is owner-scoped with row level security.

create type public.cabin as enum ('economy', 'premium_economy', 'business', 'first');
create type public.fare_mode as enum ('commercial', 'id50', 'id90', 'zed');
create type public.staff_relationship as enum ('employee', 'spouse', 'dependent', 'parent', 'companion');
create type public.privilege_level as enum ('id90_standby', 'id50_confirmed', 'zed_interline', 'duty');
create type public.booking_status as enum ('planned', 'listed', 'confirmed', 'checked_in', 'boarded', 'denied', 'cancelled');

create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Users ---------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  home_airport char(3) check (home_airport ~ '^[A-Z]{3}$'),
  currency char(3) not null default 'USD',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Staff travel --------------------------------------------------------------

create table public.staff_travel_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  airline_code char(2) not null check (airline_code ~ '^[A-Z0-9]{2}$'),
  relationship public.staff_relationship not null default 'employee',
  seniority_date date,
  privilege_level public.privilege_level not null default 'id90_standby',
  zed_eligible boolean not null default true,
  -- Optional per-employer overrides of the fare engine defaults (discounts, ZED table).
  fare_rules jsonb,
  is_primary boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, airline_code, relationship)
);

create unique index staff_travel_profiles_one_primary
  on public.staff_travel_profiles (user_id) where is_primary;

-- Trips & bookings ----------------------------------------------------------

create table public.trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (length(name) between 1 and 120),
  starts_on date,
  ends_on date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_on is null or starts_on is null or ends_on >= starts_on)
);

create index trips_user_id_idx on public.trips (user_id, starts_on);

create table public.flight_bookings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  trip_id uuid references public.trips (id) on delete cascade,
  origin char(3) not null check (origin ~ '^[A-Z]{3}$'),
  destination char(3) not null check (destination ~ '^[A-Z]{3}$'),
  departs_at timestamptz not null,
  arrives_at timestamptz,
  airline_code char(2) not null,
  flight_number text not null,
  aircraft text,
  cabin public.cabin not null default 'economy',
  fare_mode public.fare_mode not null default 'commercial',
  status public.booking_status not null default 'planned',
  base_fare numeric(10, 2),
  taxes numeric(10, 2),
  carrier_surcharge numeric(10, 2),
  currency char(3) not null default 'USD',
  -- SerpApi booking token or airline record locator.
  booking_reference text,
  -- Position in a trip's timeline, for drag-and-drop ordering.
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (origin <> destination),
  check (arrives_at is null or arrives_at > departs_at)
);

create index flight_bookings_trip_idx on public.flight_bookings (trip_id, sort_order);
create index flight_bookings_user_departs_idx on public.flight_bookings (user_id, departs_at);

-- Alerts & saved routes -----------------------------------------------------

create table public.price_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  origin char(3) not null check (origin ~ '^[A-Z]{3}$'),
  destination char(3) not null check (destination ~ '^[A-Z]{3}$'),
  depart_from date not null,
  depart_to date not null,
  cabin public.cabin not null default 'economy',
  fare_mode public.fare_mode not null default 'commercial',
  max_price numeric(10, 2) check (max_price > 0),
  currency char(3) not null default 'USD',
  last_price numeric(10, 2),
  last_checked_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (origin <> destination),
  check (depart_to >= depart_from)
);

create index price_alerts_active_idx on public.price_alerts (is_active, last_checked_at) where is_active;

create table public.saved_routes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  origin char(3) not null check (origin ~ '^[A-Z]{3}$'),
  destination char(3) not null check (destination ~ '^[A-Z]{3}$'),
  label text,
  created_at timestamptz not null default now(),
  check (origin <> destination),
  unique (user_id, origin, destination)
);

-- updated_at triggers -------------------------------------------------------

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger staff_travel_profiles_updated_at before update on public.staff_travel_profiles
  for each row execute function public.set_updated_at();
create trigger trips_updated_at before update on public.trips
  for each row execute function public.set_updated_at();
create trigger flight_bookings_updated_at before update on public.flight_bookings
  for each row execute function public.set_updated_at();
create trigger price_alerts_updated_at before update on public.price_alerts
  for each row execute function public.set_updated_at();

-- A booking's trip must belong to the same user.
create or replace function public.check_booking_trip_owner() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.trip_id is not null and not exists (
    select 1 from public.trips t where t.id = new.trip_id and t.user_id = new.user_id
  ) then
    raise exception 'trip % does not belong to this user', new.trip_id;
  end if;
  return new;
end;
$$;

create trigger flight_bookings_trip_owner before insert or update on public.flight_bookings
  for each row execute function public.check_booking_trip_owner();

-- Create a profile when someone signs up.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name');
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Row level security ----------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.staff_travel_profiles enable row level security;
alter table public.trips enable row level security;
alter table public.flight_bookings enable row level security;
alter table public.price_alerts enable row level security;
alter table public.saved_routes enable row level security;

create policy "Own profile" on public.profiles
  for all to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create policy "Own staff travel profiles" on public.staff_travel_profiles
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Own trips" on public.trips
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Own flight bookings" on public.flight_bookings
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Own price alerts" on public.price_alerts
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Own saved routes" on public.saved_routes
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
