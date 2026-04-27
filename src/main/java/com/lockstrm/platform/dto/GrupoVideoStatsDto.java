package com.lockstrm.platform.dto;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Una fila por vídeo del grupo en la pestaña "Analíticas" del detalle.
 * Todos los agregados están acotados al contexto del grupo (segregación
 * B2B) y, opcionalmente, a un rango de fechas.
 *
 * @param sparkline Visitas/día de los últimos 30 días alineadas al
 *                  calendario (índice 0 = hace 29 días, índice 29 = hoy).
 *                  Días sin visitas son 0. El frontend lo renderiza como
 *                  path SVG sin tener que reconstruir el calendario.
 *                  Independiente del filtro de fechas: el sparkline siempre
 *                  son los últimos 30 días para dar contexto temporal fijo.
 */
public record GrupoVideoStatsDto(
        Long          idVideo,
        String        titulo,
        String        miniaturaUrl,
        Integer       duracion,
        Long          autorIdUsuario,
        String        autorUsername,
        String        autorTag,
        Long          visitasTotales,
        Long          espectadoresUnicos,
        Long          tiempoTotalSegundos,
        Double        duracionMediaSegundos,
        Double        porcentajeCompletadoMedio,
        LocalDateTime ultimaVisita,
        List<Integer> sparkline
) {

    /**
     * Constructor que JPQL `new ...(...)` puede invocar: tiene exactamente
     * los 13 campos que vienen de la query agregada. El sparkline se rellena
     * después en el servicio con una segunda query y el método
     * {@link #withSparkline}.
     */
    public GrupoVideoStatsDto(Long idVideo, String titulo, String miniaturaUrl, Integer duracion,
                              Long autorIdUsuario, String autorUsername, String autorTag,
                              Long visitasTotales, Long espectadoresUnicos, Long tiempoTotalSegundos,
                              Double duracionMediaSegundos, Double porcentajeCompletadoMedio,
                              LocalDateTime ultimaVisita) {
        this(idVideo, titulo, miniaturaUrl, duracion,
             autorIdUsuario, autorUsername, autorTag,
             visitasTotales, espectadoresUnicos, tiempoTotalSegundos,
             duracionMediaSegundos, porcentajeCompletadoMedio,
             ultimaVisita, List.of());
    }

    /** Devuelve una copia con el sparkline reemplazado (record inmutable). */
    public GrupoVideoStatsDto withSparkline(List<Integer> sparkline) {
        return new GrupoVideoStatsDto(idVideo, titulo, miniaturaUrl, duracion,
                autorIdUsuario, autorUsername, autorTag,
                visitasTotales, espectadoresUnicos, tiempoTotalSegundos,
                duracionMediaSegundos, porcentajeCompletadoMedio,
                ultimaVisita, sparkline);
    }
}
