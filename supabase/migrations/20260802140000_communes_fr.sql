-- Replaces the thin, manually-curated `cities` table with a proper French
-- geography taxonomy: `regions`/`departments` (seeded below from the
-- muslimenfrance monolith's `data/regions-departements.json` — the
-- canonical region/department name+code list used across the product
-- family) and `communes_fr`.
--
-- NOTE: public.communes_fr already exists on this project (the full
-- "communes de France" INSEE dataset, ~34,900 rows, same one the monolith
-- uses at data/regions-departements.json's sibling `communes_fr` table —
-- provisioned directly via CSV import, not through a migration). This file
-- does not recreate it; it only adds the RLS/grants this project's other
-- reference tables use (it currently has none — even the anon key can read
-- it), a search index, and a FK tying its `dep_code` to the new
-- `departments` table.

create table public.regions (
  code text primary key,
  name text not null,
  slug text not null
);

create table public.departments (
  code text primary key,
  name text not null,
  slug text not null,
  region_code text not null references public.regions(code)
);

create index departments_region_code_idx on public.departments (region_code);

insert into public.regions (code, name, slug) values
  ('84', 'Auvergne-Rhône-Alpes', 'auvergne-rhone-alpes'),
  ('27', 'Bourgogne-Franche-Comté', 'bourgogne-franche-comte'),
  ('53', 'Bretagne', 'bretagne'),
  ('24', 'Centre-Val de Loire', 'centre-val-de-loire'),
  ('94', 'Corse', 'corse'),
  ('44', 'Grand Est', 'grand-est'),
  ('32', 'Hauts-de-France', 'hauts-de-france'),
  ('11', 'Île-de-France', 'ile-de-france'),
  ('28', 'Normandie', 'normandie'),
  ('75', 'Nouvelle-Aquitaine', 'nouvelle-aquitaine'),
  ('76', 'Occitanie', 'occitanie'),
  ('52', 'Pays de la Loire', 'pays-de-la-loire'),
  ('93', 'Provence-Alpes-Côte d''Azur', 'provence-alpes-cote-d-azur'),
  ('01', 'Guadeloupe', 'guadeloupe'),
  ('02', 'Martinique', 'martinique'),
  ('03', 'Guyane', 'guyane'),
  ('04', 'La Réunion', 'la-reunion'),
  ('06', 'Mayotte', 'mayotte');

