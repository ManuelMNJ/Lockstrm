package com.lockstrm.plataforma.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "videos")
public class Video {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long idVideo;

    private String titulo;
    private String urlCloudSecure;
    private Integer duracionSegundos;

    private LocalDateTime fechaSubida;

    @ManyToOne
    @JoinColumn(name = "id_propietario", nullable = false)
    // ESTA ES LA LÍNEA MÁGICA QUE CORTA EL BUCLE:
    @JsonIgnoreProperties("videosSubidos") 
    private Usuario propietario;

    @PrePersist
    protected void onCreate() {
        fechaSubida = LocalDateTime.now();
    }
}   