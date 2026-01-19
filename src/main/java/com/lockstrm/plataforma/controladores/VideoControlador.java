package com.lockstrm.plataforma.controladores;

import com.lockstrm.plataforma.model.Video;
import com.lockstrm.plataforma.servicios.VideoServicio;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.HashMap;
import java.util.List; // <--- IMPORTANTE
import java.util.Map;

@RestController
@RequestMapping("/api/videos")
@RequiredArgsConstructor
public class VideoControlador {

    private final VideoServicio videoServicio;

    // ENDPOINT 1: SUBIR VÍDEO
    @PostMapping("/subir")
    public ResponseEntity<Map<String, Object>> subirVideo(
            @RequestParam("file") MultipartFile file,
            @RequestParam("idUsuario") Long idUsuario,
            @RequestParam("titulo") String titulo,
            @RequestParam("duracion") Integer duracion
    ) {
        Map<String, Object> respuesta = new HashMap<>();

        try {
            Video videoGuardado = videoServicio.subirVideo(file, idUsuario, titulo, duracion);
            
            respuesta.put("status", "exito");
            respuesta.put("mensaje", "Video subido correctamente");
            respuesta.put("id_video", videoGuardado.getIdVideo());
            respuesta.put("titulo", videoGuardado.getTitulo());
            respuesta.put("url", videoGuardado.getUrlCloudSecure());
            
            return new ResponseEntity<>(respuesta, HttpStatus.CREATED);

        } catch (IOException e) {
            respuesta.put("status", "error");
            respuesta.put("mensaje", "Error al subir el archivo");
            return new ResponseEntity<>(respuesta, HttpStatus.INTERNAL_SERVER_ERROR);
        } catch (Exception e) {
            respuesta.put("status", "error");
            respuesta.put("mensaje", "Error interno: " + e.getMessage());
            return new ResponseEntity<>(respuesta, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    // ENDPOINT 2: VER TODOS (NUEVO)
    @GetMapping
    public ResponseEntity<List<Video>> listarVideos() {
        List<Video> videos = videoServicio.obtenerTodos();
        return new ResponseEntity<>(videos, HttpStatus.OK);
    }
}