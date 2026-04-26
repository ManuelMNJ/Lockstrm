package com.lockstrm.platform.services;

import com.lockstrm.platform.dto.VideoDTO;
import com.lockstrm.platform.dto.VideoDTO.GrupoRef;
import com.lockstrm.platform.entities.Grupo;
import com.lockstrm.platform.entities.MiembrosGrupoId;
import com.lockstrm.platform.entities.PermisosGrupo;
import com.lockstrm.platform.entities.Usuario;
import com.lockstrm.platform.entities.Video;
import com.lockstrm.platform.enums.RolGrupo;
import com.lockstrm.platform.repositories.GrupoRepository;
import com.lockstrm.platform.repositories.MiembrosGrupoRepository;
import com.lockstrm.platform.repositories.PermisosGrupoRepository;
import com.lockstrm.platform.repositories.UserRepository;
import com.lockstrm.platform.repositories.VideoRepository;
import com.lockstrm.platform.repositories.VideoVistaRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.UrlResource;
import org.springframework.core.io.support.ResourceRegion;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpRange;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.MediaTypeFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class VideoService {

    private final VideoRepository         videoRepository;
    private final UserRepository          userRepository;
    private final GrupoRepository         grupoRepository;
    private final MiembrosGrupoRepository miembrosGrupoRepository;
    private final PermisosGrupoRepository permisosGrupoRepository;
    private final VideoVistaRepository    videoVistaRepository;
    private final LogService              logService;
    private final VideoMimeValidator      mimeValidator;

    @Value("${lockstrm.upload.dir}")
    private String uploadDir;

    private static final long MAX_FILE_SIZE = 200L * 1024 * 1024; // 200 MB

    @Transactional
    public Video subirVideo(MultipartFile file, String emailUsuario, String titulo,
                            List<Long> idGrupos, String miniaturaUrl, Integer duracion) throws IOException {
        if (file.getSize() > MAX_FILE_SIZE) {
            throw new com.lockstrm.platform.exceptions.InvalidFileException(
                    "El archivo excede el tamaño máximo permitido (200 MB)");
        }

        String ext = mimeValidator.validateAndGetExtension(file);

        Usuario autor = userRepository.getByEmailOrThrow(emailUsuario);

        // Antes de tocar disco, validamos el rol en CADA grupo destino. Si
        // alguno falla, abortamos sin haber escrito el fichero ni la fila.
        // `LinkedHashSet` deduplica preservando el orden de entrada.
        Set<Long> destinos = idGrupos == null ? Set.of() : new LinkedHashSet<>(idGrupos);
        List<Grupo> grupos = new ArrayList<>(destinos.size());
        for (Long idGrupo : destinos) {
            grupos.add(resolverGrupoPropio(idGrupo, emailUsuario));
        }

        String fileName = UUID.randomUUID() + "." + ext;

        Path dir = Paths.get(uploadDir).toAbsolutePath().normalize();
        Files.createDirectories(dir);
        Path target = dir.resolve(fileName).normalize();
        if (!target.startsWith(dir)) {
            throw new com.lockstrm.platform.exceptions.InvalidFileException("Ruta de archivo no válida");
        }
        Files.copy(file.getInputStream(), target, StandardCopyOption.REPLACE_EXISTING);

        Video nuevoVideo = new Video();
        nuevoVideo.setTitulo(titulo);
        nuevoVideo.setDuracion(duracion != null ? duracion : 0);
        nuevoVideo.setFileName(fileName);
        nuevoVideo.setMiniaturaUrl(miniaturaUrl);
        nuevoVideo.setFechaSubida(LocalDateTime.now());
        nuevoVideo.setPropietario(autor);

        Video guardado = videoRepository.save(nuevoVideo);

        for (Grupo grupo : grupos) {
            permisosGrupoRepository.save(
                    new PermisosGrupo(guardado.getIdVideo(), grupo.getIdGrupo()));
        }

        return guardado;
    }

    private Grupo resolverGrupoPropio(Long idGrupo, String emailUsuario) {
        Grupo grupo = grupoRepository.getByIdOrThrow(idGrupo);
        Usuario usuario = userRepository.getByEmailOrThrow(emailUsuario);
        RolGrupo rol = miembrosGrupoRepository
                .findById(new MiembrosGrupoId(usuario.getIdUsuario(), idGrupo))
                .map(mg -> mg.getRol())
                .orElseThrow(() -> new AccessDeniedException(
                        "No puedes asignar un vídeo a un grupo del que no eres miembro"));
        if (rol.ordinal() > RolGrupo.EDITOR.ordinal()) {
            throw new AccessDeniedException(
                    "Se requiere rol EDITOR o superior para añadir vídeos al grupo");
        }
        return grupo;
    }

    /**
     * Streaming HTTP 206 desde el sistema de archivos local.
     * Siempre responde 206 Partial Content para compatibilidad con reproductores HTML5.
     */
    public ResponseEntity<ResourceRegion> streamVideoLocal(String fileName,
                                                           HttpHeaders requestHeaders,
                                                           String emailUsuario) throws IOException {
        Video video = videoRepository.findByFileName(fileName)
                .orElseThrow(() -> new NoSuchElementException("Vídeo no encontrado: " + fileName));

        logService.verificarAcceso(video, emailUsuario);

        Path baseDir  = Paths.get(uploadDir).toAbsolutePath().normalize();
        Path filePath = baseDir.resolve(fileName).normalize();
        if (!filePath.startsWith(baseDir)) {
            throw new com.lockstrm.platform.exceptions.InvalidFileException("Ruta de archivo no válida");
        }
        UrlResource resource = new UrlResource(filePath.toUri());
        if (!resource.exists()) {
            throw new NoSuchElementException("Archivo no encontrado en disco: " + fileName);
        }

        long contentLength = resource.contentLength();
        MediaType mediaType = MediaTypeFactory.getMediaType(resource)
                .orElse(MediaType.APPLICATION_OCTET_STREAM);

        List<HttpRange> ranges = requestHeaders.getRange();
        long start, end;

        if (ranges.isEmpty()) {
            start = 0;
            end   = contentLength - 1;
        } else {
            HttpRange range = ranges.get(0);
            start = range.getRangeStart(contentLength);
            end   = range.getRangeEnd(contentLength);
        }
        // La telemetría por sesión la gestiona exclusivamente el heartbeat
        // del cliente (ver LogService.registrarHeartbeat): la primera fila de
        // `logs` se crea con el primer ping, identificada por sessionId.
        // Mantener aquí una creación paralela produciría filas sin sessionId
        // y rompería la correspondencia "una sesión = una fila".

        ResourceRegion region = new ResourceRegion(resource, start, end - start + 1);

        return ResponseEntity.status(HttpStatus.PARTIAL_CONTENT)
                .contentType(mediaType)
                .header(HttpHeaders.ACCEPT_RANGES, "bytes")
                .body(region);
    }

    @Transactional(readOnly = true)
    public List<VideoDTO> obtenerVideosPorGrupo(Long idGrupo, String emailUsuario) {
        if (miembrosGrupoRepository.countMiembroByEmailAndGrupo(emailUsuario, idGrupo) == 0) {
            throw new AccessDeniedException("No tienes acceso a este grupo");
        }
        List<Video> videos = videoRepository.findByGrupoId(idGrupo);
        Map<Long, List<GrupoRef>> grupoMap = buildGrupoMap(videos);
        return videos.stream().map(v -> toDTO(v, grupoMap)).toList();
    }

    @Transactional(readOnly = true)
    public List<VideoDTO> obtenerMisVideos(String emailUsuario) {
        List<Video> videos = videoRepository.findByPropietario_Email(emailUsuario);
        Map<Long, List<GrupoRef>> grupoMap = buildGrupoMap(videos);
        return videos.stream().map(v -> toDTO(v, grupoMap)).toList();
    }

    @Transactional(readOnly = true)
    public List<VideoDTO> obtenerVideosCompartidos(String emailUsuario) {
        List<Video> videos = videoRepository.findVideosCompartidosConUsuario(emailUsuario);
        Map<Long, List<GrupoRef>> grupoMap = buildGrupoMap(videos);
        return videos.stream().map(v -> toDTO(v, grupoMap)).toList();
    }

    private VideoDTO toDTO(Video video, Map<Long, List<GrupoRef>> grupoMap) {
        List<GrupoRef> refs = grupoMap.getOrDefault(video.getIdVideo(), List.of());
        return new VideoDTO(
                video.getIdVideo(),
                video.getTitulo(),
                video.getDuracion(),
                video.getFechaSubida(),
                refs,
                video.getMiniaturaUrl(),
                video.getFileName()   // nombre de fichero UUID, no URL directa
        );
    }

    /**
     * Mapa idVideo → lista de grupos a los que pertenece. Una sola consulta
     * con JOIN FETCH evita el N+1, y agrupar manualmente en lugar de usar
     * `toMap` permite que un mismo vídeo aparezca en varios grupos (N:M real).
     */
    private Map<Long, List<GrupoRef>> buildGrupoMap(List<Video> videos) {
        if (videos.isEmpty()) return Map.of();
        List<Long> ids = videos.stream().map(Video::getIdVideo).toList();
        return permisosGrupoRepository.findByVideoIds(ids).stream()
                .collect(Collectors.groupingBy(
                        pg -> pg.getId().getIdVideoId(),
                        Collectors.mapping(
                                pg -> new GrupoRef(pg.getId().getIdGrupoId(), pg.getGrupo().getNombre()),
                                Collectors.toList()
                        )
                ));
    }

    /**
     * Reemplaza la lista de grupos del vídeo por la indicada (semántica de
     * "set"). Se valida ANTES de tocar la BBDD que el propietario tenga rol
     * EDITOR+ en cada grupo de la lista; si alguna validación falla, la
     * transacción aborta y no queda estado parcial.
     *
     * Implementación: borrar todas las filas de permisos del vídeo y
     * reinsertarlas. Es más simple que un diff con `deleteById` + `save`
     * mezclados — ese patrón con `@EmbeddedId` puede provocar fallos de
     * orden de flush en Hibernate (el motivo del 500 visto en producción).
     * Hacemos `flush()` entre el delete y los inserts para asegurar que
     * el DELETE se ejecuta antes que los INSERT y no haya conflicto de PK
     * en la sesión cuando se conserva un grupo ya existente.
     *
     * Reglas de seguridad:
     *  - Solo el propietario del vídeo puede editar.
     *  - Para que un grupo aparezca en la lista, el propietario debe ser
     *    miembro de ese grupo con rol EDITOR o superior.
     */
    @Transactional
    public VideoDTO editarVideo(Long idVideo, String emailUsuario, String titulo, List<Long> idGrupos) {
        Video video = videoRepository.getByIdOrThrow(idVideo);

        if (!video.getPropietario().getEmail().equals(emailUsuario)) {
            throw new AccessDeniedException("No tienes permiso para editar este vídeo");
        }

        video.setTitulo(titulo);
        videoRepository.save(video);

        Set<Long> deseados = idGrupos == null ? Set.of() : new LinkedHashSet<>(idGrupos);

        // Validamos rol EDITOR+ en TODOS los grupos antes de tocar BBDD para
        // que un grupo inválido aborte la operación sin estado parcial.
        List<Grupo> gruposValidados = new ArrayList<>(deseados.size());
        for (Long id : deseados) {
            gruposValidados.add(resolverGrupoPropio(id, emailUsuario));
        }

        // `deleteByVideoId` está anotado con flushAutomatically + clearAutomatically:
        // tras esta línea, el persistence context queda limpio para los inserts.
        permisosGrupoRepository.deleteByVideoId(idVideo);
        for (Grupo g : gruposValidados) {
            permisosGrupoRepository.save(new PermisosGrupo(idVideo, g.getIdGrupo()));
        }

        // No releemos con `buildGrupoMap` después de los inserts: Hibernate
        // cachea las PermisosGrupo recién persistidas con su relación `grupo`
        // a null (la columna está marcada `insertable=false`), y el JOIN FETCH
        // posterior devuelve la instancia gestionada en lugar de hidratar la
        // fresca → NPE en `pg.getGrupo().getNombre()`. Construimos el listado
        // a mano con los Grupo ya validados — son justo los que acabamos de
        // persistir.
        List<GrupoRef> refs = gruposValidados.stream()
                .map(g -> new GrupoRef(g.getIdGrupo(), g.getNombre()))
                .toList();
        return toDTO(video, Map.of(idVideo, refs));
    }

    @Transactional(readOnly = true)
    public Map<String, Long> obtenerEspacioUsado(String emailUsuario) {
        List<Video> videos = videoRepository.findByPropietario_Email(emailUsuario);
        Path baseDir = Paths.get(uploadDir).toAbsolutePath().normalize();
        long usedBytes = 0L;
        for (Video v : videos) {
            if (v.getFileName() == null) continue;
            try {
                Path file = baseDir.resolve(v.getFileName()).normalize();
                if (file.startsWith(baseDir) && Files.exists(file)) {
                    usedBytes += Files.size(file);
                }
            } catch (IOException e) {
                log.warn("No se pudo leer el tamaño de '{}': {}", v.getFileName(), e.getMessage());
            }
        }
        long limitBytes = 5L * 1024 * 1024 * 1024; // 5 GB
        return Map.of("usedBytes", usedBytes, "limitBytes", limitBytes);
    }

    @Transactional
    public void eliminarVideo(Long idVideo, String userEmail) {
        Video video = videoRepository.getByIdOrThrow(idVideo);

        if (!video.getPropietario().getEmail().equals(userEmail)) {
            throw new AccessDeniedException("No tienes permiso para eliminar este vídeo");
        }

        String fileName = video.getFileName();

        permisosGrupoRepository.deleteByVideoId(idVideo);
        videoVistaRepository.deleteByVideoId(idVideo);
        logService.eliminarLogsPorVideo(idVideo);
        videoRepository.delete(video);

        // fileName puede ser null en vídeos subidos antes de la migración
        if (fileName != null) {
            try {
                Files.deleteIfExists(Paths.get(uploadDir).resolve(fileName));
            } catch (IOException e) {
                log.warn("No se pudo eliminar el archivo '{}': {}", fileName, e.getMessage());
            }
        }
    }
}
