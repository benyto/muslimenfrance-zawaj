-- communes_fr/regions/departments are seeded directly in migration
-- 20260802140000_communes_fr.sql (regions/departments from
-- data/regions-departements.json) and by importing the ~34,900-row
-- communes_fr dataset — not reproduced here for local dev.

-- Disabled until Stripe products actually exist — flip `enabled` and fill
-- in stripe_product_id/stripe_price_id once the Stripe account is set up
-- (Phase 6). `audience = 'all'` is the default recommendation from the
-- project plan; change to 'male'/'female' rows if the gender-split pricing
-- model from the old monolith is kept instead.
insert into public.subscription_products (audience, name, price_amount, currency, interval, trial_period_days, enabled)
values ('all', 'Abonnement Rencontre', 999, 'eur', 'month', 7, false)
on conflict (audience) do nothing;
