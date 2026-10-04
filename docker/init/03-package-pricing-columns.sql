-- Adds per-package pricing for attractions and records the selected type on reservations.
-- Safe to run against an existing database or during first-time Docker initialization.
ALTER TABLE atracciones
  ADD COLUMN IF NOT EXISTS package_prices jsonb;

ALTER TABLE reservas_atracciones
  ADD COLUMN IF NOT EXISTS product_type varchar;
