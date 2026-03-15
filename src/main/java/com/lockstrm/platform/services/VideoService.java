package com.lockstrm.platform.services;

import com.cloudinary.Cloudinary;
import com.cloudinary.utils.ObjectUtils;
import com.lockstrm.platform.entities.Usuario;
import com.lockstrm.platform.entities.Video;
import com.lockstrm.platform.repositories.UserRepository;
import com.lockstrm.platform.repositories.VideoRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class VideoService {

    private final VideoRepository videoRepository;
    private final UserRepository userRepository;
    private final Cloudinary cloudinary;

    // 1. UPLOAD VIDEO TO CLOUDINARY AND PERSIST IN MYSQL
    public Video subirVideo(MultipartFile file, Long idUsuario, String titulo, Integer duracion) throws IOException {

        // A. Verify the user exists
        Usuario autor = userRepository.findById(idUsuario)
                .orElseThrow(() -> new RuntimeException("User not found with ID: " + idUsuario));

        // B. Upload the file to Cloudinary
        Map<?, ?> uploadResult = cloudinary.uploader().upload(file.getBytes(),
                ObjectUtils.asMap("resource_type", "video"));

        // C. Extract the data returned by Cloudinary
        String urlSegura = uploadResult.get("secure_url").toString();
        String publicId = uploadResult.get("public_id").toString();

        // D. Persist in the database
        Video nuevoVideo = new Video();
        nuevoVideo.setTitulo(titulo);
        nuevoVideo.setDuracion(duracion);
        nuevoVideo.setUrlCloudSecure(urlSegura);
        nuevoVideo.setCloudinaryId(publicId);
        nuevoVideo.setFechaSubida(LocalDateTime.now());
        nuevoVideo.setPropietario(autor);

        return videoRepository.save(nuevoVideo);
    }

    // 2. RETRIEVE ALL VIDEOS
    public List<Video> obtenerTodos() {
        return videoRepository.findAll();
    }
}
