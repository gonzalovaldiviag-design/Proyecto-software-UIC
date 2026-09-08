/*
# Agregar columna "serie" a la tabla equipos

1. Cambios en tablas existentes
- `equipos`: agregar columna `serie` (text, no nula) que representa el número de serie del equipo.
  Se agrega como nullable primero, luego se llena con valores por defecto para las filas existentes,
  y finalmente se establece como NOT NULL para que sea obligatorio en nuevos registros.
2. Seguridad
- Sin cambios en RLS (las políticas existentes siguen vigentes).
3. Notas
- La columna se ubica conceptualmente después de "modelo", siguiendo el orden del formulario.
*/

ALTER TABLE equipos ADD COLUMN IF NOT EXISTS serie text;

-- Llenar filas existentes con un valor por defecto para poder establecer NOT NULL
UPDATE equipos SET serie = 'S/N' WHERE serie IS NULL;

ALTER TABLE equipos ALTER COLUMN serie SET NOT NULL;
