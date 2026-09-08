/*
# Crear tabla de equipos de inventario (single-tenant, sin auth)

1. Tablas nuevas
- `equipos`
  - `id` (uuid, clave primaria)
  - `codigo` (text, no nulo) â€” CÃ³digo/ID Ãºnico del equipo
  - `nombre` (text, no nulo) â€” Nombre del equipo
  - `marca` (text) â€” Marca del equipo
  - `modelo` (text) â€” Modelo del equipo
  - `ubicacion` (text) â€” UbicaciÃ³n o servicio donde se encuentra
  - `estado` (text, no nulo, default 'Operativo') â€” Estado: Operativo, Mantenimiento, Dado de baja
  - `created_at` (timestamptz) â€” Fecha de creaciÃ³n
2. Seguridad
- Activar RLS en `equipos`.
- Permitir CRUD a anon y authenticated porque los datos son intencionalmente compartidos (app sin login).
3. Datos de ejemplo
- Insertar 10 equipos de ejemplo para probar la interfaz.
*/

CREATE TABLE IF NOT EXISTS equipos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL,
  nombre text NOT NULL,
  marca text,
  modelo text,
  ubicacion text,
  estado text NOT NULL DEFAULT 'Operativo',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE equipos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_equipos" ON equipos;
CREATE POLICY "anon_select_equipos" ON equipos FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_equipos" ON equipos;
CREATE POLICY "anon_insert_equipos" ON equipos FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_equipos" ON equipos;
CREATE POLICY "anon_update_equipos" ON equipos FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_equipos" ON equipos;
CREATE POLICY "anon_delete_equipos" ON equipos FOR DELETE
  TO anon, authenticated USING (true);

-- Datos de ejemplo
INSERT INTO equipos (codigo, nombre, marca, modelo, ubicacion, estado) VALUES
  ('EQ-001', 'Monitor de Signos Vitales', 'Philips', 'MX450', 'UCI - Sala 3', 'Operativo'),
  ('EQ-002', 'Respirador MecÃ¡nico', 'DrÃ¤ger', 'Evita V500', 'UCI - Sala 3', 'Mantenimiento'),
  ('EQ-003', 'Bomba de InfusiÃ³n', 'B.Braun', 'Infusomat Space', 'PabellÃ³n QuirÃºrgico', 'Operativo'),
  ('EQ-004', 'ElectrocardiÃ³grafo', 'GE Healthcare', 'MAC 5500', 'CardiologÃ­a', 'Operativo'),
  ('EQ-005', 'Desfibrilador', 'Zoll', 'R Series', 'Emergencias', 'Operativo'),
  ('EQ-006', 'EcÃ³grafo PortÃ¡til', 'Sonosite', 'Edge III', 'Maternidad', 'Mantenimiento'),
  ('EQ-007', 'Mesa de CirugÃ­a', 'Maquet', 'Magnus 1200', 'PabellÃ³n QuirÃºrgico', 'Operativo'),
  ('EQ-008', 'LÃ¡mpara CialÃ­tica', 'Hillrom', 'TruLight', 'PabellÃ³n QuirÃºrgico', 'Operativo'),
  ('EQ-009', 'Autoclave', 'Tuttnauer', '3870EA', 'EsterilizaciÃ³n', 'Dado de baja'),
  ('EQ-010', 'CentrÃ­fuga de Laboratorio', 'Eppendorf', '5810R', 'Laboratorio', 'Operativo')
ON CONFLICT DO NOTHING;
/*
# Agregar columna "serie" a la tabla equipos

1. Cambios en tablas existentes
- `equipos`: agregar columna `serie` (text, no nula) que representa el nÃºmero de serie del equipo.
  Se agrega como nullable primero, luego se llena con valores por defecto para las filas existentes,
  y finalmente se establece como NOT NULL para que sea obligatorio en nuevos registros.
2. Seguridad
- Sin cambios en RLS (las polÃ­ticas existentes siguen vigentes).
3. Notas
- La columna se ubica conceptualmente despuÃ©s de "modelo", siguiendo el orden del formulario.
*/

