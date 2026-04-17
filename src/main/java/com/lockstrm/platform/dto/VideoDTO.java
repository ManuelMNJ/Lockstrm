package com.lockstrm.platform.dto;

import java.time.LocalDateTime;

/**
 * DTO de respuesta para vídeos.
 * Incluye {@code idGrupo} cuando el vídeo está asociado a un grupo a través de PermisosGrupo;
 * será {@code null} si el vídeo no pertenece a ningún grupo.
 *
 * NOTA DE SEGURIDAD: urlCloudSecure y cloudinaryId se omiten deliberadamente.
 * La reproducción se realiza exclusivamente a través del proxy /api/videos/stream/{id},
 * que verifica el JWT y registra la auditoría. Exponer la URL directa de Cloudinary
 * permitiría bypassear los controles de acceso.
 */
public record VideoDTO(
        Long idVideo,
        String titulo,
        Integer duracion,
        LocalDateTime fechaSubida,
        Long idGrupo,
        String grupoNombre,
        String miniaturaUrl
) {}
