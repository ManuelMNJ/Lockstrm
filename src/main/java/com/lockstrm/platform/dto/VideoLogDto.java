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
        Integer       segundosVistos
) {
    public String displayTag() {
        return username + "#" + tag;
    }
}
