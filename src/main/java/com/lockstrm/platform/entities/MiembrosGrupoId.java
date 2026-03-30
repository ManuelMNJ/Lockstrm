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
public class MiembrosGrupoId implements Serializable {

    @Column(name = "id_usuario_id")
    private Long idUsuarioId;

    @Column(name = "id_grupo_id")
    private Long idGrupoId;
}
