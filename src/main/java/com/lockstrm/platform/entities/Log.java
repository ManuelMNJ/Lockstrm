package com.lockstrm.platform.entities;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Entity
@Table(
    name = "logs",
    indexes = {
        // Cubre los filtros de las consultas analíticas: GROUP BY (id_grupo, id_video)
        // y el ORDER/FILTER sobre fecha_hora.
        @Index(name = "idx_logs_grupo_video", columnList = "id_grupo, id_video"),
        @Index(name = "idx_logs_grupo_fecha", columnList = "id_grupo, fecha_hora")
    },
    uniqueConstraints = @UniqueConstraint(
        name        = "uq_logs_sesion",
        columnNames = {"id_usuario", "id_video", "id_grupo", "session_id"}
        // NOTA MySQL: las columnas NULL (id_grupo) se tratan como valores distintos
        // en un índice UNIQUE → dos filas con id_grupo=NULL y el mismo session_id
        // no violan la restricción. La protección definitiva para ese caso es la
        // lógica de UPSERT a nivel de aplicación (LogService.registrarHeartbeat).
    )
)
@Data
public class Log {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long idLog;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "id_usuario", nullable = false)
    private Usuario usuario;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "id_video", nullable = false)
    private Video video;

    @Column(name = "fecha_hora")
    private LocalDateTime fechaHora;

    @Column(name = "ip_acceso", length = 45)
    private String ipAcceso;

    /**
     * Segundos de vídeo visualizados en esta sesión, acumulados por heartbeat.
     * El primer pulso de la sesión crea la fila con 5 s; los siguientes suman
     * 5 s cada uno. ddl-auto=update añade la columna automáticamente al
     * arrancar la aplicación.
     */
    @Column(name = "segundos_vistos")
    private Integer segundosVistos;

    /**
     * Identificador único de la sesión de reproducción (UUID generado en el
     * cliente al montar el reproductor). Cada instancia del <video-player>
     * genera un sessionId nuevo, de modo que cada apertura del reproductor
     * produce una fila independiente en `logs`. El heartbeat del cliente
     * envía este id en cada ping; el backend acumula segundos sobre la fila
     * que casa con (usuario, video, sessionId).
     */
    @Column(name = "session_id", length = 36)
    private String sessionId;

    /**
     * Grupo desde el que se está reproduciendo el vídeo. Puede ser null cuando
     * la reproducción ocurre fuera de un contexto de grupo (p. ej. el propietario
     * viendo su propio vídeo). Forma parte de la clave lógica del UPSERT junto
     * con (usuario, video), de modo que un mismo vídeo visto desde dos grupos
     * distintos genera dos filas independientes y permite segmentar las
     * analíticas por grupo.
     */
    @Column(name = "id_grupo")
    private Long grupoId;

    @PrePersist
    protected void onCreate() {
        if (this.fechaHora == null) {
            this.fechaHora = LocalDateTime.now();
        }
    }
}
