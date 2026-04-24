package com.lockstrm.platform.entities;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Entity
@Table(name = "logs")
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

    @PrePersist
    protected void onCreate() {
        if (this.fechaHora == null) {
            this.fechaHora = LocalDateTime.now();
        }
    }
}
