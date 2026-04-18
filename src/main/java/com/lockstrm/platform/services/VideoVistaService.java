package com.lockstrm.platform.services;

import com.lockstrm.platform.dto.VideoVistaEstadisticaDto;
import com.lockstrm.platform.entities.Usuario;
import com.lockstrm.platform.entities.Video;
import com.lockstrm.platform.entities.VideoVista;
import com.lockstrm.platform.repositories.PermisosGrupoRepository;
import com.lockstrm.platform.repositories.UserRepository;
import com.lockstrm.platform.repositories.VideoRepository;
import com.lockstrm.platform.repositories.VideoVistaRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class VideoVistaService {

    private final VideoVistaRepository videoVistaRepository;
    private final VideoRepository videoRepository;
    private final UserRepository userRepository;
    private final PermisosGrupoRepository permisosGrupoRepository;
    private final LogService logService;

    @Transactional
    public void incrementarVista(Long idVideo, String email) {
        Video video = videoRepository.findById(idVideo)
                .orElseThrow(() -> new RuntimeException("Vídeo no encontrado"));

        logService.verificarAcceso(video, email);

        Usuario usuario = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("Usuario no encontrado"));

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
    public List<VideoVistaEstadisticaDto> obtenerEstadisticas(Long idVideo, String emailSolicitante) {
        if (!videoRepository.existsById(idVideo)) {
            throw new RuntimeException("Vídeo no encontrado");
        }

        if (!permisosGrupoRepository.existsByVideoIdAndGrupoCreadorEmail(idVideo, emailSolicitante)) {
            throw new AccessDeniedException("Solo el creador del grupo puede ver las estadísticas");
        }

        return videoVistaRepository.findByVideoIdWithUsuario(idVideo).stream()
                .map(vv -> new VideoVistaEstadisticaDto(
                        vv.getUsuario().getNombreCompleto(),
                        vv.getUsuario().getEmail(),
                        vv.getContador()
                ))
                .toList();
    }
}
