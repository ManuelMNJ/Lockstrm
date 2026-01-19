package com.lockstrm.plataforma.model;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Entity
@Table(name = "miembros_grupo") // [cite: 58]
@Data
public class MiembrosGrupo {

    // @EmbeddedId: Aquí uso la clase "llave doble" que creé en el paso anterior.
    // Esto será la Primary Key de la tabla.
    @EmbeddedId
    private MiembrosGrupoId id = new MiembrosGrupoId();

    // RELACIÓN CON USUARIO
    // @MapsId("idUsuario"): MAGIA. Le digo que el campo 'idUsuario' de la llave compuesta
    // se corresponde con ESTE objeto Usuario. Así no duplico datos.
    @ManyToOne(fetch = FetchType.LAZY)
    @MapsId("idUsuario")
    @JoinColumn(name = "id_usuario") // [cite: 59]
    private Usuario usuario;

    // RELACIÓN CON GRUPO
    @ManyToOne(fetch = FetchType.LAZY)
    @MapsId("idGrupo")
    @JoinColumn(name = "id_grupo") // [cite: 60]
    private Grupo grupo;

    // Campo extra que pedía tu diagrama: Cuándo se unió al grupo.
    @Column(name = "fecha_union", updatable = false) // [cite: 61]
    private LocalDateTime fechaUnion;

    @PrePersist
    protected void onCreate() {
        if (this.fechaUnion == null) {
            this.fechaUnion = LocalDateTime.now();
        }
    }
}