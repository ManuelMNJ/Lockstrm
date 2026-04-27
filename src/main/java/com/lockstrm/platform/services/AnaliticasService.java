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
import com.lockstrm.platform.entities.PermisosGrupoId;
import com.lockstrm.platform.repositories.GrupoRepository;
import com.lockstrm.platform.repositories.LogRepository;
import com.lockstrm.platform.repositories.MiembrosGrupoRepository;
import com.lockstrm.platform.repositories.PermisosGrupoRepository;
import com.lockstrm.platform.repositories.UserRepository;
import com.lockstrm.platform.repositories.VideoRepository;
import com.lockstrm.platform.repositories.VideoVistaRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
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
    private final PermisosGrupoRepository permisosGrupoRepository;
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
                        VideoService.resolveThumbnailUrl(r.miniaturaUrl()),
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
     *
     * Control de acceso por contexto:
     *  - Sin `grupoId` (analítica global): solo el propietario del vídeo.
     *  - Con `grupoId` (drill-down B2B):
     *      · El propietario del vídeo SIEMPRE puede.
     *      · Un EDITOR del grupo solo puede si ES el propietario del vídeo
     *        — un EDITOR no debe ver métricas de vídeos ajenos.
     *      · Un ADMIN/SUPER_ADMIN del grupo puede ver el drill-down de
     *        cualquier vídeo del grupo.
     *  - Defensa en profundidad: si llega `grupoId`, comprobamos que el
     *    vídeo esté realmente compartido con ese grupo.
     */
    @Transactional(readOnly = true)
    public List<VideoLogDto> logsDelVideo(Long idVideo, String emailSolicitante, Long grupoId) {
        return logsDelVideo(idVideo, emailSolicitante, grupoId, null, null);
    }

    @Transactional(readOnly = true)
    public List<VideoLogDto> logsDelVideo(Long idVideo, String emailSolicitante, Long grupoId,
                                          LocalDateTime desde, LocalDateTime hasta) {
        Video video = videoRepository.getByIdOrThrow(idVideo);
        boolean esPropietario = video.getPropietario().getEmail().equals(emailSolicitante);

        if (grupoId != null) {
            if (!permisosGrupoRepository.existsById(new PermisosGrupoId(idVideo, grupoId))) {
                throw new AccessDeniedException("Este vídeo no está en el grupo indicado");
            }
            if (!esPropietario) {
                Usuario solicitante = userRepository.getByEmailOrThrow(emailSolicitante);
                RolGrupo rol = miembrosGrupoRepository
                        .findById(new MiembrosGrupoId(solicitante.getIdUsuario(), grupoId))
                        .map(mg -> mg.getRol())
                        .orElseThrow(() -> new AccessDeniedException(
                                "No eres miembro de este grupo"));
                // EDITOR no propietario → bloqueado. Solo ADMIN+ pueden
                // hacer drill-down sobre vídeos que no han subido ellos.
                if (rol.ordinal() > RolGrupo.ADMIN.ordinal()) {
                    throw new AccessDeniedException(
                            "Solo los administradores del grupo pueden ver las analíticas de vídeos ajenos");
                }
            }
        } else if (!esPropietario) {
            throw new AccessDeniedException(
                    "Solo el propietario puede ver las analíticas globales del vídeo");
        }

        // Una sola query parametrizada: el repo aplica los filtros (grupo, rango de fechas) si llegan.
        var logs = logRepository.findLogsByVideoId(idVideo, grupoId, desde, hasta);

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
     * Analítica B2B segregada por grupo: una fila por vídeo con agregados
     * acotados al contexto del grupo (las sesiones desde otros grupos no
     * entran).
     *
     * Visibilidad por rol:
     *   - EDITOR: solo los vídeos que él mismo subió. Esto permite tener
     *     muchos editores en un grupo sin que cada uno vea las métricas
     *     ajenas.
     *   - ADMIN / SUPER_ADMIN: todos los vídeos del grupo, con el autor de
     *     cada uno (la columna "Subido por" de la tabla).
     *   - MIEMBRO o no-miembro: 403.
     */
    @Transactional(readOnly = true)
    public List<GrupoVideoStatsDto> analiticasDelGrupo(Long idGrupo, String emailSolicitante,
                                                       LocalDateTime desde, LocalDateTime hasta) {
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

        // EDITOR: filtramos por autor. ADMIN/SUPER_ADMIN: null = sin filtro.
        String autorEmail = (rol == RolGrupo.EDITOR) ? emailSolicitante : null;

        List<GrupoVideoStatsDto> stats = logRepository.statsPorVideoEnGrupo(
                idGrupo, autorEmail, desde, hasta);

        return enriquecerConSparkline(stats, idGrupo, autorEmail);
    }

    /**
     * Tamaño del sparkline. 30 puntos = un día por punto en el último mes.
     * Es independiente del filtro `desde`/`hasta` del usuario; siempre te da
     * el contexto temporal fijo "qué pasó en los últimos 30 días" para que
     * la mini-gráfica sea comparable entre vídeos y entre filtros.
     */
    private static final int SPARKLINE_DIAS = 30;

    private List<GrupoVideoStatsDto> enriquecerConSparkline(List<GrupoVideoStatsDto> stats,
                                                            Long idGrupo, String autorEmail) {
        if (stats.isEmpty()) return stats;

        LocalDate hoy   = LocalDate.now();
        LocalDate desde = hoy.minusDays(SPARKLINE_DIAS - 1L);

        // Una sola query: filas (idVideo, fecha, visitas) acotadas al grupo,
        // al autor (si es EDITOR) y a los últimos N días.
        var rows = logRepository.visitasPorDia(idGrupo, autorEmail, desde.atStartOfDay());

        // Agrupa: idVideo → (fecha → visitas).
        Map<Long, Map<LocalDate, Long>> mapa = new HashMap<>();
        for (var r : rows) {
            mapa.computeIfAbsent(r.getIdVideo(), k -> new HashMap<>())
                .merge(r.getFecha(), r.getVisitas(), Long::sum);
        }

        // Para cada vídeo, materializamos un array de tamaño SPARKLINE_DIAS
        // alineado al calendario [hoy-(N-1), hoy]. Días sin visitas = 0.
        // Esto evita que el frontend tenga que reconstruir el calendario.
        return stats.stream().map(s -> {
            Map<LocalDate, Long> porDia = mapa.getOrDefault(s.idVideo(), Map.of());
            List<Integer> serie = new ArrayList<>(SPARKLINE_DIAS);
            for (int i = 0; i < SPARKLINE_DIAS; i++) {
                LocalDate dia = desde.plusDays(i);
                serie.add(porDia.getOrDefault(dia, 0L).intValue());
            }
            // Resolvemos la URL de miniatura (nombre de fichero → ruta pública)
            // en el mismo paso que el sparkline para no añadir otra pasada.
            return new GrupoVideoStatsDto(
                    s.idVideo(),
                    s.titulo(),
                    VideoService.resolveThumbnailUrl(s.miniaturaUrl()),
                    s.duracion(),
                    s.autorIdUsuario(),
                    s.autorUsername(),
                    s.autorTag(),
                    s.visitasTotales(),
                    s.espectadoresUnicos(),
                    s.tiempoTotalSegundos(),
                    s.duracionMediaSegundos(),
                    s.porcentajeCompletadoMedio(),
                    s.ultimaVisita(),
                    serie);
        }).toList();
    }
}
