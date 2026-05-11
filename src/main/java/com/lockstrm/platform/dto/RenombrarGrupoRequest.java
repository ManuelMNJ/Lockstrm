package com.lockstrm.platform.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Cuerpo de PATCH /api/grupos/{idGrupo}. Mismas reglas que la creación. */
public record RenombrarGrupoRequest(
        @NotBlank(message = "El nombre del grupo es obligatorio")
        @Size(max = 100, message = "El nombre del grupo no puede superar los 100 caracteres")
        String nombre
) {}