ALTER TABLE equipos ADD COLUMN IF NOT EXISTS serie text;

-- Llenar filas existentes con un valor por defecto para poder establecer NOT NULL
UPDATE equipos SET serie = 'S/N' WHERE serie IS NULL;

ALTER TABLE equipos ALTER COLUMN serie SET NOT NULL;
/*
# Create mantenimientos table

1. New Tables
- `mantenimientos`
  - `id` (uuid, primary key, auto-generated)
  - `equipo_id` (uuid, nullable, FK to equipos.id ON DELETE SET NULL)
  - `equipo_identificacion` (text, not null) - codigo del equipo registrado o identificador ingresado manualmente
  - `problema_reportado` (text, not null) - descripcion del problema reportado
  - `solicitado_por` (text, not null) - nombre de quien solicita el mantenimiento
  - `asignado_a` (text, not null) - nombre de a quien se le asigna el requerimiento
  - `fecha_requerimiento` (date, not null) - fecha del requerimiento de mantenimiento
  - `estado_mantenimiento` (text, not null, default 'Pendiente') - estado: Pendiente, En proceso, Completado
  - `created_at` (timestamptz, default now())
2. Security
- Enable RLS on `mantenimientos`.
- Allow anon + authenticated CRUD (single-tenant, no auth app).
3. Notes
- `equipo_id` is nullable to support equipment not registered in the database.
- `equipo_identificacion` always stores a human-readable identifier for display.
*/

CREATE TABLE IF NOT EXISTS mantenimientos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  equipo_id uuid REFERENCES equipos(id) ON DELETE SET NULL,
  equipo_identificacion text NOT NULL,
  problema_reportado text NOT NULL,
  solicitado_por text NOT NULL,
  asignado_a text NOT NULL,
  fecha_requerimiento date NOT NULL,
  estado_mantenimiento text NOT NULL DEFAULT 'Pendiente',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mantenimientos_equipo_id ON mantenimientos(equipo_id);
CREATE INDEX IF NOT EXISTS idx_mantenimientos_created_at ON mantenimientos(created_at DESC);

ALTER TABLE mantenimientos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_mantenimientos" ON mantenimientos;
CREATE POLICY "anon_select_mantenimientos" ON mantenimientos FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_mantenimientos" ON mantenimientos;
CREATE POLICY "anon_insert_mantenimientos" ON mantenimientos FOR INSERT
TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_mantenimientos" ON mantenimientos;
CREATE POLICY "anon_update_mantenimientos" ON mantenimientos FOR UPDATE
TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_mantenimientos" ON mantenimientos;
CREATE POLICY "anon_delete_mantenimientos" ON mantenimientos FOR DELETE
TO anon, authenticated USING (true);
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
/*
# Add work-closure fields to mantenimientos

1. Modified Tables
- `mantenimientos`
  - `descripcion_trabajo_realizado` (text, nullable) â€” free-text description of the work performed when closing out a maintenance request.
  - `fecha_cierre` (date, nullable) â€” the date the maintenance work was closed/completed.
  - `horas_hombre` (numeric, nullable) â€” man-hours spent on the maintenance work.

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
/*
# Create fallas_mantenimiento table

1. New Tables
- `fallas_mantenimiento`
  - `id` (uuid, primary key, auto-generated)
  - `mantenimiento_id` (uuid, not null, FK to mantenimientos.id ON DELETE CASCADE)
  - `descripcion_falla` (text, not null) â€” description of the new failure added
  - `registrado_por` (text, not null) â€” name of the user who registered the new failure
  - `fecha_registro` (timestamptz, not null, default now()) â€” timestamp of when the failure was registered
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
/*
# Add campos de catastro to equipos

1. Modified Tables
- `equipos`
  - `inventario` (text, nullable) â€” nÃºmero de inventario del equipo
  - `anio_adquisicion` (integer, nullable) â€” aÃ±o de adquisiciÃ³n del equipo
  - `orden_compra` (text, nullable) â€” orden de compra asociada
  - `acta_entrega` (text, nullable) â€” acta de entrega del equipo
  - `vida_util` (integer, nullable) â€” vida Ãºtil en aÃ±os
  - `vida_util_residual` (integer, nullable) â€” vida Ãºtil residual en aÃ±os
  - `modalidad_adquisicion` (text, nullable) â€” PROPIO / ARRIENDO / COMODATO
2. Security
- No changes to RLS; existing policies remain intact.
3. Notes
- All new columns are nullable so existing rows remain valid.
- The existing `ubicacion` column now represents "Servicio ClÃ­nico".
*/

