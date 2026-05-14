package com.lockstrm.platform.dto;

import com.lockstrm.platform.enums.GroupRole;
import jakarta.validation.constraints.NotNull;

/**
 * Payload para cambiar el rol de un miembro dentro de un grupo. Spring
 * deserializa el string a {@link GroupRole}; un valor no válido genera
 * {@code HttpMessageNotReadableException} y devuelve 400 vía el handler global.
 */
public record CambiarRolRequest(
        @NotNull(message = "El campo 'rol' es obligatorio")
        GroupRole rol
) {}
