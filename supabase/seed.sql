-- Local dev seed data only. The real `cities` migration (the subset
-- actually referenced by migrated profiles) happens in Phase 10, from the
-- muslimenfrance monolith's `cities` table — this is just enough to
-- develop/test against locally.
insert into public.cities (name, postal_code, department, region) values
  ('Paris', '75000', 'Paris', 'Île-de-France'),
  ('Lyon', '69000', 'Rhône', 'Auvergne-Rhône-Alpes'),
  ('Marseille', '13000', 'Bouches-du-Rhône', 'Provence-Alpes-Côte d''Azur'),
  ('Lille', '59000', 'Nord', 'Hauts-de-France'),
  ('Toulouse', '31000', 'Haute-Garonne', 'Occitanie')
on conflict do nothing;

-- Disabled until Stripe products actually exist — flip `enabled` and fill
-- in stripe_product_id/stripe_price_id once the Stripe account is set up
-- (Phase 6). `audience = 'all'` is the default recommendation from the
-- project plan; change to 'male'/'female' rows if the gender-split pricing
-- model from the old monolith is kept instead.
insert into public.subscription_products (audience, name, price_amount, currency, interval, trial_period_days, enabled)
values ('all', 'Abonnement Rencontre', 999, 'eur', 'month', 7, false)
on conflict (audience) do nothing;
