-- =====================================================================
-- Lockstrm — V9: normalización de email y username
-- =====================================================================
-- A partir de UserService.normalizarEmail / normalizarUsername, todos los
-- nuevos registros se persisten en minúsculas y sin espacios laterales.
-- Esta migración alinea las filas históricas con esa convención para que
-- el login (que compara siempre case-insensitive) funcione de forma
-- uniforme y la unicidad lógica coincida con los UNIQUE constraints.
--
-- Si hubiera duplicados *solo* por diferencias de mayúsculas (p. ej.
-- "ana@mail.com" y "Ana@mail.com" como dos filas distintas), este UPDATE
-- fallará por violación de UNIQUE — comportamiento deseado: detener la
-- migración para que el operador decida qué fila conservar.
--
-- Consulta de diagnóstico previo (ejecutar manualmente si la migración
-- falla):
--   SELECT LOWER(email) AS e, COUNT(*) FROM usuarios
--     GROUP BY e HAVING COUNT(*) > 1;
--   SELECT LOWER(username) AS u, tag, COUNT(*) FROM usuarios
--     GROUP BY u, tag HAVING COUNT(*) > 1;
-- =====================================================================

UPDATE usuarios
   SET email    = LOWER(TRIM(email)),
       username = LOWER(TRIM(username));
