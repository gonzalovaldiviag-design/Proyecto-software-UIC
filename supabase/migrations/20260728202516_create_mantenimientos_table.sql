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
