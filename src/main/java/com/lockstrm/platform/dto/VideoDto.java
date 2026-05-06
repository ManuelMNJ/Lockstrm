package com.lockstrm.platform.dto;

import java.time.LocalDateTime;
import java.util.List;

/**
 * DTO de respuesta para vídeos.
 *
 * Un vídeo puede pertenecer a 0..N grupos a través de la tabla puente
 * `permisos_grupo`. Devolvemos la lista completa para que el frontend pueda
 * pintar todas las pertenencias y permitir desvincular grupos individualmente
 * desde el modal de edición. Si el vídeo no está en ningún grupo, `grupos`
 * será una lista vacía.
 *
 * NOTA DE SEGURIDAD: La ruta de disco real se omite deliberadamente.
 * La reproducción se realiza exclusivamente a través del proxy
 * /api/videos/stream/{fileName}, que verifica el JWT y registra la auditoría.
 */
public record VideoDto(
        Long idVideo,
        String titulo,
        Integer duracion,
        LocalDateTime fechaSubida,
        List<GroupRef> grupos,
        String miniaturaUrl,
        String fileName,
        Long fileSize
) {
    public record GroupRef(Long idGrupo, String nombre) {}
}
