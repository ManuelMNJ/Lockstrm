package com.lockstrm.platform.dto;

import java.util.List;

public record DashboardStatsDto(
        long                 totalVideos,
        long                 totalVistas,
        long                 totalGrupos,
        List<VideoSummaryDto> topVistos,
        List<VideoSummaryDto> topRecientes
) {}
