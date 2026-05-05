package com.lockstrm.platform.entities;

import com.fasterxml.jackson.annotation.JsonIgnore;
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
    private Integer duracion;
    @Column(name = "file_name")
    private String fileName;

    @Column(columnDefinition = "LONGTEXT")
    private String miniaturaUrl;
    private LocalDateTime fechaSubida;

    @ManyToOne
    @JoinColumn(name = "usuario_id")
    @JsonIgnore
    private User propietario;

    @PrePersist
    protected void onCreate() {
        fechaSubida = LocalDateTime.now();
    }
}
