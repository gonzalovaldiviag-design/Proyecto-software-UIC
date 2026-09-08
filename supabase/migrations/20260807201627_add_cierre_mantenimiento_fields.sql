/*
# Add work-closure fields to mantenimientos

1. Modified Tables
- `mantenimientos`
  - `descripcion_trabajo_realizado` (text, nullable) — free-text description of the work performed when closing out a maintenance request.
  - `fecha_cierre` (date, nullable) — the date the maintenance work was closed/completed.
  - `horas_hombre` (numeric, nullable) — man-hours spent on the maintenance work.

2. Security
- No changes to RLS. Existing policies remain in effect. All three columns are nullable so existing rows are unaffected.

3. Important Notes
- All three columns are optional (nullable) since they are only filled in when closing/editing a maintenance record.
- `horas_hombre` uses numeric to allow fractional hours (e.g. 1.5 hours).
*/

ALTER TABLE mantenimientos
  ADD COLUMN IF NOT EXISTS descripcion_trabajo_realizado text,
  ADD COLUMN IF NOT EXISTS fecha_cierre date,
  ADD COLUMN IF NOT EXISTS horas_hombre numeric(8,2);
