/*
# Add tipo_mantenimiento column

1. Changes
- Add column `tipo_mantenimiento` (text, not null, default 'Correctivo') to `mantenimientos`.
- Backfill existing rows with 'Correctivo'.
- Add CHECK constraint to allow only 'Correctivo' or 'Preventivo'.
2. Security
- No policy changes.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'mantenimientos' AND column_name = 'tipo_mantenimiento'
  ) THEN
    ALTER TABLE mantenimientos ADD COLUMN tipo_mantenimiento text DEFAULT 'Correctivo';
  END IF;
END $$;

UPDATE mantenimientos SET tipo_mantenimiento = 'Correctivo' WHERE tipo_mantenimiento IS NULL;

ALTER TABLE mantenimientos ALTER COLUMN tipo_mantenimiento SET NOT NULL;

ALTER TABLE mantenimientos
  DROP CONSTRAINT IF EXISTS chk_tipo_mantenimiento;
ALTER TABLE mantenimientos
  ADD CONSTRAINT chk_tipo_mantenimiento
  CHECK (tipo_mantenimiento IN ('Correctivo', 'Preventivo'));
