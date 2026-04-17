package com.lockstrm.platform.services;

import com.lockstrm.platform.entities.Log;
import com.lockstrm.platform.entities.PermisosGrupo;
import com.lockstrm.platform.entities.Usuario;
import com.lockstrm.platform.entities.Video;
import com.lockstrm.platform.repositories.LogRepository;
import com.lockstrm.platform.repositories.MiembrosGrupoRepository;
import com.lockstrm.platform.repositories.PermisosGrupoRepository;
import com.lockstrm.platform.repositories.UserRepository;
import com.lockstrm.platform.repositories.VideoRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class LogService {

    private final LogRepository            logRepository;
    private final UserRepository           userRepository;
    private final VideoRepository          videoRepository;
    private final PermisosGrupoRepository  permisosGrupoRepository;
    private final MiembrosGrupoRepository  miembrosGrupoRepository;

    // ── Registro de acceso inicial ──────────────────────────────────────────

    /**
     * Crea un nuevo registro de auditoría cuando el usuario inicia la reproducción
     * (primera petición de bytes del stream). Llamado desde VideoService.
     *
     * No verifica acceso porque VideoService ya lo ha hecho antes de llamar aquí.
     */
    @Transactional
    public void registrarAcceso(Video video, String emailUsuario) {
        Usuario usuario = userRepository.findByEmail(emailUsuario)
                .orElseThrow(() -> new RuntimeException("Usuario no encontrado: " + emailUsuario));

        Log log = new Log();
        log.setUsuario(usuario);
        log.setVideo(video);
        // segundosVistos se deja null: se rellenará con el primer heartbeat
        logRepository.save(log);
    }

    // ── Heartbeat (upsert diario) ───────────────────────────────────────────

    /**
     * Procesa un pulso de telemetría del reproductor.
     *
     * Lógica de upsert:
     *   - Si ya existe un Log para este usuario+vídeo creado HOY → actualiza segundosVistos.
     *   - Si no existe (primera sesión del día) → crea un nuevo Log.
     *
     * La búsqueda acota por rango de fecha (inicio/fin del día) para evitar
     * que se actualice erróneamente un registro de días anteriores.
     *
     * @param idVideo      ID del vídeo que se está reproduciendo.
     * @param emailUsuario Email extraído del JWT por Spring Security.
     * @param currentTime  Posición de reproducción en segundos (Double de HTMLVideoElement.currentTime).
     */
    @Transactional
    public void registrarHeartbeat(Long idVideo, String emailUsuario, Double currentTime) {

        Video video = videoRepository.findById(idVideo)
                .orElseThrow(() -> new RuntimeException("Video no encontrado: " + idVideo));

        Usuario usuario = userRepository.findByEmail(emailUsuario)
                .orElseThrow(() -> new RuntimeException("Usuario no encontrado: " + emailUsuario));

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

    // ── Borrado por vídeo (llamado desde VideoService.eliminarVideo) ───────

    /**
     * Elimina todos los registros de log asociados a un vídeo.
     * Debe ejecutarse dentro de la misma transacción que borra el vídeo.
     */
    @Transactional
    public void eliminarLogsPorVideo(Long idVideo) {
        logRepository.deleteByVideoId(idVideo);
    }

    // ── Verificación de acceso compartida ──────────────────────────────────

    /**
     * Comprueba que el usuario es propietario del vídeo o miembro de un grupo
     * con permisos sobre él. Lanza AccessDeniedException si no tiene acceso.
     *
     * Este método es usado tanto por registrarHeartbeat (aquí) como por
     * VideoService.streamVideo() para garantizar que la misma regla de negocio
     * se aplica en ambos puntos de entrada sin duplicar la lógica.
     */
    public void verificarAcceso(Video video, String emailUsuario) {
        boolean esPropietario = video.getPropietario().getEmail().equals(emailUsuario);

        if (!esPropietario) {
            List<PermisosGrupo> permisos = permisosGrupoRepository
                    .findById_IdVideoId(video.getIdVideo());

            boolean esMiembro = permisos.stream()
                    .anyMatch(p -> miembrosGrupoRepository
                            .countMiembroByEmailAndGrupo(
                                    emailUsuario,
                                    p.getId().getIdGrupoId()) > 0);

            if (!esMiembro) {
                throw new AccessDeniedException("Acceso denegado al video");
            }
        }
    }
}
