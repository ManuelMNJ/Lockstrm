package com.lockstrm.platform.dto;

import java.time.LocalDateTime;

public record GrupoDTO(
        Long idGrupo,
        String nombre,
        Long idCreador,
        LocalDateTime fechaCreacion,
        boolean esCreador
) {}
