package com.lockstrm.plataforma.model;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Entity
@Table(name = "videos")
@Data
public class Video {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long idVideo; // id_video

    @Column(nullable = false)
    private String titulo;

    // Aquí guardamos el ID de Cloudinary, no el video físico.
    @Column(name = "url_cloud_secure", nullable = false)
    private String urlCloudSecure; 

    @Column(name = "duracion_segundos")
    private Integer duracionSegundos;

    // RELACIÓN (Foreign Key)
    // ManyToOne: Muchos videos pueden pertenecer a UN usuario.
    // JoinColumn: Le decimos que la columna en MySQL se llame 'id_propietario'
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "id_propietario", nullable = false)
    private Usuario propietario;

    @Column(name = "fecha_subida", updatable = false)
    private LocalDateTime fechaSubida;

    @PrePersist
    protected void onCreate() {
        if (this.fechaSubida == null) {
            this.fechaSubida = LocalDateTime.now();
        }
    }
}