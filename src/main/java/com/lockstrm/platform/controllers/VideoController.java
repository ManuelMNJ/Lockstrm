package com.lockstrm.platform.controllers;

import com.lockstrm.platform.entities.Video;
import com.lockstrm.platform.services.VideoService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/videos")
@CrossOrigin(origins = "http://localhost:4200")
@RequiredArgsConstructor
public class VideoController {

    private final VideoService videoService;

    @PostMapping("/subir")
    public ResponseEntity<Map<String, Object>> subirVideo(
            // @AuthenticationPrincipal nos da el usuario ya autenticado por Spring Security
            // sin tener que parsear el JWT a mano otra vez en el controlador.
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestParam("file") MultipartFile file,
            @RequestParam("titulo") String titulo
    ) {
        Map<String, Object> respuesta = new HashMap<>();
        try {
            Video guardado = videoService.subirVideo(file, userDetails.getUsername(), titulo);
            respuesta.put("status",   "exito");
            respuesta.put("mensaje",  "Video subido correctamente");
            respuesta.put("id_video", guardado.getIdVideo());
            respuesta.put("titulo",   guardado.getTitulo());
            respuesta.put("url",      guardado.getUrlCloudSecure());
            respuesta.put("duracion", guardado.getDuracion());
            return new ResponseEntity<>(respuesta, HttpStatus.CREATED);
        } catch (IOException e) {
            // IOException la separamos porque cubre errores de lectura del archivo antes
            // incluso de llegar a Cloudinary (disco lleno, stream cortado, etc.).
            respuesta.put("status",  "error");
            respuesta.put("mensaje", "Error al subir el archivo");
            return new ResponseEntity<>(respuesta, HttpStatus.INTERNAL_SERVER_ERROR);
        } catch (Exception e) {
            respuesta.put("status",  "error");
            respuesta.put("mensaje", "Error interno: " + e.getMessage());
            return new ResponseEntity<>(respuesta, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @GetMapping
    public ResponseEntity<List<Video>> listarVideos(@AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(videoService.obtenerPorEmailUsuario(userDetails.getUsername()));
    }

    // Migracion puntual: rellena la duracion de videos subidos antes de que el backend extrajera
    // este dato de Cloudinary. Ejecutar una unica vez y luego retirar el endpoint.
    @PostMapping("/admin/backfill-duraciones")
    public ResponseEntity<Map<String, Object>> backfillDuraciones() {
        Map<String, Object> respuesta = new HashMap<>();
        try {
            int actualizados = videoService.backfillDuraciones();
            respuesta.put("status",       "ok");
            respuesta.put("actualizados", actualizados);
            return ResponseEntity.ok(respuesta);
        } catch (Exception e) {
            respuesta.put("status",  "error");
            respuesta.put("mensaje", e.getMessage());
            return ResponseEntity.internalServerError().body(respuesta);
        }
    }
}
