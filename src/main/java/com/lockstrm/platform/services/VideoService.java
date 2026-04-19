package com.lockstrm.platform.services;

import com.cloudinary.Cloudinary;
import com.cloudinary.utils.ObjectUtils;
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
import org.springframework.core.io.InputStreamResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.FilterInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
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
    private final Cloudinary              cloudinary;

    private static final long MAX_FILE_SIZE = 100L * 1024 * 1024; // 100 MB

    @Transactional
    public Video subirVideo(MultipartFile file, String emailUsuario, String titulo, Long idGrupo, String miniaturaUrl) throws IOException {
        if (file.getSize() > MAX_FILE_SIZE) {
            throw new IllegalArgumentException("El archivo excede el tamaño máximo permitido (100 MB)");
        }

        Usuario autor = userRepository.getByEmailOrThrow(emailUsuario);

        Map<?, ?> uploadResult = cloudinary.uploader().uploadLarge(
                file.getInputStream(),
                ObjectUtils.asMap("resource_type", "video", "chunk_size", 6_000_000));

        Object errorCloudinary = uploadResult.get("error");
        if (errorCloudinary != null) {
            throw new RuntimeException("Cloudinary: " + errorCloudinary.toString());
        }

        Object rawUrl = uploadResult.get("secure_url");
        Object rawId  = uploadResult.get("public_id");
        if (rawUrl == null || rawId == null) {
            throw new RuntimeException("Cloudinary no devolvió URL o ID. Respuesta: " + uploadResult);
        }

        String urlSegura = rawUrl.toString();
        String publicId  = rawId.toString();

        Object rawDuration = uploadResult.get("duration");
        int duracion = (rawDuration instanceof Number) ? ((Number) rawDuration).intValue() : 0;

        Video nuevoVideo = new Video();
        nuevoVideo.setTitulo(titulo);
        nuevoVideo.setDuracion(duracion);
        nuevoVideo.setUrlCloudSecure(urlSegura);
        nuevoVideo.setCloudinaryId(publicId);
        nuevoVideo.setMiniaturaUrl(miniaturaUrl);
        nuevoVideo.setFechaSubida(LocalDateTime.now());
        nuevoVideo.setPropietario(autor);

        Video guardado = videoRepository.save(nuevoVideo);

        if (idGrupo != null) {
            Grupo grupo = grupoRepository.getByIdOrThrow(idGrupo);
            permisosGrupoRepository.save(new PermisosGrupo(guardado.getIdVideo(), grupo.getIdGrupo()));
        }

        return guardado;
    }

    /**
     * Proxy de streaming HTTP 206.
     * La verificación de acceso y el registro de auditoría se delegan a LogService
     * para que la misma lógica sea compartida con el endpoint de heartbeat.
     */
    public ResponseEntity<InputStreamResource> streamVideo(Long id, String rangeHeader, String emailUsuario) throws Exception {
        Video video = videoRepository.getByIdOrThrow(id);

        logService.verificarAcceso(video, emailUsuario);

        // Registra el acceso solo en la primera petición (sin Range o bytes=0-)
        if (rangeHeader == null || rangeHeader.startsWith("bytes=0-")) {
            logService.registrarAcceso(video, emailUsuario);
        }

        HttpURLConnection con = (HttpURLConnection) new URL(video.getUrlCloudSecure()).openConnection();
        try {
            con.setRequestMethod("GET");
            con.setConnectTimeout(10_000);
            con.setReadTimeout(30_000);

            if (rangeHeader != null && !rangeHeader.isBlank()) {
                con.setRequestProperty("Range", rangeHeader);
            }

            con.connect();

            int cloudinaryStatus = con.getResponseCode();

            if (cloudinaryStatus >= 400) {
                throw new RuntimeException("Error al obtener vídeo del almacenamiento: HTTP " + cloudinaryStatus);
            }

            HttpHeaders headers = new HttpHeaders();

            String contentType = con.getHeaderField("Content-Type");
            if (contentType != null) headers.set("Content-Type", contentType);

            String contentLength = con.getHeaderField("Content-Length");
            if (contentLength != null) headers.setContentLength(Long.parseLong(contentLength));

            String contentRange = con.getHeaderField("Content-Range");
            if (contentRange != null) headers.set("Content-Range", contentRange);

            headers.set("Accept-Ranges", "bytes");

            HttpStatus status = (cloudinaryStatus == 206) ? HttpStatus.PARTIAL_CONTENT : HttpStatus.OK;

            // Envuelve el stream para que disconnect() se llame al cerrarlo
            InputStream wrapped = new FilterInputStream(con.getInputStream()) {
                @Override
                public void close() throws IOException {
                    try { super.close(); } finally { con.disconnect(); }
                }
            };

            return ResponseEntity.status(status).headers(headers).body(new InputStreamResource(wrapped));
        } catch (Exception e) {
            con.disconnect();
            throw e;
        }
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
    public List<Video> obtenerPorEmailUsuario(String emailUsuario) {
        return videoRepository.findByPropietario_Email(emailUsuario);
    }

    /** Mis Vídeos: vídeos subidos por el usuario autenticado (contexto Propietario). */
    @Transactional(readOnly = true)
    public List<VideoDTO> obtenerMisVideos(String emailUsuario) {
        List<Video> videos = videoRepository.findByPropietario_Email(emailUsuario);
        Map<Long, GrupoRef> grupoMap = buildGrupoMap(videos);
        return videos.stream().map(v -> toDTO(v, grupoMap)).toList();
    }

    /** Vídeos Compartidos: vídeos accesibles vía permisos de grupo, excluyendo los propios (contexto Espectador). */
    @Transactional(readOnly = true)
    public List<VideoDTO> obtenerVideosCompartidos(String emailUsuario) {
        List<Video> videos = videoRepository.findVideosCompartidosConUsuario(emailUsuario);
        Map<Long, GrupoRef> grupoMap = buildGrupoMap(videos);
        return videos.stream().map(v -> toDTO(v, grupoMap)).toList();
    }

    /** Par (idGrupo, nombre) asociado a un vídeo; usado internamente para construir el DTO. */
    private record GrupoRef(Long idGrupo, String nombre) {}

    /**
     * Mapea una entidad {@link Video} al DTO de respuesta usando el mapa pre-cargado de
     * videoId → GrupoRef para evitar el N+1. Ver {@link #buildGrupoMap(List)}.
     */
    private VideoDTO toDTO(Video video, Map<Long, GrupoRef> grupoMap) {
        GrupoRef ref = grupoMap.get(video.getIdVideo());
        return new VideoDTO(
                video.getIdVideo(),
                video.getTitulo(),
                video.getDuracion(),
                video.getFechaSubida(),
                ref != null ? ref.idGrupo() : null,
                ref != null ? ref.nombre()  : null,
                video.getMiniaturaUrl()
        );
    }

    /**
     * Construye en una única query el mapa videoId → GrupoRef para una lista de vídeos,
     * eliminando el N+1 que antes ejecutaba una query por vídeo en {@code toDTO}.
     * El JOIN FETCH en el repositorio carga los nombres de grupo en el mismo round-trip.
     */
    private Map<Long, GrupoRef> buildGrupoMap(List<Video> videos) {
        if (videos.isEmpty()) return Map.of();
        List<Long> ids = videos.stream().map(Video::getIdVideo).toList();
        return permisosGrupoRepository.findByVideoIds(ids).stream()
                .collect(Collectors.toMap(
                        pg -> pg.getId().getIdVideoId(),
                        pg -> new GrupoRef(pg.getId().getIdGrupoId(), pg.getGrupo().getNombre()),
                        (a, b) -> a   // si un vídeo está en varios grupos, toma el primero
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

        // Validar el grupo ANTES de borrar para evitar dejar el vídeo sin grupo si no existe
        Grupo grupo = null;
        if (idGrupo != null) {
            grupo = grupoRepository.getByIdOrThrow(idGrupo);
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
                video.getMiniaturaUrl()
        );
    }

    @Transactional
    public void eliminarVideo(Long idVideo, String userEmail) {
        Video video = videoRepository.getByIdOrThrow(idVideo);

        if (!video.getPropietario().getEmail().equals(userEmail)) {
            throw new AccessDeniedException("No tienes permiso para eliminar este vídeo");
        }

        String cloudinaryIdParaBorrar = video.getCloudinaryId();

        permisosGrupoRepository.deleteByVideoId(idVideo);
        videoVistaRepository.deleteByVideoId(idVideo);
        logService.eliminarLogsPorVideo(idVideo);
        videoRepository.delete(video);

        try {
            cloudinary.uploader().destroy(cloudinaryIdParaBorrar, ObjectUtils.emptyMap());
        } catch (Exception e) {
            log.warn("No se pudo borrar el asset de Cloudinary '{}': {}", cloudinaryIdParaBorrar, e.getMessage());
        }
    }
}
