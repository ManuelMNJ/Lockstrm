package com.lockstrm.platform.entities;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serializable;

@Embeddable
@Data
@NoArgsConstructor
@AllArgsConstructor
public class PermisosGrupoId implements Serializable {

    @Column(name = "id_video_id")
    private Long idVideoId;

    @Column(name = "id_grupo_id")
    private Long idGrupoId;
}
