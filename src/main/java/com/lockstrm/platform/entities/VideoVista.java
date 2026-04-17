package com.lockstrm.platform.entities;

import jakarta.persistence.*;
import lombok.Data;

@Entity
@Table(name = "video_vistas", uniqueConstraints = {
        @UniqueConstraint(columnNames = {"id_usuario", "id_video"})
})
@Data
public class VideoVista {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long idVideoVista;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "id_usuario", nullable = false)
    private Usuario usuario;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "id_video", nullable = false)
    private Video video;

    @Column(nullable = false)
    private Integer contador = 0;
}
