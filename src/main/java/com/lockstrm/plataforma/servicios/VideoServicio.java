package com.lockstrm.plataforma.servicios;

import com.lockstrm.plataforma.model.Usuario;
import com.lockstrm.plataforma.model.Video;
import com.lockstrm.plataforma.repositorios.UsuarioRepositorio;
import com.lockstrm.plataforma.repositorios.VideoRepositorio;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List; // <--- EL IMPORT QUE FALTABA

@Service
@RequiredArgsConstructor
public class VideoServicio {

    private final VideoRepositorio videoRepositorio;
    private final UsuarioRepositorio usuarioRepositorio;
    private final CloudinaryServicio cloudinaryServicio;

    @Transactional
    public Video subirVideo(MultipartFile archivo, Long idUsuario, String titulo, Integer duracion) throws IOException {
        Usuario propietario = usuarioRepositorio.findById(idUsuario)
                .orElseThrow(() -> new RuntimeException("Usuario no encontrado con ID: " + idUsuario));

        String urlVideo = cloudinaryServicio.subirArchivo(archivo);

        Video nuevoVideo = new Video();
        nuevoVideo.setTitulo(titulo);
        nuevoVideo.setDuracionSegundos(duracion);
        nuevoVideo.setUrlCloudSecure(urlVideo);
        nuevoVideo.setPropietario(propietario);

        return videoRepositorio.save(nuevoVideo);
    }

    /**
     * Devuelve la lista completa de vídeos.
     */
    public List<Video> obtenerTodos() {
        return videoRepositorio.findAll();
    }
}