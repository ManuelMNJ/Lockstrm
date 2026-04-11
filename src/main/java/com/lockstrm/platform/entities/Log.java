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
     * Segundos de vídeo visualizados en esta sesión, actualizado por heartbeat.
     * Es null en el registro de acceso inicial y se rellena con el primer heartbeat.
     * ddl-auto=update añade la columna automáticamente al arrancar la aplicación.
     */
    @Column(name = "segundos_vistos")
    private Integer segundosVistos;

    @PrePersist
    protected void onCreate() {
        if (this.fechaHora == null) {
            this.fechaHora = LocalDateTime.now();
        }
    }
}
