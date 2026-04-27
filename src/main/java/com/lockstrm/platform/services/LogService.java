package com.lockstrm.platform.services;

import com.lockstrm.platform.entities.Log;
import com.lockstrm.platform.entities.User;
import com.lockstrm.platform.entities.Video;
import com.lockstrm.platform.repositories.LogRepository;
import com.lockstrm.platform.repositories.GroupMemberRepository;
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
    private final GroupMemberRepository  miembrosGroupRepository;

    /**
     * Segundos reales de reproducción que representa cada ping del cliente.
     * El reproductor dispara el timer en `play` y lo detiene en `pause`/`ended`,
     * por lo que cada pulso equivale a este intervalo fijo. Sumar una constante
     * en lugar del `currentTime` reportado neutraliza la trampa de arrastrar
     * la barra al final del vídeo.
     */
    private static final int HEARTBEAT_INTERVAL_SECONDS = 5;

    /**
     * Acumula segundos de reproducción sobre la fila de `logs` correspondiente
     * a ESTA sesión concreta del reproductor.
     *
     * Clave de UPSERT: (usuario, vídeo, grupoId, sessionId).
     *  - sessionId lo genera el cliente al montar el <video-player>; cada
     *    apertura del reproductor produce un UUID nuevo y, por tanto, una
     *    fila independiente. Volver a abrir el mismo vídeo el mismo día
     *    crea otra fila — esto preserva la granularidad por sesión que
     *    necesita la analítica.
     *  - grupoId segrega por contexto: ver el vídeo desde el Group A y
     *    desde el Group B genera dos filas distintas aunque el sessionId
     *    fuera (improbablemente) el mismo.
     *
     * Si el ping llega con una combinación aún no vista (primer heartbeat
     * de la sesión), se crea la fila y se suman los 5 s del propio pulso.
     */
    @Transactional
    public void registrarHeartbeat(Long idVideo, String emailUsuario,
                                   Double currentTime, String sessionId,
                                   Long grupoId) {

        Video   video   = videoRepository.getByIdOrThrow(idVideo);
        User usuario = userRepository.getByEmailOrThrow(emailUsuario);

        verificarAcceso(video, emailUsuario);

        Log log = logRepository
                .findSesion(usuario, video, grupoId, sessionId)
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
        if (!miembrosGroupRepository.existsMiembroConAccesoAlVideo(emailUsuario, video.getIdVideo())) {
            throw new AccessDeniedException("Acceso denegado al video");
        }
    }
}
