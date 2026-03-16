package com.lockstrm.platform.services;

import com.cloudinary.Cloudinary;
import com.cloudinary.utils.ObjectUtils;
import com.lockstrm.platform.entities.Usuario;
import com.lockstrm.platform.entities.Video;
import com.lockstrm.platform.repositories.UserRepository;
import com.lockstrm.platform.repositories.VideoRepository;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class VideoService {

    private static final Logger log = LoggerFactory.getLogger(VideoService.class);

    private final VideoRepository videoRepository;
    private final UserRepository  userRepository;
    private final Cloudinary      cloudinary;

    public Video subirVideo(MultipartFile file, String emailUsuario, String titulo) throws IOException {
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

        return videoRepository.save(nuevoVideo);
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
