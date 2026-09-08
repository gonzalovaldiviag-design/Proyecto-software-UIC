/*
  # Add closure fields to mantenimientos

  1. New columns on `mantenimientos`:
     - `fotos_url` (text[], nullable) — array of photo URLs uploaded during closure
     - `documento_url` (text, nullable) — URL of an uploaded external report/document
     - `completado_por` (text, nullable) — name of the person who completed the work
     - `recibido_por` (text, nullable) — name of the person who received the completed work

  2. Security
     - No RLS policy changes needed; existing CRUD policies on `mantenimientos`
       already cover these new columns for the anon/authenticated roles.
*/

ALTER TABLE mantenimientos
  ADD COLUMN IF NOT EXISTS fotos_url text[],
  ADD COLUMN IF NOT EXISTS documento_url text,
  ADD COLUMN IF NOT EXISTS completado_por text,
  ADD COLUMN IF NOT EXISTS recibido_por text;
