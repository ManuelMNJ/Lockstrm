package com.lockstrm.platform.entities;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serializable;
import java.time.LocalDateTime;

// CRITICAL: DO NOT REMOVE @JoinColumn ANNOTATIONS DURING REFACTORING. DB SCHEMA DEPENDS ON EXACT NAMING.
@Entity
@Table(name = "miembros_grupo")
@Data
@NoArgsConstructor
public class MiembrosGrupo implements Serializable {

    @EmbeddedId
    private MiembrosGrupoId id;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "id_usuario", insertable = false, updatable = false)
    private Usuario usuario;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "id_grupo", insertable = false, updatable = false)
    private Grupo grupo;

    @Column(name = "fecha_union")
    private LocalDateTime fechaUnion;

    @PrePersist
    protected void onCreate() {
        if (this.fechaUnion == null) {
            this.fechaUnion = LocalDateTime.now();
        }
    }

    public MiembrosGrupo(Long idUsuarioId, Long idGrupoId) {
        this.id = new MiembrosGrupoId(idUsuarioId, idGrupoId);
    }
}
