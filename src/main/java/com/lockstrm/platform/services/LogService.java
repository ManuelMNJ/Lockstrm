package com.lockstrm.platform.services;

import com.lockstrm.platform.entities.Log;
import com.lockstrm.platform.entities.Usuario;
import com.lockstrm.platform.entities.Video;
import com.lockstrm.platform.repositories.LogRepository;
import com.lockstrm.platform.repositories.MiembrosGrupoRepository;
import com.lockstrm.platform.repositories.UserRepository;
import com.lockstrm.platform.repositories.VideoRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class LogService {

    private final LogRepository            logRepository;
    private final UserRepository           userRepository;
    private final VideoRepository          videoRepository;
    private final MiembrosGrupoRepository  miembrosGrupoRepository;

    /**
     * Segundos reales de reproducción que representa cada ping del cliente.
     * El reproductor dispara el timer en `play` y lo detiene en `pause`/`ended`,
     * por lo que cada pulso equivale a este intervalo fijo. Sumar una constante
     * en lugar del `currentTime` reportado neutraliza la trampa de arrastrar
     * la barra al final del vídeo.
     */
    private static final int HEARTBEAT_INTERVAL_SECONDS = 5;

    /**
     * Acumula segundos de reproducción sobre la fila de `logs` que identifica
     * esta sesión del reproductor. La clave de sesión la genera el cliente al
     * montar el <video-player> (UUID en `sessionId`), de modo que cada apertura
     * del reproductor produce exactamente una fila independiente: la analítica
     * por sesión es atómica, sin heurísticas de ventana temporal.
     *
     * Si el ping llega con un sessionId aún no visto (primer heartbeat de la
     * sesión), se crea la fila y se suman los 5 s del propio pulso.
     */
    @Transactional
    public void registrarHeartbeat(Long idVideo, String emailUsuario,
                                   Double currentTime, String sessionId,
                                   Long grupoId) {

        Video   video   = videoRepository.getByIdOrThrow(idVideo);
        Usuario usuario = userRepository.getByEmailOrThrow(emailUsuario);

        verificarAcceso(video, emailUsuario);

        // Clave lógica del UPSERT: (usuario, video, grupoId). Si el usuario ve
        // el mismo vídeo desde dos grupos distintos, cada uno acumula sus
        // segundos en su propia fila, lo que permite analíticas por grupo.
        Log log = logRepository
                .findByUsuarioVideoYGrupo(usuario, video, grupoId)
                .orElseGet(() -> {
                    Log nuevoLog = new Log();
                    nuevoLog.setUsuario(usuario);
                    nuevoLog.setVideo(video);
                    nuevoLog.setSessionId(sessionId);
                    nuevoLog.setGrupoId(grupoId);
                    return nuevoLog;
                });

        int previos = log.getSegundosVistos() != null ? log.getSegundosVistos() : 0;
        log.setSegundosVistos(previos + HEARTBEAT_INTERVAL_SECONDS);
        logRepository.save(log);
    }

    @Transactional
    public void eliminarLogsPorVideo(Long idVideo) {
        logRepository.deleteByVideoId(idVideo);
    }

    public void verificarAcceso(Video video, String emailUsuario) {
        if (video.getPropietario().getEmail().equals(emailUsuario)) return;
        if (!miembrosGrupoRepository.existsMiembroConAccesoAlVideo(emailUsuario, video.getIdVideo())) {
            throw new AccessDeniedException("Acceso denegado al video");
        }
    }
}
