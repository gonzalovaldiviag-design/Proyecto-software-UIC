/*
# Create fallas_mantenimiento table

1. New Tables
- `fallas_mantenimiento`
  - `id` (uuid, primary key, auto-generated)
  - `mantenimiento_id` (uuid, not null, FK to mantenimientos.id ON DELETE CASCADE)
  - `descripcion_falla` (text, not null) — description of the new failure added
  - `registrado_por` (text, not null) — name of the user who registered the new failure
  - `fecha_registro` (timestamptz, not null, default now()) — timestamp of when the failure was registered
2. Security
- Enable RLS on `fallas_mantenimiento`.
- Allow anon + authenticated CRUD (single-tenant, no auth app).
3. Notes
- Each time a user adds a new failure to an existing maintenance, a row is inserted here
  to preserve a permanent audit trail of who registered the failure and when.
- The mantenimiento's `problema_reportado` is also updated with the new failure text,
  but this table provides the structured record with user and date.
*/

CREATE TABLE IF NOT EXISTS fallas_mantenimiento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mantenimiento_id uuid NOT NULL REFERENCES mantenimientos(id) ON DELETE CASCADE,
  descripcion_falla text NOT NULL,
  registrado_por text NOT NULL,
  fecha_registro timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fallas_mantenimiento_mantenimiento_id
  ON fallas_mantenimiento(mantenimiento_id);

CREATE INDEX IF NOT EXISTS idx_fallas_mantenimiento_fecha_registro
  ON fallas_mantenimiento(fecha_registro DESC);

ALTER TABLE fallas_mantenimiento ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_fallas_mantenimiento" ON fallas_mantenimiento;
CREATE POLICY "anon_select_fallas_mantenimiento" ON fallas_mantenimiento FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_fallas_mantenimiento" ON fallas_mantenimiento;
CREATE POLICY "anon_insert_fallas_mantenimiento" ON fallas_mantenimiento FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_fallas_mantenimiento" ON fallas_mantenimiento;
CREATE POLICY "anon_update_fallas_mantenimiento" ON fallas_mantenimiento FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_fallas_mantenimiento" ON fallas_mantenimiento;
CREATE POLICY "anon_delete_fallas_mantenimiento" ON fallas_mantenimiento FOR DELETE
  TO anon, authenticated USING (true);
