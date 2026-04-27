package com.lockstrm.platform.dto;

import java.util.List;

public record GlobalAnalyticsDto(
        Long              totalVistas,
        Integer           videosSubidos,
        Double            retencionMediaGlobal,
        List<TopVideoDto> topVideos
) {}
