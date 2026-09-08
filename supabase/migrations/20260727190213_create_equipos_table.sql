/*
# Crear tabla de equipos de inventario (single-tenant, sin auth)

1. Tablas nuevas
- `equipos`
  - `id` (uuid, clave primaria)
  - `codigo` (text, no nulo) — Código/ID único del equipo
  - `nombre` (text, no nulo) — Nombre del equipo
  - `marca` (text) — Marca del equipo
  - `modelo` (text) — Modelo del equipo
  - `ubicacion` (text) — Ubicación o servicio donde se encuentra
  - `estado` (text, no nulo, default 'Operativo') — Estado: Operativo, Mantenimiento, Dado de baja
  - `created_at` (timestamptz) — Fecha de creación
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
  ('EQ-002', 'Respirador Mecánico', 'Dräger', 'Evita V500', 'UCI - Sala 3', 'Mantenimiento'),
  ('EQ-003', 'Bomba de Infusión', 'B.Braun', 'Infusomat Space', 'Pabellón Quirúrgico', 'Operativo'),
  ('EQ-004', 'Electrocardiógrafo', 'GE Healthcare', 'MAC 5500', 'Cardiología', 'Operativo'),
  ('EQ-005', 'Desfibrilador', 'Zoll', 'R Series', 'Emergencias', 'Operativo'),
  ('EQ-006', 'Ecógrafo Portátil', 'Sonosite', 'Edge III', 'Maternidad', 'Mantenimiento'),
  ('EQ-007', 'Mesa de Cirugía', 'Maquet', 'Magnus 1200', 'Pabellón Quirúrgico', 'Operativo'),
  ('EQ-008', 'Lámpara Cialítica', 'Hillrom', 'TruLight', 'Pabellón Quirúrgico', 'Operativo'),
  ('EQ-009', 'Autoclave', 'Tuttnauer', '3870EA', 'Esterilización', 'Dado de baja'),
  ('EQ-010', 'Centrífuga de Laboratorio', 'Eppendorf', '5810R', 'Laboratorio', 'Operativo')
ON CONFLICT DO NOTHING;
