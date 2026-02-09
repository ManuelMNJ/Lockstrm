package com.lockstrm.plataforma.servicios;

import com.cloudinary.Cloudinary;
import com.cloudinary.utils.ObjectUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class CloudinaryServicio {

    private final Cloudinary cloudinary;

    public String subirArchivo(MultipartFile file) throws IOException {
        Map resultadoSubida = cloudinary.uploader().upload(file.getBytes(),
                ObjectUtils.asMap("resource_type", "auto"));

        return (String) resultadoSubida.get("secure_url");
    }
}