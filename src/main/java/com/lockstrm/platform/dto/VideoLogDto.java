package com.lockstrm.platform.dto;

import java.time.LocalDateTime;

/**
 * Una fila por registro real de la tabla `logs`: representa una sesión
 * (usuario + día) con sus segundos vistos, para la vista detalle de
 * analíticas donde se lista cada visualización individualmente.
 */
public record VideoLogDto(
        Long          idLog,
        Long          idUsuario,
        String        username,
        String        tag,
        LocalDateTime fechaHora,
        Integer       segundosVistos,
        /**
         * Group desde el que se reprodujo el vídeo en esta sesión. Puede ser
         * null cuando la reproducción ocurrió fuera de un contexto de grupo
         * (p. ej. el propietario abriendo el vídeo desde "Mis vídeos").
         */
        Long          grupoId,
        /**
         * Nombre del grupo, resuelto en la consulta JPQL para evitar un round
         * trip adicional. null si grupoId es null o si el grupo fue eliminado.
         */
        String        grupoNombre
) {
    public String displayTag() {
        return username + "#" + tag;
    }
}
