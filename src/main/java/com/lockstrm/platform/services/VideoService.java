package com.lockstrm.platform.services;

import com.lockstrm.platform.dto.VideoDTO;
import com.lockstrm.platform.entities.Grupo;
import com.lockstrm.platform.entities.PermisosGrupo;
import com.lockstrm.platform.entities.Usuario;
import com.lockstrm.platform.entities.Video;
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
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
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
                            Long idGrupo, String miniaturaUrl, Integer duracion) throws IOException {
        if (file.getSize() > MAX_FILE_SIZE) {
            throw new com.lockstrm.platform.exceptions.InvalidFileException(
                    "El archivo excede el tamaño máximo permitido (200 MB)");
        }

        String ext = mimeValidator.validateAndGetExtension(file);

        Usuario autor = userRepository.getByEmailOrThrow(emailUsuario);

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

        if (idGrupo != null) {
            Grupo grupo = resolverGrupoPropio(idGrupo, emailUsuario);
            permisosGrupoRepository.save(new PermisosGrupo(guardado.getIdVideo(), grupo.getIdGrupo()));
        }

        return guardado;
    }

    private Grupo resolverGrupoPropio(Long idGrupo, String emailUsuario) {
        Grupo grupo = grupoRepository.getByIdOrThrow(idGrupo);
        if (!grupo.getCreador().getEmail().equals(emailUsuario)) {
            throw new AccessDeniedException("No puedes asignar un vídeo a un grupo que no has creado");
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
        Map<Long, GrupoRef> grupoMap = buildGrupoMap(videos);
        return videos.stream().map(v -> toDTO(v, grupoMap)).toList();
    }

    @Transactional(readOnly = true)
    public List<VideoDTO> obtenerMisVideos(String emailUsuario) {
        List<Video> videos = videoRepository.findByPropietario_Email(emailUsuario);
        Map<Long, GrupoRef> grupoMap = buildGrupoMap(videos);
        return videos.stream().map(v -> toDTO(v, grupoMap)).toList();
    }

    @Transactional(readOnly = true)
    public List<VideoDTO> obtenerVideosCompartidos(String emailUsuario) {
        List<Video> videos = videoRepository.findVideosCompartidosConUsuario(emailUsuario);
        Map<Long, GrupoRef> grupoMap = buildGrupoMap(videos);
        return videos.stream().map(v -> toDTO(v, grupoMap)).toList();
    }

    private record GrupoRef(Long idGrupo, String nombre) {}

    private VideoDTO toDTO(Video video, Map<Long, GrupoRef> grupoMap) {
        GrupoRef ref = grupoMap.get(video.getIdVideo());
        return new VideoDTO(
                video.getIdVideo(),
                video.getTitulo(),
                video.getDuracion(),
                video.getFechaSubida(),
                ref != null ? ref.idGrupo() : null,
                ref != null ? ref.nombre()  : null,
                video.getMiniaturaUrl(),
                video.getFileName()   // nombre de fichero UUID, no URL directa
        );
    }

    private Map<Long, GrupoRef> buildGrupoMap(List<Video> videos) {
        if (videos.isEmpty()) return Map.of();
        List<Long> ids = videos.stream().map(Video::getIdVideo).toList();
        return permisosGrupoRepository.findByVideoIds(ids).stream()
                .collect(Collectors.toMap(
                        pg -> pg.getId().getIdVideoId(),
                        pg -> new GrupoRef(pg.getId().getIdGrupoId(), pg.getGrupo().getNombre()),
                        (a, b) -> a
                ));
    }

    @Transactional
    public VideoDTO editarVideo(Long idVideo, String emailUsuario, String titulo, Long idGrupo) {
        Video video = videoRepository.getByIdOrThrow(idVideo);

        if (!video.getPropietario().getEmail().equals(emailUsuario)) {
            throw new AccessDeniedException("No tienes permiso para editar este vídeo");
        }

        video.setTitulo(titulo);
        videoRepository.save(video);

        Grupo grupo = null;
        if (idGrupo != null) {
            grupo = resolverGrupoPropio(idGrupo, emailUsuario);
        }

        permisosGrupoRepository.deleteByVideoId(idVideo);

        String grupoNombre = null;
        if (grupo != null) {
            permisosGrupoRepository.save(new PermisosGrupo(idVideo, grupo.getIdGrupo()));
            grupoNombre = grupo.getNombre();
        }

        return new VideoDTO(
                video.getIdVideo(),
                video.getTitulo(),
                video.getDuracion(),
                video.getFechaSubida(),
                idGrupo,
                grupoNombre,
                video.getMiniaturaUrl(),
                video.getFileName()
        );
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
