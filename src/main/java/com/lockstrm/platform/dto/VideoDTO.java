package com.lockstrm.platform.dto;

import java.time.LocalDateTime;

/**
 * DTO de respuesta para vídeos.
 * Incluye {@code idGrupo} cuando el vídeo está asociado a un grupo a través de PermisosGrupo;
 * será {@code null} si el vídeo no pertenece a ningún grupo.
 */
public record VideoDTO(
        Long idVideo,
        String titulo,
        Integer duracion,
        String urlCloudSecure,
        String cloudinaryId,
        LocalDateTime fechaSubida,
        Long idGrupo
) {}