insert into public.departments (code, name, slug, region_code) values
  ('01', 'Ain', 'ain', '84'),
  ('03', 'Allier', 'allier', '84'),
  ('07', 'Ardèche', 'ardeche', '84'),
  ('15', 'Cantal', 'cantal', '84'),
  ('26', 'Drôme', 'drome', '84'),
  ('38', 'Isère', 'isere', '84'),
  ('42', 'Loire', 'loire', '84'),
  ('43', 'Haute-Loire', 'haute-loire', '84'),
  ('63', 'Puy-de-Dôme', 'puy_de_dome', '84'),
  ('69', 'Rhône', 'rhone', '84'),
  ('73', 'Savoie', 'savoie', '84'),
  ('74', 'Haute-Savoie', 'haute_savoie', '84'),
  ('21', 'Côte-d''Or', 'cote_d_or', '27'),
  ('25', 'Doubs', 'doubs', '27'),
  ('39', 'Jura', 'jura', '27'),
  ('58', 'Nièvre', 'nievre', '27'),
  ('70', 'Haute-Saône', 'haute_saone', '27'),
  ('71', 'Saône-et-Loire', 'saone_et_loire', '27'),
  ('89', 'Yonne', 'yonne', '27'),
  ('90', 'Territoire de Belfort', 'territoire_de_belfort', '27'),
  ('22', 'Côtes-d''Armor', 'cotes_d_armor', '53'),
  ('29', 'Finistère', 'finistere', '53'),
  ('35', 'Ille-et-Vilaine', 'ille_et_vilaine', '53'),
  ('56', 'Morbihan', 'morbihan', '53'),
  ('18', 'Cher', 'cher', '24'),
  ('28', 'Eure-et-Loir', 'eure_et_loir', '24'),
  ('36', 'Indre', 'indre', '24'),
  ('37', 'Indre-et-Loire', 'indre_et_loire', '24'),
  ('41', 'Loir-et-Cher', 'loir_et_cher', '24'),
  ('45', 'Loiret', 'loiret', '24'),
  ('2A', 'Corse-du-Sud', 'corse_du_sud', '94'),
  ('2B', 'Haute-Corse', 'haute_corse', '94'),
  ('08', 'Ardennes', 'ardennes', '44'),
  ('10', 'Aube', 'aube', '44'),
  ('51', 'Marne', 'marne', '44'),
  ('52', 'Haute-Marne', 'haute_marne', '44'),
  ('54', 'Meurthe-et-Moselle', 'meurthe_et_moselle', '44'),
  ('55', 'Meuse', 'meuse', '44'),
  ('57', 'Moselle', 'moselle', '44'),
  ('67', 'Bas-Rhin', 'bas_rhin', '44'),
  ('68', 'Haut-Rhin', 'haut_rhin', '44'),
  ('88', 'Vosges', 'vosges', '44'),
  ('02', 'Aisne', 'aisne', '32'),
  ('59', 'Nord', 'nord', '32'),
  ('60', 'Oise', 'oise', '32'),
  ('62', 'Pas-de-Calais', 'pas_de_calais', '32'),
  ('80', 'Somme', 'somme', '32'),
  ('75', 'Paris', 'paris', '11'),
  ('77', 'Seine-et-Marne', 'seine_et_marne', '11'),
  ('78', 'Yvelines', 'yvelines', '11'),
  ('91', 'Essonne', 'essonne', '11'),
  ('92', 'Hauts-de-Seine', 'hauts_de_seine', '11'),
  ('93', 'Seine-Saint-Denis', 'seine_saint_denis', '11'),
  ('94', 'Val-de-Marne', 'val_de_marne', '11'),
  ('95', 'Val-d''Oise', 'val_d_oise', '11'),
  ('14', 'Calvados', 'calvados', '28'),
  ('27', 'Eure', 'eure', '28'),
  ('50', 'Manche', 'manche', '28'),
  ('61', 'Orne', 'orne', '28'),
  ('76', 'Seine-Maritime', 'seine_maritime', '28'),
  ('16', 'Charente', 'charente', '75'),
  ('17', 'Charente-Maritime', 'charente_maritime', '75'),
  ('19', 'Corrèze', 'correze', '75'),
  ('23', 'Creuse', 'creuse', '75'),
  ('24', 'Dordogne', 'dordogne', '75'),
  ('33', 'Gironde', 'gironde', '75'),
  ('40', 'Landes', 'landes', '75'),
  ('47', 'Lot-et-Garonne', 'lot_et_garonne', '75'),
  ('64', 'Pyrénées-Atlantiques', 'pyrenees_atlantiques', '75'),
  ('79', 'Deux-Sèvres', 'deux_sevres', '75'),
  ('86', 'Vienne', 'vienne', '75'),
  ('87', 'Haute-Vienne', 'haute_vienne', '75'),
  ('09', 'Ariège', 'ariege', '76'),
  ('11', 'Aude', 'aude', '76'),
  ('12', 'Aveyron', 'aveyron', '76'),
  ('30', 'Gard', 'gard', '76'),
  ('31', 'Haute-Garonne', 'haute_garonne', '76'),
  ('32', 'Gers', 'gers', '76'),
  ('34', 'Hérault', 'herault', '76'),
  ('46', 'Lot', 'lot', '76'),
  ('48', 'Lozère', 'lozere', '76'),
  ('65', 'Hautes-Pyrénées', 'hautes_pyrenees', '76'),
  ('66', 'Pyrénées-Orientales', 'pyrenees_orientales', '76'),
  ('81', 'Tarn', 'tarn', '76'),
  ('82', 'Tarn-et-Garonne', 'tarn_et_garonne', '76'),
  ('44', 'Loire-Atlantique', 'loire_atlantique', '52'),
  ('49', 'Maine-et-Loire', 'maine_et_loire', '52'),
  ('53', 'Mayenne', 'mayenne', '52'),
  ('72', 'Sarthe', 'sarthe', '52'),
  ('85', 'Vendée', 'vendee', '52'),
  ('04', 'Alpes-de-Haute-Provence', 'alpes_de_haute_provence', '93'),
  ('05', 'Hautes-Alpes', 'hautes_alpes', '93'),
  ('06', 'Alpes-Maritimes', 'alpes_maritimes', '93'),
  ('13', 'Bouches-du-Rhône', 'bouches_du_rhone', '93'),
  ('83', 'Var', 'var', '93'),
  ('84', 'Vaucluse', 'vaucluse', '93'),
  ('971', 'Guadeloupe', 'guadeloupe', '01'),
  ('972', 'Martinique', 'martinique', '02'),
  ('973', 'Guyane', 'guyane', '03'),
  ('974', 'La Réunion', 'la_reunion', '04'),
  ('976', 'Mayotte', 'mayotte', '06');

-- communes_fr.dep_code values (verified: all 101 distinct values present in
-- the live data match a department.code above exactly) now tie back to the
-- canonical department list.
alter table public.communes_fr
  add constraint communes_fr_dep_code_fkey foreign key (dep_code) references public.departments(code);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.communes_fr'::regclass and contype = 'p'
  ) then
    alter table public.communes_fr add primary key (code_insee);
  end if;
end $$;

create index if not exists communes_fr_dep_code_idx on public.communes_fr (dep_code);
create index if not exists communes_fr_reg_code_idx on public.communes_fr (reg_code);
create index if not exists communes_fr_code_postal_idx on public.communes_fr (code_postal);

-- Trigram index for typeahead search (ILIKE '%term%' can't use a plain
-- btree index; pg_trgm's GIN index can). Supabase projects have the
-- `extensions` schema on the default search_path, so gin_trgm_ops resolves
-- unqualified once the extension is created.
create extension if not exists pg_trgm with schema extensions;
create index if not exists communes_fr_nom_sans_accent_trgm_idx
  on public.communes_fr using gin (nom_sans_accent gin_trgm_ops);

alter table public.regions enable row level security;
alter table public.departments enable row level security;
alter table public.communes_fr enable row level security;

create policy "regions select public" on public.regions for select to authenticated using (true);
create policy "departments select public" on public.departments for select to authenticated using (true);
create policy "communes_fr select public" on public.communes_fr for select to authenticated using (true);

-- Reference data — only service_role (migration/seed scripts) can write.
-- communes_fr previously had no RLS/grant restrictions at all (even the
-- anon key could read and, per default Supabase table grants, write to
-- it) — lock it down to match every other reference table in this schema.
revoke insert, update, delete on public.regions from authenticated, anon;
revoke insert, update, delete on public.departments from authenticated, anon;
revoke all on public.communes_fr from authenticated, anon;
grant select on public.communes_fr to authenticated;
