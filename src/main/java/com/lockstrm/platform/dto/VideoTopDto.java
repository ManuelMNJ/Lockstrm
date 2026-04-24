package com.lockstrm.platform.dto;

public record VideoTopDto(
        Long    idVideo,
        String  titulo,
        String  miniaturaUrl,
        Integer duracion,
        Long    vistas
) {}
