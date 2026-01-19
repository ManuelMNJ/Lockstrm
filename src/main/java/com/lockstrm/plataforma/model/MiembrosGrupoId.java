package com.lockstrm.plataforma.model;

import jakarta.persistence.Embeddable;
import lombok.Data;
import java.io.Serializable;

/**
 * Clase que representa la clave primaria compuesta para la entidad MiembrosGrupo.
 * Al ser @Embeddable, no es una tabla por sí misma, sino que sus campos se incrustan
 * en la tabla de la entidad que la contiene, formando parte de su clave primaria.
 */
@Embeddable
@Data
public class MiembrosGrupoId implements Serializable {

    // Los nombres de estos atributos deben coincidir con los nombres utilizados
    // en la anotación @MapsId de la entidad MiembrosGrupo.
    private Long idUsuario;
    private Long idGrupo;

    // NOTA PARA LA DEFENSA: La interfaz Serializable es un requisito de la especificación de JPA
    // para las clases de identificadores compuestos. Asegura que el identificador puede ser
    // serializado (convertido a un flujo de bytes) para su almacenamiento en caché o transferencia en red.
}
