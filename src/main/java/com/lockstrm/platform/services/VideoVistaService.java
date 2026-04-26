package com.lockstrm.platform.services;

import com.lockstrm.platform.dto.VideoVistaEstadisticaDto;
import com.lockstrm.platform.entities.Usuario;
import com.lockstrm.platform.entities.Video;
import com.lockstrm.platform.entities.VideoVista;
import com.lockstrm.platform.repositories.LogRepository;
import com.lockstrm.platform.repositories.PermisosGrupoRepository;
import com.lockstrm.platform.repositories.UserRepository;
import com.lockstrm.platform.repositories.VideoRepository;
import com.lockstrm.platform.repositories.VideoVistaRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class VideoVistaService {

    private final VideoVistaRepository    videoVistaRepository;
    private final VideoRepository         videoRepository;
    private final UserRepository          userRepository;
    private final PermisosGrupoRepository permisosGrupoRepository;
    private final LogRepository           logRepository;
    private final LogService              logService;

    @Transactional
    public void incrementarVista(Long idVideo, String email) {
        Video video = videoRepository.getByIdOrThrow(idVideo);

        logService.verificarAcceso(video, email);

        Usuario usuario = userRepository.getByEmailOrThrow(email);

        VideoVista vista = videoVistaRepository.findByUsuarioAndVideo(usuario, video)
                .orElseGet(() -> {
                    VideoVista nueva = new VideoVista();
                    nueva.setUsuario(usuario);
                    nueva.setVideo(video);
                    nueva.setContador(0);
                    return nueva;
                });

        vista.setContador(vista.getContador() + 1);
        videoVistaRepository.save(vista);
    }

    @Transactional(readOnly = true)
    public List<VideoVistaEstadisticaDto> obtenerEstadisticas(Long idVideo,
                                                              String emailSolicitante,
                                                              Long grupoId) {
        if (!videoRepository.existsById(idVideo)) {
            throw new RuntimeException("Vídeo no encontrado");
        }

        if (!permisosGrupoRepository.existsByVideoIdAndGrupoCreadorEmail(idVideo, emailSolicitante)) {
            throw new AccessDeniedException("Solo el creador del grupo puede ver las estadísticas");
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
                .map(vv -> new VideoVistaEstadisticaDto(
                        vv.getUsuario().getUsername(),
                        vv.getUsuario().getTag(),
                        vv.getContador(),
                        segundosPorEmail.getOrDefault(vv.getUsuario().getEmail(), 0)
                ))
                .toList();
    }
}
