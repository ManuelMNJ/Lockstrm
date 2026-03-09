package com.lockstrm.plataforma.servicios;

import com.cloudinary.Cloudinary;
import com.cloudinary.utils.ObjectUtils;
import com.lockstrm.plataforma.model.Usuario;
import com.lockstrm.plataforma.model.Video;
import com.lockstrm.plataforma.repositorios.UsuarioRepositorio;
import com.lockstrm.plataforma.repositorios.VideoRepositorio;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class VideoServicio {

    private final VideoRepositorio videoRepositorio;
    private final UsuarioRepositorio usuarioRepositorio;
    private final Cloudinary cloudinary;

    // 1. SUBIR VIDEO A CLOUDINARY Y GUARDAR EN MYSQL
    public Video subirVideo(MultipartFile file, Long idUsuario, String titulo, Integer duracion) throws IOException {

        // A. Verificamos que el usuario existe
        Usuario autor = usuarioRepositorio.findById(idUsuario)
                .orElseThrow(() -> new RuntimeException("Usuario no encontrado con ID: " + idUsuario));

        // B. Subimos el archivo a Cloudinary
        // IMPORTANTE: Le decimos a Cloudinary que es un video (resource_type = video)
        Map<?, ?> uploadResult = cloudinary.uploader().upload(file.getBytes(),
                ObjectUtils.asMap("resource_type", "video"));

        // C. Extraemos los datos que nos devuelve Cloudinary
        String urlSegura = uploadResult.get("secure_url").toString();
        String publicId = uploadResult.get("public_id").toString(); // Util para borrarlo en el futuro

        // D. Guardamos en nuestra base de datos
        Video nuevoVideo = new Video();
        nuevoVideo.setTitulo(titulo);
        nuevoVideo.setDuracion(duracion);
        nuevoVideo.setUrlCloudSecure(urlSegura);
        nuevoVideo.setCloudinaryId(publicId);
        nuevoVideo.setFechaSubida(LocalDateTime.now());
        nuevoVideo.setPropietario(autor); // Asignamos el autor

        return videoRepositorio.save(nuevoVideo);
    }

    // 2. OBTENER TODOS LOS VIDEOS
    public List<Video> obtenerTodos() {
        return videoRepositorio.findAll();
    }
}