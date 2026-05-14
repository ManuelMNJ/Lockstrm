-- =====================================================================
-- Lockstrm — V8: fechas de auditoría y password a NOT NULL
-- =====================================================================
-- Todas las entidades JPA rellenan estas columnas vía @PrePersist /
-- setPassword(encode(...)) antes de persistir, pero el esquema las dejaba
-- como NULL por herencia de ddl-auto=update. Alineamos el esquema con la
-- realidad del código.
--
-- Los UPDATE previos sanean filas históricas que pudieran tener NULL
-- (entornos de desarrollo antiguos). En filas correctas no afectan nada.
-- Para password se usa un placeholder no-funcional: una cuenta que
-- tuviese password NULL ya estaba bloqueada (no podía iniciar sesión),
-- y un hash inválido mantiene esa misma propiedad sin romper la columna.
-- =====================================================================

-- Saneado de NULLs en fechas (defensivo)
UPDATE usuarios       SET fecha_registro = NOW(6) WHERE fecha_registro IS NULL;
UPDATE videos         SET fecha_subida   = NOW(6) WHERE fecha_subida   IS NULL;
UPDATE grupos         SET fecha_creacion = NOW(6) WHERE fecha_creacion IS NULL;
UPDATE miembros_grupo SET fecha_union    = NOW(6) WHERE fecha_union    IS NULL;
UPDATE logs           SET fecha_hora     = NOW(6) WHERE fecha_hora     IS NULL;

-- Saneado de NULLs en password (defensivo): placeholder no-funcional.
UPDATE usuarios SET password = '!locked-no-password!' WHERE password IS NULL;

-- Endurecimiento de columnas
ALTER TABLE usuarios       MODIFY COLUMN fecha_registro DATETIME(6)  NOT NULL;
ALTER TABLE usuarios       MODIFY COLUMN password       VARCHAR(255) NOT NULL;
ALTER TABLE videos         MODIFY COLUMN fecha_subida   DATETIME(6)  NOT NULL;
ALTER TABLE grupos         MODIFY COLUMN fecha_creacion DATETIME(6)  NOT NULL;
ALTER TABLE miembros_grupo MODIFY COLUMN fecha_union    DATETIME(6)  NOT NULL;
ALTER TABLE logs           MODIFY COLUMN fecha_hora     DATETIME(6)  NOT NULL;
