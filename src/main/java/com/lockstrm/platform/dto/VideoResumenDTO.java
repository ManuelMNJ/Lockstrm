package com.lockstrm.platform.dto;

import java.time.LocalDateTime;

public record VideoResumenDTO(
        Long          idVideo,
        String        titulo,
        Integer       duracion,
        String        miniaturaUrl,
        Long          vistas,
        LocalDateTime fechaSubida
) {}
