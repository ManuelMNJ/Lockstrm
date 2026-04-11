package com.lockstrm.platform.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;

/**
 * Payload del pulso de telemetría enviado por el reproductor cada 30 segundos.
 * currentTime es el valor de HTMLVideoElement.currentTime en el momento del pulso.
 */
public record HeartbeatRequest(

        @NotNull(message = "El campo currentTime es obligatorio")
        @PositiveOrZero(message = "El tiempo de reproducción no puede ser negativo")
        Double currentTime

) {}
