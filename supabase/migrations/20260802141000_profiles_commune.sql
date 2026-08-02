-- Swap profiles.city_id (uuid -> old `cities` table) for
-- profiles.commune_insee_code (text -> new `communes_fr` table). No
-- production profile data exists yet (pre-launch), so this is a drop/add
-- rather than a backfill migration.

alter table public.profiles drop constraint profiles_city_id_fkey;
drop index public.profiles_city_idx;
alter table public.profiles drop column city_id;

alter table public.profiles
  add column commune_insee_code text references public.communes_fr(code_insee);

create index profiles_commune_idx on public.profiles (commune_insee_code);

drop table public.cities;
