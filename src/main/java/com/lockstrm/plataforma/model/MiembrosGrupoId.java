package com.lockstrm.plataforma.model;

import jakarta.persistence.Embeddable;
import lombok.Data;
import java.io.Serializable;

// @Embeddable: Le digo a Java que esta clase no es una tabla en sí misma,
// sino una "pieza" que voy a incrustar dentro de otra tabla para formar su ID.
@Embeddable
@Data
public class MiembrosGrupoId implements Serializable {

    // Deben llamarse IGUAL que los atributos de las entidades originales
    private Long idUsuario;
    private Long idGrupo;
    
    // Nota para la defensa: Implemento Serializable porque JPA lo exige
    // para poder mover estos identificadores complejos por la red o guardarlos en caché.
}