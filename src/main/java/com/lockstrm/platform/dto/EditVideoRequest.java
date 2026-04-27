package com.lockstrm.platform.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.List;

/**
 * Payload del PATCH /api/videos/{id}.
 *
 * `idGrupos` representa la lista COMPLETA de grupos a los que el vídeo debe
 * estar vinculado tras la edición (semántica de "set", no de "add"). El
 * servicio compara esta lista con los permisos existentes y aplica el diff:
 *  - Los grupos presentes en la lista pero no en BBDD se añaden.
 *  - Los grupos presentes en BBDD pero no en la lista se eliminan.
 *
 * Una lista vacía o `null` desvincula el vídeo de todos los grupos
 * (queda solo accesible para su propietario).
 */
public record EditVideoRequest(

        @NotBlank(message = "El título es obligatorio")
        @Size(max = 255, message = "El título no puede superar los 255 caracteres")
        String titulo,

        List<Long> idGrupos

) {}