ALTER TABLE equipos
  ADD COLUMN IF NOT EXISTS inventario text,
  ADD COLUMN IF NOT EXISTS anio_adquisicion integer,
  ADD COLUMN IF NOT EXISTS orden_compra text,
  ADD COLUMN IF NOT EXISTS acta_entrega text,
  ADD COLUMN IF NOT EXISTS vida_util integer,
  ADD COLUMN IF NOT EXISTS vida_util_residual integer,
  ADD COLUMN IF NOT EXISTS modalidad_adquisicion text;
/*
  # Rename estado_mantenimiento 'Pendiente' to 'Pendiente de AsignaciÃ³n'

  1. Backfill existing rows
  2. Change column default
  3. Add CHECK constraint for the three valid states
  4. Security â€” no policy changes
*/

UPDATE mantenimientos
   SET estado_mantenimiento = 'Pendiente de AsignaciÃ³n'
 WHERE estado_mantenimiento = 'Pendiente';

ALTER TABLE mantenimientos
  ALTER COLUMN estado_mantenimiento SET DEFAULT 'Pendiente de AsignaciÃ³n';

ALTER TABLE mantenimientos
  DROP CONSTRAINT IF EXISTS chk_estado_mantenimiento;

ALTER TABLE mantenimientos
  ADD CONSTRAINT chk_estado_mantenimiento
  CHECK (estado_mantenimiento IN ('Pendiente de AsignaciÃ³n', 'En proceso', 'Completado'));
/*
  # Make asignado_a nullable

  Maintenance requests can now be created without an assignment.
  The assignment becomes required only when the state moves to "En proceso".
*/

ALTER TABLE mantenimientos
  ALTER COLUMN asignado_a DROP NOT NULL;
/*
  # Add closure fields to mantenimientos

  1. New columns on `mantenimientos`:
     - `fotos_url` (text[], nullable) â€” array of photo URLs uploaded during closure
     - `documento_url` (text, nullable) â€” URL of an uploaded external report/document
     - `completado_por` (text, nullable) â€” name of the person who completed the work
     - `recibido_por` (text, nullable) â€” name of the person who received the completed work

  2. Security
     - No RLS policy changes needed; existing CRUD policies on `mantenimientos`
       already cover these new columns for the anon/authenticated roles.
*/

ALTER TABLE mantenimientos
  ADD COLUMN IF NOT EXISTS fotos_url text[],
  ADD COLUMN IF NOT EXISTS documento_url text,
  ADD COLUMN IF NOT EXISTS completado_por text,
  ADD COLUMN IF NOT EXISTS recibido_por text;
/*
  # Add documentos_url array column to mantenimientos

  1. New column on `mantenimientos`:
     - `documentos_url` (text[], nullable) â€” array of uploaded document/report URLs

  2. Data migration:
     - Any existing single `documento_url` value is copied into `documentos_url`
     as a one-element array so no data is lost.

  3. Security
     - No RLS policy changes needed; existing CRUD policies cover the new column.
*/

ALTER TABLE mantenimientos
  ADD COLUMN IF NOT EXISTS documentos_url text[];

UPDATE mantenimientos
SET documentos_url = ARRAY[documento_url]
WHERE documento_url IS NOT NULL AND documentos_url IS NULL;
ALTER TABLE mantenimientos
  ADD COLUMN IF NOT EXISTS accesorios_adicionales text;
