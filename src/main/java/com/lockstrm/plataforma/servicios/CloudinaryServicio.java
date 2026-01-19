package com.lockstrm.plataforma.servicios;

import com.cloudinary.Cloudinary;
import com.cloudinary.utils.ObjectUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.Map;

/**
 * Servicio encargado de la comunicación directa con la API de Cloudinary.
 */
@Service
@RequiredArgsConstructor
public class CloudinaryServicio {

    private final Cloudinary cloudinary;

    /**
     * Sube un archivo a Cloudinary.
     * * @param file El archivo recibido desde el formulario o API.
     * @return La URL pública segura (https) donde se alojó el archivo.
     * @throws IOException Si ocurre un error de lectura o conexión durante la subida.
     */
    public String subirArchivo(MultipartFile file) throws IOException {
        // Subimos el archivo y pedimos que detecte automáticamente el tipo de recurso (video/imagen)
        Map resultadoSubida = cloudinary.uploader().upload(file.getBytes(),
                ObjectUtils.asMap("resource_type", "auto"));

        // Extraemos la URL segura (https) del mapa de respuesta
        return (String) resultadoSubida.get("secure_url");
    }
}