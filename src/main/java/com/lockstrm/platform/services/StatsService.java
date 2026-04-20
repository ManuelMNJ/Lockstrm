package com.lockstrm.platform.services;

import com.lockstrm.platform.dto.DashboardStatsDTO;
import com.lockstrm.platform.dto.VideoResumenDTO;
import com.lockstrm.platform.repositories.GrupoRepository;
import com.lockstrm.platform.repositories.VideoRepository;
import com.lockstrm.platform.repositories.VideoVistaRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class StatsService {

    private final VideoRepository      videoRepository;
    private final VideoVistaRepository videoVistaRepository;
    private final GrupoRepository      grupoRepository;

    @Transactional(readOnly = true)
    public DashboardStatsDTO getDashboardStats(String email) {
        long totalVideos = videoRepository.countByPropietario_Email(email);
        long totalVistas = videoVistaRepository.sumVistasByOwnerEmail(email);
        long totalGrupos = grupoRepository.countByCreador_Email(email);

        List<VideoResumenDTO> topVistos = videoVistaRepository
                .findTopVistedByOwner(email, PageRequest.of(0, 3));

        List<VideoResumenDTO> topRecientes = videoRepository
                .findTop3ByPropietario_EmailOrderByFechaSubidaDesc(email)
                .stream()
                .map(v -> new VideoResumenDTO(
                        v.getIdVideo(),
                        v.getTitulo(),
                        v.getDuracion(),
                        v.getMiniaturaUrl(),
                        0L,
                        v.getFechaSubida()))
                .toList();

        return new DashboardStatsDTO(totalVideos, totalVistas, totalGrupos, topVistos, topRecientes);
    }
}
