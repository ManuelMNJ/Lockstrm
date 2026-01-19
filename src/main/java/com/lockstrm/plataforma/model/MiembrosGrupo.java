package com.lockstrm.plataforma.model;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

/**
 * Entidad que representa la tabla intermedia (asociativa) entre Usuario y Grupo.
 * Modela la membresía de un usuario a un grupo, utilizando una clave primaria compuesta.
 */
@Entity
@Table(name = "miembros_grupo")
@Data
public class MiembrosGrupo {

    // Define la clave primaria compuesta, incrustada desde la clase MiembrosGrupoId.
    @EmbeddedId
    private MiembrosGrupoId id = new MiembrosGrupoId();

    // Relación con Usuario, mapeada a través de la clave compuesta.
    // @MapsId indica que el atributo 'idUsuario' de la clave embebida (@EmbeddedId)
    // se utiliza como clave foránea, mapeando a la clave primaria de la entidad Usuario.
    @ManyToOne(fetch = FetchType.LAZY)
    @MapsId("idUsuario")
    @JoinColumn(name = "id_usuario")
    private Usuario usuario;

    // Relación con Grupo, mapeada de forma similar a la del usuario.
    // @MapsId indica que el atributo 'idGrupo' de la clave embebida (@EmbeddedId)
    // se utiliza como clave foránea, mapeando a la clave primaria de la entidad Grupo.
    @ManyToOne(fetch = FetchType.LAZY)
    @MapsId("idGrupo")
    @JoinColumn(name = "id_grupo")
    private Grupo grupo;

    @Column(name = "fecha_union", updatable = false)
    private LocalDateTime fechaUnion;

    /**
     * Callback de JPA que se ejecuta antes de persistir la entidad.
     * Establece la fecha de unión del miembro al grupo.
     */
    @PrePersist
    protected void onCreate() {
        if (this.fechaUnion == null) {
            this.fechaUnion = LocalDateTime.now();
        }
    }
}
