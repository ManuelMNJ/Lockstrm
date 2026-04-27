-- =====================================================================
-- Lockstrm — Baseline V1
-- Esquema inicial generado a partir de las entidades JPA tal como las
-- creaba ddl-auto=update. A partir de aquí los cambios de esquema deben
-- ir en migraciones nuevas (V2__..., V3__...). NUNCA editar V1 después
-- de aplicarse en algún entorno.
--
-- Convención: nombres de tabla y columna en snake_case en español, igual
-- que los @Table/@Column de las entidades. Charset utf8mb4 para soportar
-- emojis y nombres internacionales en títulos y usernames.
-- =====================================================================

-- ──────────────────────────────────────────────────────────────────────
-- USUARIOS
-- ──────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS usuarios (
    id_usuario     BIGINT       NOT NULL AUTO_INCREMENT,
    nombre         VARCHAR(255) NULL,
    apellidos      VARCHAR(255) NULL,
    username       VARCHAR(30)  NOT NULL,
    email          VARCHAR(255) NOT NULL,
    tag            VARCHAR(4)   NOT NULL,
    password       VARCHAR(255) NULL,
    fecha_registro DATETIME(6)  NULL,
    rol_sistema    VARCHAR(255) NULL,
    PRIMARY KEY (id_usuario),
    CONSTRAINT uk_usuarios_email           UNIQUE (email),
    CONSTRAINT uk_usuarios_username_tag    UNIQUE (username, tag)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ──────────────────────────────────────────────────────────────────────
-- VIDEOS
-- ──────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS videos (
    id_video      BIGINT       NOT NULL AUTO_INCREMENT,
    titulo        VARCHAR(255) NULL,
    duracion      INT          NULL,
    file_name     VARCHAR(255) NULL,
    miniatura_url LONGTEXT     NULL,
    fecha_subida  DATETIME(6)  NULL,
    usuario_id    BIGINT       NULL,
    PRIMARY KEY (id_video),
    CONSTRAINT fk_videos_propietario
        FOREIGN KEY (usuario_id) REFERENCES usuarios (id_usuario)
        ON DELETE SET NULL ON UPDATE RESTRICT,
    KEY idx_videos_usuario (usuario_id),
    KEY idx_videos_fecha   (fecha_subida)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ──────────────────────────────────────────────────────────────────────
-- GRUPOS
-- ──────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS grupos (
    id_grupo       BIGINT       NOT NULL AUTO_INCREMENT,
    nombre         VARCHAR(100) NOT NULL,
    id_creador     BIGINT       NOT NULL,
    fecha_creacion DATETIME(6)  NULL,
    PRIMARY KEY (id_grupo),
    CONSTRAINT fk_grupos_creador
        FOREIGN KEY (id_creador) REFERENCES usuarios (id_usuario)
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    KEY idx_grupos_creador (id_creador)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ──────────────────────────────────────────────────────────────────────
-- MIEMBROS_GRUPO  (N:M usuarios <-> grupos, con rol)
-- ──────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS miembros_grupo (
    id_usuario  BIGINT      NOT NULL,
    id_grupo    BIGINT      NOT NULL,
    rol         VARCHAR(20) NOT NULL DEFAULT 'MIEMBRO',
    fecha_union DATETIME(6) NULL,
    PRIMARY KEY (id_usuario, id_grupo),
    CONSTRAINT fk_mg_usuario
        FOREIGN KEY (id_usuario) REFERENCES usuarios (id_usuario)
        ON DELETE CASCADE ON UPDATE RESTRICT,
    CONSTRAINT fk_mg_grupo
        FOREIGN KEY (id_grupo) REFERENCES grupos (id_grupo)
        ON DELETE CASCADE ON UPDATE RESTRICT,
    KEY idx_mg_grupo (id_grupo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ──────────────────────────────────────────────────────────────────────
-- PERMISOS_GRUPO  (N:M videos <-> grupos: qué grupo ve qué video)
-- ──────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS permisos_grupo (
    id_video BIGINT NOT NULL,
    id_grupo BIGINT NOT NULL,
    PRIMARY KEY (id_video, id_grupo),
    CONSTRAINT fk_pg_video
        FOREIGN KEY (id_video) REFERENCES videos (id_video)
        ON DELETE CASCADE ON UPDATE RESTRICT,
    CONSTRAINT fk_pg_grupo
        FOREIGN KEY (id_grupo) REFERENCES grupos (id_grupo)
        ON DELETE CASCADE ON UPDATE RESTRICT,
    KEY idx_pg_grupo (id_grupo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ──────────────────────────────────────────────────────────────────────
-- VIDEO_VISTAS  (contador agregado por usuario+video)
-- ──────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS video_vistas (
    id_video_vista BIGINT NOT NULL AUTO_INCREMENT,
    id_usuario     BIGINT NOT NULL,
    id_video       BIGINT NOT NULL,
    contador       INT    NOT NULL DEFAULT 0,
    PRIMARY KEY (id_video_vista),
    CONSTRAINT uk_video_vistas_usuario_video UNIQUE (id_usuario, id_video),
    CONSTRAINT fk_vv_usuario
        FOREIGN KEY (id_usuario) REFERENCES usuarios (id_usuario)
        ON DELETE CASCADE ON UPDATE RESTRICT,
    CONSTRAINT fk_vv_video
        FOREIGN KEY (id_video) REFERENCES videos (id_video)
        ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ──────────────────────────────────────────────────────────────────────
-- LOGS  (telemetría de heartbeat por sesión de reproducción)
-- ──────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS logs (
    id_log          BIGINT       NOT NULL AUTO_INCREMENT,
    id_usuario      BIGINT       NOT NULL,
    id_video        BIGINT       NOT NULL,
    fecha_hora      DATETIME(6)  NULL,
    ip_acceso       VARCHAR(45)  NULL,
    segundos_vistos INT          NULL,
    session_id      VARCHAR(36)  NULL,
    id_grupo        BIGINT       NULL,
    PRIMARY KEY (id_log),
    CONSTRAINT fk_logs_usuario
        FOREIGN KEY (id_usuario) REFERENCES usuarios (id_usuario)
        ON DELETE CASCADE ON UPDATE RESTRICT,
    CONSTRAINT fk_logs_video
        FOREIGN KEY (id_video) REFERENCES videos (id_video)
        ON DELETE CASCADE ON UPDATE RESTRICT,
    CONSTRAINT fk_logs_grupo
        FOREIGN KEY (id_grupo) REFERENCES grupos (id_grupo)
        ON DELETE SET NULL ON UPDATE RESTRICT,
    -- En MySQL los NULL en columnas UNIQUE no chocan entre sí, por lo que
    -- esta restricción no protege el caso id_grupo=NULL — lo cubre la
    -- lógica de UPSERT en LogService.registrarHeartbeat().
    CONSTRAINT uq_logs_sesion UNIQUE (id_usuario, id_video, id_grupo, session_id),
    KEY idx_logs_grupo_video (id_grupo, id_video),
    KEY idx_logs_grupo_fecha (id_grupo, fecha_hora)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
