package com.lockstrm.plataforma.model;

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

    // Relación: Un log pertenece a un Usuario (el que miró el vídeo)
    @ManyToOne
    @JoinColumn(name = "id_usuario", nullable = false)
    private Usuario usuario;

    // Relación: Un log pertenece a un Video (el vídeo visto)
    @ManyToOne
    @JoinColumn(name = "id_video", nullable = false)
    private Video video;

    private LocalDateTime fechaHora;

    private String ipAcceso;

    // Antes de guardar, ponemos la fecha actual automáticamente
    @PrePersist
    protected void onCreate() {
        if (this.fechaHora == null) {
            this.fechaHora = LocalDateTime.now();
        }
    }
}