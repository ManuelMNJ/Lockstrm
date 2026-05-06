package com.lockstrm.platform.services;

import com.lockstrm.platform.dto.VideoViewStatsDto;
import com.lockstrm.platform.entities.User;
import com.lockstrm.platform.entities.Video;
import com.lockstrm.platform.entities.VideoView;
import com.lockstrm.platform.repositories.GroupMemberRepository;
import com.lockstrm.platform.repositories.LogRepository;
import com.lockstrm.platform.repositories.GroupPermissionRepository;
import com.lockstrm.platform.repositories.UserRepository;
import com.lockstrm.platform.repositories.VideoRepository;
import com.lockstrm.platform.repositories.VideoViewRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class VideoViewService {

    private final VideoViewRepository        videoVistaRepository;
    private final VideoRepository            videoRepository;
    private final UserRepository             userRepository;
    private final GroupPermissionRepository  permisosGroupRepository;
    private final GroupMemberRepository      groupMemberRepository;
    private final LogRepository              logRepository;
    private final LogService                 logService;

    @Transactional
    public void incrementarVista(Long idVideo, String email) {
        Video video = videoRepository.getByIdOrThrow(idVideo);

        logService.verificarAcceso(video, email);

        User usuario = userRepository.getByEmailOrThrow(email);

        VideoView vista = videoVistaRepository.findByUsuarioAndVideo(usuario, video)
                .orElseGet(() -> {
                    VideoView nueva = new VideoView();
                    nueva.setUsuario(usuario);
                    nueva.setVideo(video);
                    nueva.setContador(0);
                    return nueva;
                });

        vista.setContador(vista.getContador() + 1);
        videoVistaRepository.save(vista);
    }

    @Transactional(readOnly = true)
    public List<VideoViewStatsDto> obtenerEstadisticas(Long idVideo,
                                                              String emailSolicitante,
                                                              Long grupoId) {
        if (!videoRepository.existsById(idVideo)) {
            throw new RuntimeException("Vídeo no encontrado");
        }

        boolean autorVideo    = videoRepository.existsByVideoIdAndPropietarioEmail(idVideo, emailSolicitante);
        boolean creadorGrupo  = permisosGroupRepository.existsByVideoIdAndGrupoCreadorEmail(idVideo, emailSolicitante);
        boolean adminGrupo    = groupMemberRepository.existsAdminEnGrupoConVideo(
                emailSolicitante, idVideo,
                java.util.List.of(com.lockstrm.platform.enums.GroupRole.ADMIN,
                                  com.lockstrm.platform.enums.GroupRole.SUPER_ADMIN));

        if (!autorVideo && !creadorGrupo && !adminGrupo) {
            throw new AccessDeniedException("No tienes permiso para ver las estadísticas de este vídeo");
        }

        // Mapa email → MAX(segundosVistos) desde la tabla logs (alimentada por heartbeat).
        // El repo recibe `grupoId` opcional: si no es null, acota al contexto.
        var segundosVistos = logRepository.findSegundosVistos(idVideo, grupoId);
        Map<String, Integer> segundosPorEmail = segundosVistos.stream()
                .collect(Collectors.toMap(
                        LogRepository.SegundosPorUsuario::getEmail,
                        LogRepository.SegundosPorUsuario::getSegundos,
                        (a, b) -> a
                ));

        return videoVistaRepository.findByVideoIdWithUsuario(idVideo).stream()
                .map(vv -> new VideoViewStatsDto(
                        vv.getUsuario().getUsername(),
                        vv.getUsuario().getTag(),
                        vv.getContador(),
                        segundosPorEmail.getOrDefault(vv.getUsuario().getEmail(), 0)
                ))
                .toList();
    }
}
