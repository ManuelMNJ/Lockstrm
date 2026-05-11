package com.lockstrm.platform.dto;

import com.lockstrm.platform.entities.Group;

import java.time.LocalDateTime;

/**
 * DTO de respuesta para Group. Evita exponer la entidad JPA directamente
 * en los endpoints REST y desacopla el contrato del modelo de persistencia.
 */
public record GroupDto(
        Long idGrupo,
        String nombre,
        LocalDateTime fechaCreacion,
        String imagenUrl
) {
    public static GroupDto from(Group grupo) {
        return new GroupDto(
                grupo.getIdGrupo(),
                grupo.getNombre(),
                grupo.getFechaCreacion(),
                grupo.getImagenUrl()
        );
    }
}
