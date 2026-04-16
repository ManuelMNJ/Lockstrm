package com.lockstrm.platform.services;

import com.cloudinary.Cloudinary;
import com.cloudinary.utils.ObjectUtils;
import com.lockstrm.platform.dto.VideoDTO;
import com.lockstrm.platform.entities.Grupo;
import com.lockstrm.platform.entities.PermisosGrupo;
import com.lockstrm.platform.entities.Usuario;
import com.lockstrm.platform.entities.Video;
import com.lockstrm.platform.repositories.GrupoRepository;
import com.lockstrm.platform.repositories.PermisosGrupoRepository;
import com.lockstrm.platform.repositories.UserRepository;
import com.lockstrm.platform.repositories.VideoRepository;
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

import java.io.IOException;
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
    private final PermisosGrupoRepository permisosGrupoRepository;
    private final LogService              logService;
    private final Cloudinary              cloudinary;

    private static final long MAX_FILE_SIZE = 100L * 1024 * 1024; // 100 MB

    @Transactional
    public VideoDTO subirVideo(MultipartFile file, String emailUsuario, String titulo, Long idGrupo) throws IOException {
        if (file.getSize() > MAX_FILE_SIZE) {
            throw new IllegalArgumentException("El archivo excede el tamaño máximo permitido (100 MB)");
        }

        Usuario autor = userRepository.findByEmail(emailUsuario)
                .orElseThrow(() -> new RuntimeException("Usuario no encontrado: " + emailUsuario));

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
        nuevoVideo.setFechaSubida(LocalDateTime.now());
        nuevoVideo.setPropietario(autor);

        Video guardado = videoRepository.save(nuevoVideo);

        String grupoNombre = null;
        if (idGrupo != null) {
            Grupo grupo = grupoRepository.findById(idGrupo)
                    .orElseThrow(() -> new RuntimeException("Grupo no encontrado: " + idGrupo));
            permisosGrupoRepository.save(new PermisosGrupo(guardado.getIdVideo(), grupo.getIdGrupo()));
            grupoNombre = grupo.getNombre();
        }

        return new VideoDTO(
                guardado.getIdVideo(),
                guardado.getTitulo(),
                guardado.getDuracion(),
                guardado.getFechaSubida(),
                idGrupo,
                grupoNombre
        );
    }

    /**
     * Proxy de streaming HTTP 206.
     * La verificación de acceso y el registro de auditoría se delegan a LogService
     * para que la misma lógica sea compartida con el endpoint de heartbeat.
     */
    public ResponseEntity<InputStreamResource> streamVideo(Long id, String rangeHeader, String emailUsuario) throws Exception {
        Video video = videoRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Video no encontrado: " + id));

        logService.verificarAcceso(video, emailUsuario);

        // Registra el acceso solo en la primera petición (sin Range o bytes=0-)
        if (rangeHeader == null || rangeHeader.startsWith("bytes=0-")) {
            logService.registrarAcceso(video, emailUsuario);
        }

        HttpURLConnection con = (HttpURLConnection) new URL(video.getUrlCloudSecure()).openConnection();
        con.setRequestMethod("GET");
        con.setConnectTimeout(10_000);
        con.setReadTimeout(30_000);

        if (rangeHeader != null && !rangeHeader.isBlank()) {
            con.setRequestProperty("Range", rangeHeader);
        }

        con.connect();

        int cloudinaryStatus = con.getResponseCode();

        HttpHeaders headers = new HttpHeaders();

        String contentType = con.getHeaderField("Content-Type");
        if (contentType != null) headers.set("Content-Type", contentType);

        String contentLength = con.getHeaderField("Content-Length");
        if (contentLength != null) headers.setContentLength(Long.parseLong(contentLength));

        String contentRange = con.getHeaderField("Content-Range");
        if (contentRange != null) headers.set("Content-Range", contentRange);

        headers.set("Accept-Ranges", "bytes");

        HttpStatus status = (cloudinaryStatus == 206) ? HttpStatus.PARTIAL_CONTENT : HttpStatus.OK;

        return ResponseEntity.status(status).headers(headers)
                .body(new InputStreamResource(con.getInputStream()));
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
                ref != null ? ref.nombre()  : null
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
        Video video = videoRepository.findById(idVideo)
                .orElseThrow(() -> new RuntimeException("Vídeo no encontrado: " + idVideo));

        if (!video.getPropietario().getEmail().equals(emailUsuario)) {
            throw new AccessDeniedException("No tienes permiso para editar este vídeo");
        }

        video.setTitulo(titulo);
        videoRepository.save(video);

        // Reasignar grupo: eliminar la asociación actual y crear la nueva si procede
        permisosGrupoRepository.deleteByVideoId(idVideo);

        String grupoNombre = null;
        if (idGrupo != null) {
            Grupo grupo = grupoRepository.findById(idGrupo)
                    .orElseThrow(() -> new RuntimeException("Grupo no encontrado: " + idGrupo));
            permisosGrupoRepository.save(new PermisosGrupo(idVideo, grupo.getIdGrupo()));
            grupoNombre = grupo.getNombre();
        }

        return new VideoDTO(
                video.getIdVideo(),
                video.getTitulo(),
                video.getDuracion(),
                video.getFechaSubida(),
                idGrupo,
                grupoNombre
        );
    }

    @Transactional
    public void eliminarVideo(Long idVideo, String userEmail) {
        Video video = videoRepository.findById(idVideo)
                .orElseThrow(() -> new RuntimeException("Vídeo no encontrado: " + idVideo));

        if (!video.getPropietario().getEmail().equals(userEmail)) {
            throw new AccessDeniedException("No tienes permiso para eliminar este vídeo");
        }

        String cloudinaryIdParaBorrar = video.getCloudinaryId();

        permisosGrupoRepository.deleteByVideoId(idVideo);
        logService.eliminarLogsPorVideo(idVideo);
        videoRepository.delete(video);

        try {
            cloudinary.uploader().destroy(cloudinaryIdParaBorrar, ObjectUtils.emptyMap());
        } catch (Exception e) {
            log.warn("No se pudo borrar el asset de Cloudinary '{}': {}", cloudinaryIdParaBorrar, e.getMessage());
        }
    }
}
