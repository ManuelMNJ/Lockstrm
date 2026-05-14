-- =====================================================================
-- Lockstrm — V7: limpieza de índices redundantes
-- =====================================================================
-- `password_reset_tokens.token` ya tiene un índice UNIQUE
-- (uk_prt_token, creado en V6), por lo que el índice secundario
-- idx_prt_token sobre la misma columna era duplicado y no aportaba
-- mejoras de búsqueda. MySQL crea automáticamente un índice por cada
-- restricción UNIQUE.
-- =====================================================================

ALTER TABLE password_reset_tokens DROP INDEX idx_prt_token;
