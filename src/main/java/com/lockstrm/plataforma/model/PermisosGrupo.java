package com.lockstrm.plataforma.model;

import jakarta.persistence.*;
import lombok.Data;

@Entity
@Table(name = "permisos_grupo")
@Data
public class PermisosGrupo {

    @EmbeddedId
    private PermisosGrupoId id = new PermisosGrupoId();

    @ManyToOne
    @MapsId("idVideo")
    @JoinColumn(name = "id_video")
    private Video video;

    @ManyToOne
    @MapsId("idGrupo")
    @JoinColumn(name = "id_grupo")
    private Grupo grupo;
}