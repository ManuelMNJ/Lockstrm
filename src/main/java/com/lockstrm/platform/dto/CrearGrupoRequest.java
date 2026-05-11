package com.lockstrm.platform.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Cuerpo de POST /api/grupos. Bean Validation rechaza nombres vacíos o > 100 chars. */
public record CrearGrupoRequest(
        @NotBlank(message = "El nombre del grupo es obligatorio")
        @Size(max = 100, message = "El nombre del grupo no puede superar los 100 caracteres")
        String nombre
) {}
