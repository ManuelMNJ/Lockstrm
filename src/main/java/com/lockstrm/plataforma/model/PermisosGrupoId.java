package com.lockstrm.plataforma.model;

import jakarta.persistence.Embeddable;
import lombok.Data;
import java.io.Serializable;

@Embeddable
@Data
public class PermisosGrupoId implements Serializable {
    private Long idVideo;
    private Long idGrupo;
}