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

import java.time.LocalDate;
import java.time.LocalDateTime;

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

    /** Upsert diario: actualiza segundosVistos del log de hoy o crea uno nuevo. */
    @Transactional
    public void registrarHeartbeat(Long idVideo, String emailUsuario, Double currentTime) {

        Video video = videoRepository.getByIdOrThrow(idVideo);
        Usuario usuario = userRepository.getByEmailOrThrow(emailUsuario);

        // Verificación de acceso: misma lógica que el proxy de streaming.
        // Un usuario malintencionado no debería poder hacer POST al heartbeat
        // de un vídeo al que no tiene acceso.
        verificarAcceso(video, emailUsuario);

        // Rango del día actual en la zona horaria del servidor.
        LocalDateTime inicioDia = LocalDate.now().atStartOfDay();
        LocalDateTime finDia    = inicioDia.plusDays(1);

        // Upsert: busca el registro de hoy o crea uno nuevo.
        Log log = logRepository
                .findFirstByUsuarioAndVideoAndFechaHoraBetween(usuario, video, inicioDia, finDia)
                .orElseGet(() -> {
                    Log nuevoLog = new Log();
                    nuevoLog.setUsuario(usuario);
                    nuevoLog.setVideo(video);
                    return nuevoLog;
                });

        // Math.floor garantiza que no guardamos fracciones de segundo.
        log.setSegundosVistos((int) Math.floor(currentTime));
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
