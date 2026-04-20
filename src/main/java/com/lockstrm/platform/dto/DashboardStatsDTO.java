package com.lockstrm.platform.dto;

import java.util.List;

public record DashboardStatsDTO(
        long                 totalVideos,
        long                 totalVistas,
        long                 totalGrupos,
        List<VideoResumenDTO> topVistos,
        List<VideoResumenDTO> topRecientes
) {}
