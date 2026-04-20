package com.lockstrm.platform.dto;

import java.time.LocalDateTime;

/**
 * DTO de respuesta para vídeos.
 * Incluye {@code idGrupo} cuando el vídeo está asociado a un grupo a través de PermisosGrupo;
 * será {@code null} si el vídeo no pertenece a ningún grupo.
 *
 * NOTA DE SEGURIDAD: La ruta de disco real se omite deliberadamente.
 * La reproducción se realiza exclusivamente a través del proxy /api/videos/stream/{fileName},
 * que verifica el JWT y registra la auditoría. El frontend construye la URL del stream
 * concatenando apiUrl + fileName + ?token=JWT, nunca se expone la ruta de disco directa.
 */
public record VideoDTO(
        Long idVideo,
        String titulo,
        Integer duracion,
        LocalDateTime fechaSubida,
        Long idGrupo,
        String grupoNombre,
        String miniaturaUrl,
        String fileName
) {}
