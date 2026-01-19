package com.lockstrm.plataforma.model;

import jakarta.persistence.Embeddable;
import lombok.Data;
import java.io.Serializable;

/**
 * Clase para la clave primaria compuesta de la entidad PermisosGrupo.
 * Incrusta las claves foráneas de Grupo y Video para formar un identificador único.
 */
@Embeddable
@Data
public class PermisosGrupoId implements Serializable {

    private Long idGrupo;
    private Long idVideo;

}
