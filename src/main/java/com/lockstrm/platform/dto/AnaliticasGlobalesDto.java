package com.lockstrm.platform.dto;

import java.util.List;

public record AnaliticasGlobalesDto(
        Long              totalVistas,
        Integer           videosSubidos,
        Double            retencionMediaGlobal,
        List<VideoTopDto> topVideos
) {}
