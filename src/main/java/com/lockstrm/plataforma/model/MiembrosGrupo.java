package com.lockstrm.plataforma.model;

import jakarta.persistence.*;
import lombok.Data;
import java.io.Serializable;
import java.time.LocalDateTime;


@Entity
@Table(name = "miembros_grupo")
@Data
public class MiembrosGrupo implements Serializable {

    @Id
    @Column(name = "id_usuario_id")
    private Long idUsuarioId;

    @Id
    @Column(name = "id_grupo_id")
    private Long idGrupoId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "id_usuario_id", insertable = false, updatable = false)
    private Usuario usuario;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "id_grupo_id", insertable = false, updatable = false)
    private Grupo grupo;

    @Column(name = "fecha_union")
    private LocalDateTime fechaUnion;


    @PrePersist
    protected void onCreate() {
        if (this.fechaUnion == null) {
            this.fechaUnion = LocalDateTime.now();
        }
    }


    public MiembrosGrupo() {
    }


    public MiembrosGrupo(Long idUsuarioId, Long idGrupoId) {
        this.idUsuarioId = idUsuarioId;
        this.idGrupoId = idGrupoId;
    }
}