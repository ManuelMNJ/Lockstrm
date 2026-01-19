package com.lockstrm.plataforma.model;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

/**
 * Entidad que representa un registro de auditoría (Log) en la base de datos.
 * Almacena información sobre qué usuario ha visualizado qué vídeo y cuándo.
 */
@Entity
@Table(name = "logs")
@Data
public class Log {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long idLog;

    // Relación muchos a uno: Muchos logs pueden pertenecer a un usuario.
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "id_usuario", nullable = false)
    private Usuario usuario;

    // Relación muchos a uno: Muchos logs pueden estar asociados a un vídeo.
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "id_video", nullable = false)
    private Video video;

    @Column(name = "fecha_hora")
    private LocalDateTime fechaHora;

    @Column(name = "ip_acceso", length = 45)
    private String ipAcceso;

    /**
     * Callback de JPA que se ejecuta antes de persistir la entidad.
     * Asigna la fecha y hora actual al log si no se ha especificado una.
     */
    @PrePersist
    protected void onCreate() {
        if (this.fechaHora == null) {
            this.fechaHora = LocalDateTime.now();
        }
    }
}
