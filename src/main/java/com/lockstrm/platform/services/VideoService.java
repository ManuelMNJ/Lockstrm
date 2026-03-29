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
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.InputStreamResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
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

    private static final Logger log = LoggerFactory.getLogger(VideoService.class);

    private final VideoRepository        videoRepository;
    private final UserRepository         userRepository;
    private final GrupoRepository        grupoRepository;
    private final PermisosGrupoRepository permisosGrupoRepository;
    private final Cloudinary             cloudinary;

    public Video subirVideo(MultipartFile file, String emailUsuario, String titulo, Long idGrupo) throws IOException {
        Usuario autor = userRepository.findByEmail(emailUsuario)
                .orElseThrow(() -> new RuntimeException("Usuario no encontrado: " + emailUsuario));

        Map<?, ?> uploadResult = cloudinary.uploader().upload(
                file.getBytes(), ObjectUtils.asMap("resource_type", "video"));

        String urlSegura = uploadResult.get("secure_url").toString();
        String publicId  = uploadResult.get("public_id").toString();

        // Cloudinary devuelve duration como Double; Number evita ClassCastException
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

        // Si el usuario seleccionó un grupo, crear el registro en permisos_grupo.
        if (idGrupo != null) {
            Grupo grupo = grupoRepository.findById(idGrupo)
                    .orElseThrow(() -> new RuntimeException("Grupo no encontrado: " + idGrupo));
            permisosGrupoRepository.save(new PermisosGrupo(guardado.getIdVideo(), grupo.getIdGrupo()));
        }

        return guardado;
    }

    /**
     * Proxy de streaming HTTP 206.
     *
     * Abre una conexion HttpURLConnection hacia la URL de Cloudinary del video,
     * reenvía el header Range si el cliente lo proporciona, y devuelve el
     * InputStream envuelto en InputStreamResource.
     *
     * Spring escribe ese stream al socket del cliente en chunks (~8 KB),
     * por lo que el video NUNCA se carga completo en RAM del servidor.
     */
    public ResponseEntity<InputStreamResource> streamVideo(Long id, String rangeHeader) throws Exception {
        Video video = videoRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Video no encontrado: " + id));

        HttpURLConnection con = (HttpURLConnection) new URL(video.getUrlCloudSecure()).openConnection();
        con.setRequestMethod("GET");

        // Reenviar el rango exacto que pide el navegador; Cloudinary lo honrará con 206.
        if (rangeHeader != null && !rangeHeader.isBlank()) {
            con.setRequestProperty("Range", rangeHeader);
        }

        con.connect();

        int cloudinaryStatus = con.getResponseCode();

        HttpHeaders headers = new HttpHeaders();

        String contentType = con.getHeaderField("Content-Type");
        if (contentType != null) {
            headers.set("Content-Type", contentType);
        }

        String contentLength = con.getHeaderField("Content-Length");
        if (contentLength != null) {
            headers.setContentLength(Long.parseLong(contentLength));
        }

        // Content-Range: bytes X-Y/Total — el navegador necesita este header para
        // saber cuánto ha recibido y habilitar el seek en la barra de progreso.
        String contentRange = con.getHeaderField("Content-Range");
        if (contentRange != null) {
            headers.set("Content-Range", contentRange);
        }

        // Accept-Ranges indica al navegador que puede hacer range requests.
        headers.set("Accept-Ranges", "bytes");

        HttpStatus status = (cloudinaryStatus == 206) ? HttpStatus.PARTIAL_CONTENT : HttpStatus.OK;

        return ResponseEntity
                .status(status)
                .headers(headers)
                .body(new InputStreamResource(con.getInputStream()));
    }

    // Rellena la duracion de registros historicos consultando la Admin API de Cloudinary.
    // Ejecutar una unica vez tras desplegar el fix de extraccion de duracion.
    public int backfillDuraciones() throws Exception {
        List<Video> sinDuracion = videoRepository.findByDuracionIsNullOrDuracionEquals(0);
        int actualizados = 0;

        for (Video video : sinDuracion) {
            if (video.getCloudinaryId() == null || video.getCloudinaryId().isBlank()) continue;

            try {
                Map<String, Object> info = cloudinary.api().resource(
                        video.getCloudinaryId(),
                        ObjectUtils.asMap("resource_type", "video")
                );
                Object rawDuration = info.get("duration");
                if (rawDuration instanceof Number) {
                    video.setDuracion(((Number) rawDuration).intValue());
                    videoRepository.save(video);
                    actualizados++;
                }
            } catch (Exception e) {
                log.warn("Backfill: no se pudo recuperar duracion de '{}': {}", video.getCloudinaryId(), e.getMessage());
            }
        }
        return actualizados;
    }

    public List<Video> obtenerPorEmailUsuario(String emailUsuario) {
        Usuario usuario = userRepository.findByEmail(emailUsuario)
                .orElseThrow(() -> new RuntimeException("Usuario no encontrado: " + emailUsuario));
        return videoRepository.findByPropietario_IdUsuario(usuario.getIdUsuario());
    }
}
