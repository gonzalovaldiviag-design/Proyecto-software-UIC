/*
# Add campos de catastro to equipos

1. Modified Tables
- `equipos`
  - `inventario` (text, nullable) — número de inventario del equipo
  - `anio_adquisicion` (integer, nullable) — año de adquisición del equipo
  - `orden_compra` (text, nullable) — orden de compra asociada
  - `acta_entrega` (text, nullable) — acta de entrega del equipo
  - `vida_util` (integer, nullable) — vida útil en años
  - `vida_util_residual` (integer, nullable) — vida útil residual en años
  - `modalidad_adquisicion` (text, nullable) — PROPIO / ARRIENDO / COMODATO
2. Security
- No changes to RLS; existing policies remain intact.
3. Notes
- All new columns are nullable so existing rows remain valid.
- The existing `ubicacion` column now represents "Servicio Clínico".
*/

ALTER TABLE equipos
  ADD COLUMN IF NOT EXISTS inventario text,
  ADD COLUMN IF NOT EXISTS anio_adquisicion integer,
  ADD COLUMN IF NOT EXISTS orden_compra text,
  ADD COLUMN IF NOT EXISTS acta_entrega text,
  ADD COLUMN IF NOT EXISTS vida_util integer,
  ADD COLUMN IF NOT EXISTS vida_util_residual integer,
  ADD COLUMN IF NOT EXISTS modalidad_adquisicion text;
