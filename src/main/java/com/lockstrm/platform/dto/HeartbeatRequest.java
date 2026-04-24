package com.lockstrm.platform.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

/**
 * Payload del pulso de telemetría enviado por el reproductor cada 5 segundos.
 * currentTime es el valor de HTMLVideoElement.currentTime en el momento del pulso.
 * sessionId identifica de forma única esta apertura del reproductor; el backend
 * acumula segundos sobre la fila de `logs` que casa con (usuario, video, sessionId),
 * por lo que cada sesión de visualización produce exactamente una fila.
 */
public record HeartbeatRequest(

        @NotNull(message = "El campo currentTime es obligatorio")
        @PositiveOrZero(message = "El tiempo de reproducción no puede ser negativo")
        Double currentTime,

        @NotBlank(message = "El sessionId es obligatorio")
        @Size(max = 36, message = "El sessionId no puede exceder 36 caracteres")
        String sessionId

) {}
