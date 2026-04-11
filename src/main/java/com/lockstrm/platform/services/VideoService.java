package com.lockstrm.platform.services;

import com.cloudinary.Cloudinary;
import com.cloudinary.utils.ObjectUtils;
import com.lockstrm.platform.entities.Grupo;
import com.lockstrm.platform.entities.PermisosGrupo;
import com.lockstrm.platform.entities.Usuario;
import com.lockstrm.platform.entities.Video;
import com.lockstrm.platform.repositories.GrupoRepository;
import com.lockstrm.platform.repositories.PermisosGrupoRepository;
import com.lockstrm.platform.repositories.UserRepository;
import com.lockstrm.platform.repositories.VideoRepository;
import lombok.RequiredArgsConstructor;
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
    public Video subirVideo(MultipartFile file, String emailUsuario, String titulo, Long idGrupo) throws IOException {
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

        if (idGrupo != null) {
            Grupo grupo = grupoRepository.findById(idGrupo)
                    .orElseThrow(() -> new RuntimeException("Grupo no encontrado: " + idGrupo));
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

    public List<Video> obtenerPorEmailUsuario(String emailUsuario) {
        return videoRepository.findByPropietario_Email(emailUsuario);
    }

    /** Mis Vídeos: vídeos subidos por el usuario autenticado (contexto Propietario). */
    public List<Video> obtenerMisVideos(String emailUsuario) {
        return videoRepository.findByPropietario_Email(emailUsuario);
    }

    /** Vídeos Compartidos: vídeos accesibles vía permisos de grupo, excluyendo los propios (contexto Espectador). */
    public List<Video> obtenerVideosCompartidos(String emailUsuario) {
        return videoRepository.findVideosCompartidosConUsuario(emailUsuario);
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
            System.err.println("[WARN] No se pudo borrar el asset de Cloudinary '"
                    + cloudinaryIdParaBorrar + "': " + e.getMessage());
        }
    }
}
