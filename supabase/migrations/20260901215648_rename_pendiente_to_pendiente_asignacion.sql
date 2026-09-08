/*
  # Rename estado_mantenimiento 'Pendiente' to 'Pendiente de Asignación'

  1. Backfill existing rows
  2. Change column default
  3. Add CHECK constraint for the three valid states
  4. Security — no policy changes
*/

UPDATE mantenimientos
   SET estado_mantenimiento = 'Pendiente de Asignación'
 WHERE estado_mantenimiento = 'Pendiente';

ALTER TABLE mantenimientos
  ALTER COLUMN estado_mantenimiento SET DEFAULT 'Pendiente de Asignación';

ALTER TABLE mantenimientos
  DROP CONSTRAINT IF EXISTS chk_estado_mantenimiento;

ALTER TABLE mantenimientos
  ADD CONSTRAINT chk_estado_mantenimiento
  CHECK (estado_mantenimiento IN ('Pendiente de Asignación', 'En proceso', 'Completado'));
