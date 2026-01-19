package com.lockstrm.plataforma.model;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

/**
 * Entidad que representa un Vídeo en la base de datos.
 */
@Entity
@Table(name = "videos")
@Data
public class Video {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long idVideo;

    @Column(nullable = false)
    private String titulo;

    // Almacena la URL segura (o identificador) del vídeo en el servicio de almacenamiento externo (ej. Cloudinary).
    // No se guarda el archivo de vídeo directamente en la base de datos.
    @Column(name = "url_cloud_secure", nullable = false)
    private String urlCloudSecure;

    @Column(name = "duracion_segundos")
    private Integer duracionSegundos;

    // Relación muchos a uno con Usuario (el propietario del vídeo).
    // 'fetch = FetchType.LAZY': El objeto Usuario propietario no se cargará de la BBDD
    // hasta que sea explícitamente accedido. Es una buena práctica para optimizar el rendimiento.
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "id_propietario", nullable = false)
    private Usuario propietario;

    @Column(name = "fecha_subida", updatable = false)
    private LocalDateTime fechaSubida;

    /**
     * Callback de JPA que establece la fecha de subida antes de persistir el vídeo.
     */
    @PrePersist
    protected void onCreate() {
        if (this.fechaSubida == null) {
            this.fechaSubida = LocalDateTime.now();
        }
    }
}
