/*
# Add sequential codigo to mantenimientos

1. Changes
- Create sequence `mantenimientos_codigo_seq` starting at 1.
- Add column `codigo` (text, not null, unique) to `mantenimientos`.
- Backfill existing rows with generated codes MANT-001, MANT-002, ... in created_at order.
- Set default for new rows to `MANT-` || lpad(nextval(...)::text, 3, '0') so every insert gets the next correlativo automatically.
- Add unique index on `codigo`.
2. Security
- No policy changes.
3. Notes
- The default expression uses nextval so the correlativo is assigned server-side, guaranteeing uniqueness without client coordination.
- Re-running is safe: sequence IF NOT EXISTS, column IF NOT EXISTS, index IF NOT EXISTS.
*/

CREATE SEQUENCE IF NOT EXISTS mantenimientos_codigo_seq START 1;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'mantenimientos' AND column_name = 'codigo'
  ) THEN
    ALTER TABLE mantenimientos ADD COLUMN codigo text;
  END IF;
END $$;

-- Backfill existing rows with correlativo in created_at order
DO $$
DECLARE
  r RECORD;
  n int := 0;
BEGIN
  FOR r IN
    SELECT id FROM mantenimientos WHERE codigo IS NULL ORDER BY created_at ASC
  LOOP
    n := n + 1;
    UPDATE mantenimientos
    SET codigo = 'MANT-' || lpad(n::text, 3, '0')
    WHERE id = r.id;
  END LOOP;
  -- Advance sequence past backfilled count
  IF n > 0 THEN
    PERFORM setval('mantenimientos_codigo_seq', n, true);
  END IF;
END $$;

ALTER TABLE mantenimientos ALTER COLUMN codigo SET NOT NULL;

ALTER TABLE mantenimientos
  ALTER COLUMN codigo SET DEFAULT 'MANT-' || lpad(nextval('mantenimientos_codigo_seq')::text, 3, '0');

CREATE UNIQUE INDEX IF NOT EXISTS idx_mantenimientos_codigo ON mantenimientos(codigo);
