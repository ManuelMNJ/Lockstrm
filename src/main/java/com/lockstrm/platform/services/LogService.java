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

    @Transactional
    public void registrarAcceso(Video video, String emailUsuario) {
        Usuario usuario = userRepository.getByEmailOrThrow(emailUsuario);

        Log log = new Log();
        log.setUsuario(usuario);
        log.setVideo(video);
        // segundosVistos se deja null: se rellenará con el primer heartbeat
        logRepository.save(log);
    }

    /**
     * Intervalo con el que el cliente emite heartbeats mientras el vídeo reproduce
     * (ver VideoPlayerComponent.initHeartbeat). Cada ping representa 5 s reales
     * de visualización, ya que el timer está vinculado a los eventos play/pause
     * del <video> y se detiene cuando el usuario pausa.
     */
    private static final int HEARTBEAT_INTERVAL_SECONDS = 5;

    /**
     * Upsert diario del tiempo acumulado de visualización.
     *
     * El servidor IGNORA el currentTime del payload para el cálculo: suma 5 s
     * fijos por ping. Esto hace el contador inmune a la trampa de arrastrar
     * la barra al final (el cliente mandaría currentTime = duracion pero solo
     * sumaría los 5 s correspondientes al propio ping). El parámetro currentTime
     * se conserva por si en el futuro queremos guardar la posición más lejana
     * alcanzada en otra columna.
     *
     * Como el cliente solo dispara el timer mientras el vídeo reproduce, cada
     * ping corresponde efectivamente a 5 s de reproducción real. Si el usuario
     * vuelve a ver el vídeo, los segundos se siguen acumulando (el mismo row
     * del día suma), reflejando el tiempo total visto en la sesión.
     */
    @Transactional
    public void registrarHeartbeat(Long idVideo, String emailUsuario, Double currentTime) {

        Video video = videoRepository.getByIdOrThrow(idVideo);
        Usuario usuario = userRepository.getByEmailOrThrow(emailUsuario);

        verificarAcceso(video, emailUsuario);

        // El heartbeat acumula sobre la sesión más reciente (la creada por
        // registrarAcceso al iniciar el streaming). Si no existe ninguna —
        // caso extremo: heartbeat llega antes del primer byte del vídeo —,
        // se crea una nueva fila para no perder la telemetría.
        Log log = logRepository
                .findTopByUsuarioAndVideoOrderByFechaHoraDesc(usuario, video)
                .orElseGet(() -> {
                    Log nuevoLog = new Log();
                    nuevoLog.setUsuario(usuario);
                    nuevoLog.setVideo(video);
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
