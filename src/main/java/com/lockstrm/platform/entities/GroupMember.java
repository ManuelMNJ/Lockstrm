package com.lockstrm.platform.entities;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.lockstrm.platform.enums.GroupRole;
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
public class GroupMember implements Serializable {

    @EmbeddedId
    private GroupMemberId id;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "id_usuario", insertable = false, updatable = false)
    private User usuario;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "id_grupo", insertable = false, updatable = false)
    private Group grupo;

    @Enumerated(EnumType.STRING)
    @Column(name = "rol", nullable = false, columnDefinition = "varchar(20)")
    private GroupRole rol = GroupRole.MIEMBRO;

    @Column(name = "fecha_union")
    private LocalDateTime fechaUnion;

    @PrePersist
    protected void onCreate() {
        if (this.fechaUnion == null) {
            this.fechaUnion = LocalDateTime.now();
        }
    }

    public GroupMember(Long idUsuarioId, Long idGrupoId) {
        this.id = new GroupMemberId(idUsuarioId, idGrupoId);
    }

    public GroupMember(Long idUsuarioId, Long idGrupoId, GroupRole rol) {
        this.id  = new GroupMemberId(idUsuarioId, idGrupoId);
        this.rol = rol;
    }
}