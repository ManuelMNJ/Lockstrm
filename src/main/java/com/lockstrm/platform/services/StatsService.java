package com.lockstrm.platform.services;

import com.lockstrm.platform.dto.DashboardStatsDto;
import com.lockstrm.platform.dto.VideoSummaryDto;
import com.lockstrm.platform.repositories.GroupRepository;
import com.lockstrm.platform.repositories.VideoRepository;
import com.lockstrm.platform.repositories.VideoViewRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class StatsService {

    private final VideoRepository      videoRepository;
    private final VideoViewRepository videoVistaRepository;
    private final GroupRepository      grupoRepository;

    @Transactional(readOnly = true)
    public DashboardStatsDto getDashboardStats(String email) {
        long totalVideos = videoRepository.countByPropietario_Email(email);
        long totalVistas = videoVistaRepository.sumVistasByOwnerEmail(email);
        long totalGrupos = grupoRepository.countByCreador_Email(email);

        List<VideoSummaryDto> topVistos = videoVistaRepository
                .findTopVistedByOwner(email, PageRequest.of(0, 3));

        List<VideoSummaryDto> topRecientes = videoRepository
                .findTop3ByPropietario_EmailOrderByFechaSubidaDesc(email)
                .stream()
                .map(v -> new VideoSummaryDto(
                        v.getIdVideo(),
                        v.getTitulo(),
                        v.getDuracion(),
                        v.getMiniaturaUrl(),
                        0L,
                        v.getFechaSubida()))
                .toList();

        return new DashboardStatsDto(totalVideos, totalVistas, totalGrupos, topVistos, topRecientes);
    }
}
