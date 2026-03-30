package com.lockstrm.platform.services;

import com.cloudinary.Cloudinary;
import com.cloudinary.utils.ObjectUtils;
import com.lockstrm.platform.entities.Grupo;
import com.lockstrm.platform.entities.PermisosGrupo;
import com.lockstrm.platform.entities.Usuario;
import com.lockstrm.platform.entities.Video;
import com.lockstrm.platform.repositories.GrupoRepository;
import com.lockstrm.platform.repositories.MiembrosGrupoRepository;
import com.lockstrm.platform.repositories.PermisosGrupoRepository;
import com.lockstrm.platform.repositories.UserRepository;
import com.lockstrm.platform.repositories.VideoRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.InputStreamResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import org.springframework.security.access.AccessDeniedException;

import java.io.IOException;
import java.net.HttpURLConnection;
import java.net.URL;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class VideoService {

    private final VideoRepository          videoRepository;
    private final UserRepository           userRepository;
    private final GrupoRepository          grupoRepository;
    private final PermisosGrupoRepository  permisosGrupoRepository;
    private final MiembrosGrupoRepository  miembrosGrupoRepository;
    private final Cloudinary               cloudinary;

    @Transactional
    public Video subirVideo(MultipartFile file, String emailUsuario, String titulo, Long idGrupo) throws IOException {
        Usuario autor = userRepository.findByEmail(emailUsuario)
                .orElseThrow(() -> new RuntimeException("Usuario no encontrado: " + emailUsuario));

        Map<?, ?> uploadResult = cloudinary.uploader().upload(
                file.getBytes(), ObjectUtils.asMap("resource_type", "video"));

        String urlSegura = uploadResult.get("secure_url").toString();
        String publicId  = uploadResult.get("public_id").toString();

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
     *
     * Verifica que el usuario autenticado sea el propietario del video antes de
     * abrir la conexión con Cloudinary. Spring escribe el stream al cliente en
     * chunks (~8 KB), por lo que el video nunca se carga completo en RAM.
     */
    public ResponseEntity<InputStreamResource> streamVideo(Long id, String rangeHeader, String emailUsuario) throws Exception {
        Video video = videoRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Video no encontrado: " + id));

        boolean esPropietario = video.getPropietario().getEmail().equals(emailUsuario);

        if (!esPropietario) {
            Optional<PermisosGrupo> permiso = permisosGrupoRepository.findById_IdVideoId(id);
            boolean esMiembro = permiso
                    .map(p -> miembrosGrupoRepository
                            .existsByUsuario_EmailAndId_IdGrupoId(emailUsuario, p.getId().getIdGrupoId()))
                    .orElse(false);

            if (!esMiembro) {
                throw new AccessDeniedException("Acceso denegado al video");
            }
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
        if (contentType != null) {
            headers.set("Content-Type", contentType);
        }

        String contentLength = con.getHeaderField("Content-Length");
        if (contentLength != null) {
            headers.setContentLength(Long.parseLong(contentLength));
        }

        String contentRange = con.getHeaderField("Content-Range");
        if (contentRange != null) {
            headers.set("Content-Range", contentRange);
        }

        headers.set("Accept-Ranges", "bytes");

        HttpStatus status = (cloudinaryStatus == 206) ? HttpStatus.PARTIAL_CONTENT : HttpStatus.OK;

        return ResponseEntity
                .status(status)
                .headers(headers)
                .body(new InputStreamResource(con.getInputStream()));
    }

    public List<Video> obtenerPorEmailUsuario(String emailUsuario) {
        Usuario usuario = userRepository.findByEmail(emailUsuario)
                .orElseThrow(() -> new RuntimeException("Usuario no encontrado: " + emailUsuario));
        return videoRepository.findByPropietario_IdUsuario(usuario.getIdUsuario());
    }
}
