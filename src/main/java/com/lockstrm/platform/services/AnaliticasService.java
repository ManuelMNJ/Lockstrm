package com.lockstrm.platform.services;

import com.lockstrm.platform.dto.AnaliticasGlobalesDto;
import com.lockstrm.platform.dto.GrupoVideoStatsDto;
import com.lockstrm.platform.dto.VideoLogDto;
import com.lockstrm.platform.dto.VideoTopDto;
import com.lockstrm.platform.entities.Grupo;
import com.lockstrm.platform.entities.MiembrosGrupoId;
import com.lockstrm.platform.entities.Usuario;
import com.lockstrm.platform.entities.Video;
import com.lockstrm.platform.enums.RolGrupo;
import com.lockstrm.platform.repositories.GrupoRepository;
import com.lockstrm.platform.repositories.LogRepository;
import com.lockstrm.platform.repositories.MiembrosGrupoRepository;
import com.lockstrm.platform.repositories.UserRepository;
import com.lockstrm.platform.repositories.VideoRepository;
import com.lockstrm.platform.repositories.VideoVistaRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AnaliticasService {

    private static final int TOP_VIDEOS = 5;

    private final VideoVistaRepository    videoVistaRepository;
    private final VideoRepository         videoRepository;
    private final LogRepository           logRepository;
    private final GrupoRepository         grupoRepository;
    private final MiembrosGrupoRepository miembrosGrupoRepository;
    private final UserRepository          userRepository;

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
     * Solo el propietario del vídeo puede consultarlo. Si se proporciona
     * `grupoId`, las analíticas se acotan a las sesiones reproducidas dentro
     * de ese grupo (analítica contextual); en caso contrario se devuelven
     * todos los logs del vídeo.
     */
    @Transactional(readOnly = true)
    public List<VideoLogDto> logsDelVideo(Long idVideo, String emailSolicitante, Long grupoId) {
        Video video = videoRepository.getByIdOrThrow(idVideo);
        if (!video.getPropietario().getEmail().equals(emailSolicitante)) {
            throw new AccessDeniedException("Solo el propietario puede ver las analíticas de este vídeo");
        }
        // Una sola query parametrizada: el repo aplica el filtro de grupo solo si llega no nulo.
        var logs = logRepository.findLogsByVideoId(idVideo, grupoId);

        // Resolución de nombres de grupo en una sola query: cogemos los
        // grupoId distintos (descartando null) y los pedimos a `findAllById`.
        // Si un grupo fue eliminado, simplemente no aparecerá en el mapa y el
        // DTO devolverá nombre = null para esa fila — la UI lo pintará como
        // "Sin grupo" / "Grupo eliminado" según convenga.
        List<Long> grupoIds = logs.stream()
                .map(com.lockstrm.platform.entities.Log::getGrupoId)
                .filter(Objects::nonNull)
                .distinct()
                .toList();
        Map<Long, String> nombresPorId = grupoIds.isEmpty()
                ? Map.of()
                : grupoRepository.findAllById(grupoIds).stream()
                        .collect(Collectors.toMap(Grupo::getIdGrupo, Grupo::getNombre));

        return logs.stream()
                .map(l -> new VideoLogDto(
                        l.getIdLog(),
                        l.getUsuario().getIdUsuario(),
                        l.getUsuario().getUsername(),
                        l.getUsuario().getTag(),
                        l.getFechaHora(),
                        l.getSegundosVistos(),
                        l.getGrupoId(),
                        l.getGrupoId() != null ? nombresPorId.get(l.getGrupoId()) : null))
                .toList();
    }

    /**
     * Analítica B2B segregada por grupo: una fila por vídeo del grupo con
     * espectadores únicos y tiempo total de reproducción dentro de ese grupo.
     *
     * Las sesiones reproducidas desde otros grupos en los que el vídeo
     * también está compartido NO entran en estos agregados (segregación).
     *
     * Autorización: solo los miembros del grupo con rol EDITOR o superior
     * (EDITOR / ADMIN / SUPER_ADMIN) pueden consultar las analíticas.
     */
    @Transactional(readOnly = true)
    public List<GrupoVideoStatsDto> analiticasDelGrupo(Long idGrupo, String emailSolicitante) {
        // El propio getByIdOrThrow dispara 404 si el grupo no existe.
        grupoRepository.getByIdOrThrow(idGrupo);

        Usuario solicitante = userRepository.getByEmailOrThrow(emailSolicitante);
        RolGrupo rol = miembrosGrupoRepository
                .findById(new MiembrosGrupoId(solicitante.getIdUsuario(), idGrupo))
                .map(mg -> mg.getRol())
                .orElseThrow(() -> new AccessDeniedException(
                        "No eres miembro de este grupo"));
        if (rol.ordinal() > RolGrupo.EDITOR.ordinal()) {
            throw new AccessDeniedException(
                    "Se requiere rol EDITOR o superior para ver las analíticas del grupo");
        }

        return logRepository.statsPorVideoEnGrupo(idGrupo);
    }
}
