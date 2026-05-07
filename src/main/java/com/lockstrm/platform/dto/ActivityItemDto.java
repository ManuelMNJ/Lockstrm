package com.lockstrm.platform.dto;

import java.time.LocalDateTime;

/**
 * Item del feed de actividad. El backend NO construye HTML: envía los campos
 * en bruto (action + target) y el frontend los interpola con {{ }} para que
 * Angular escape automáticamente cualquier carácter especial. Esto evita
 * inyección de HTML/XSS a través de títulos de vídeo o nombres de grupo.
 */
public record ActivityItemDto(
        String icon,
        String action,
        String target,
        LocalDateTime occurredAt
) {}
