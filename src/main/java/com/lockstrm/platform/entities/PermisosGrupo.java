package com.lockstrm.platform.entities;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serializable;

@Entity
@Table(name = "permisos_grupo")
@Data
@NoArgsConstructor
public class PermisosGrupo implements Serializable {

    @EmbeddedId
    private PermisosGrupoId id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "id_video_id", insertable = false, updatable = false)
    private Video video;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "id_grupo_id", insertable = false, updatable = false)
    private Grupo grupo;

    public PermisosGrupo(Long idVideoId, Long idGrupoId) {
        this.id = new PermisosGrupoId(idVideoId, idGrupoId);
    }
}
