package com.lockstrm.platform.services;

import com.lockstrm.platform.dto.AnaliticasGlobalesDto;
import com.lockstrm.platform.dto.VideoLogDto;
import com.lockstrm.platform.dto.VideoTopDto;
import com.lockstrm.platform.entities.Video;
import com.lockstrm.platform.repositories.LogRepository;
import com.lockstrm.platform.repositories.VideoRepository;
import com.lockstrm.platform.repositories.VideoVistaRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class AnaliticasService {

    private static final int TOP_VIDEOS = 5;

    private final VideoVistaRepository videoVistaRepository;
    private final VideoRepository      videoRepository;
    private final LogRepository        logRepository;

    @Transactional(readOnly = true)
    public AnaliticasGlobalesDto globales(String email) {

        long   totalVistas    = videoVistaRepository.sumVistasByOwnerEmail(email);
        int    videosSubidos  = (int) videoRepository.countByPropietario_Email(email);
        Double retencion      = logRepository.avgRetencionByOwnerEmail(email);

        List<VideoTopDto> topVideos = videoVistaRepository
                .findTopVistedByOwner(email, PageRequest.of(0, TOP_VIDEOS))
                .stream()
                .map(r -> new VideoTopDto(
                        r.idVideo(),
                        r.titulo(),
                        r.miniaturaUrl(),
                        r.duracion(),
                        r.vistas()))
                .toList();

        return new AnaliticasGlobalesDto(
                totalVistas,
                videosSubidos,
                retencion != null ? Math.round(retencion * 10.0) / 10.0 : null,
                topVideos
        );
    }

    /**
     * Listado de cada registro `logs` del vídeo para la vista detalle.
     * Solo el propietario del vídeo puede consultarlo.
     */
    @Transactional(readOnly = true)
    public List<VideoLogDto> logsDelVideo(Long idVideo, String emailSolicitante) {
        Video video = videoRepository.getByIdOrThrow(idVideo);
        if (!video.getPropietario().getEmail().equals(emailSolicitante)) {
            throw new AccessDeniedException("Solo el propietario puede ver las analíticas de este vídeo");
        }
        return logRepository.findLogsByVideoId(idVideo).stream()
                .map(l -> new VideoLogDto(
                        l.getIdLog(),
                        l.getUsuario().getIdUsuario(),
                        l.getUsuario().getUsername(),
                        l.getUsuario().getTag(),
                        l.getFechaHora(),
                        l.getSegundosVistos()))
                .toList();
    }
}
