package com.lockstrm.platform.dto;

public record GrupoStatsDTO(
        Long idGrupo,
        String nombre,
        Long idCreador,
        Long totalMiembros
) {}
