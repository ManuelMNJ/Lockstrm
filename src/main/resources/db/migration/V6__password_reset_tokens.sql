CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id          BIGINT       NOT NULL AUTO_INCREMENT,
    token       VARCHAR(64)  NOT NULL,
    usuario_id  BIGINT       NOT NULL,
    expira_en   DATETIME(6)  NOT NULL,
    usado       TINYINT(1)   NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    CONSTRAINT uk_prt_token UNIQUE (token),
    CONSTRAINT fk_prt_usuario
        FOREIGN KEY (usuario_id) REFERENCES usuarios (id_usuario)
        ON DELETE CASCADE ON UPDATE RESTRICT,
    KEY idx_prt_token     (token),
    KEY idx_prt_usuario   (usuario_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
