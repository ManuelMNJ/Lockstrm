package com.lockstrm.platform.dto;

public record TopVideoDto(
        Long    idVideo,
        String  titulo,
        String  miniaturaUrl,
        Integer duracion,
        Long    vistas
) {}
