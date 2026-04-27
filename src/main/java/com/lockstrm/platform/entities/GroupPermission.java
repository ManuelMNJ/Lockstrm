package com.lockstrm.platform.entities;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serializable;

@Entity
@Table(name = "permisos_grupo")
@Data
@NoArgsConstructor
public class GroupPermission implements Serializable {

    @EmbeddedId
    private GroupPermissionId id;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "id_video", insertable = false, updatable = false)
    private Video video;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "id_grupo", insertable = false, updatable = false)
    private Group grupo;

    public GroupPermission(Long idVideoId, Long idGrupoId) {
        this.id = new GroupPermissionId(idVideoId, idGrupoId);
    }
}
