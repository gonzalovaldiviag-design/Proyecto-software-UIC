/*
  # Make asignado_a nullable

  Maintenance requests can now be created without an assignment.
  The assignment becomes required only when the state moves to "En proceso".
*/

ALTER TABLE mantenimientos
  ALTER COLUMN asignado_a DROP NOT NULL;
