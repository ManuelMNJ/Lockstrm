package com.lockstrm.plataforma.model;

import jakarta.persistence.*;
import lombok.Data;

/**
 * Entidad que representa la tabla asociativa para los permisos de un grupo sobre un vídeo.
 * Utiliza una clave primaria compuesta para definir la relación.
 */
@Entity
@Table(name = "permisos_grupo")
@Data
public class PermisosGrupo {

    @EmbeddedId
    private PermisosGrupoId id = new PermisosGrupoId();

    @ManyToOne(fetch = FetchType.LAZY)
    @MapsId("idGrupo")
    @JoinColumn(name = "id_grupo")
    private Grupo grupo;

    @ManyToOne(fetch = FetchType.LAZY)
    @MapsId("idVideo")
    @JoinColumn(name = "id_video")
    private Video video;

    // Se podría añadir un campo extra si fuera necesario, como por ejemplo:
    // private boolean puedeEditar;
}
