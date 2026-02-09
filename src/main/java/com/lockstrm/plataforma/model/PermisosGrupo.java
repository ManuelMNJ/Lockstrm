package com.lockstrm.plataforma.model;

import jakarta.persistence.*;
import lombok.Data;
import java.io.Serializable;


@Entity
@Table(name = "permisos_grupo")
@Data
public class PermisosGrupo implements Serializable {

    @Id
    @Column(name = "id_video_id")
    private Long idVideoId;

    @Id
    @Column(name = "id_grupo_id")
    private Long idGrupoId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "id_video_id", insertable = false, updatable = false)
    private Video video;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "id_grupo_id", insertable = false, updatable = false)
    private Grupo grupo;


    public PermisosGrupo() {
    }


    public PermisosGrupo(Long idVideoId, Long idGrupoId) {
        this.idVideoId = idVideoId;
        this.idGrupoId = idGrupoId;
    }
}