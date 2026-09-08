/*
  # Add documentos_url array column to mantenimientos

  1. New column on `mantenimientos`:
     - `documentos_url` (text[], nullable) — array of uploaded document/report URLs

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
