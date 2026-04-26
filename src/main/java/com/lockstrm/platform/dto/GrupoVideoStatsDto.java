package com.lockstrm.platform.dto;

/**
 * Una fila por vídeo del grupo en la pestaña "Analíticas" del detalle de
 * grupo. Los agregados están acotados al contexto del propio grupo: si el
 * vídeo se ha visto también desde otros grupos en los que está compartido,
 * esas sesiones NO entran aquí (analítica B2B segregada).
 *
 * - {@code espectadoresUnicos}: número de usuarios distintos que han generado
 *   al menos un heartbeat con grupoId = idGrupoActual.
 * - {@code tiempoTotalSegundos}: suma de los segundos vistos por todos los
 *   usuarios en ese contexto (sin desduplicar por usuario; un usuario que
 *   acumula 60 s y otro 90 s suman 150 s).
 */
public record GrupoVideoStatsDto(
        Long    idVideo,
        String  titulo,
        String  miniaturaUrl,
        Integer duracion,
        Long    espectadoresUnicos,
        Long    tiempoTotalSegundos
) {}
