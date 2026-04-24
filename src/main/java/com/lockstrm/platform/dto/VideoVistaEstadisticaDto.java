package com.lockstrm.platform.dto;

public record VideoVistaEstadisticaDto(
        String  nombre,
        String  email,
        Integer contador,
        Integer segundosVistos
) {}
