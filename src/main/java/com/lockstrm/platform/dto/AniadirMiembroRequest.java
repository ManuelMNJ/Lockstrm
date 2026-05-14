package com.lockstrm.platform.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Payload para añadir un miembro a un grupo. Acepta como identificador
 * un email o un handle {@code username#tag} — la resolución concreta la
 * hace {@code UserService.buscarPorIdentificador}.
 */
public record AniadirMiembroRequest(
        @NotBlank(message = "El identificador del nuevo miembro es obligatorio")
        @Size(max = 100, message = "El identificador es demasiado largo")
        String identificador
) {}
