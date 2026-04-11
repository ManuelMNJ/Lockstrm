package com.lockstrm.platform.controllers;

import com.lockstrm.platform.dto.HeartbeatRequest;
import com.lockstrm.platform.entities.Video;
import com.lockstrm.platform.services.LogService;
import com.lockstrm.platform.services.VideoService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.InputStreamResource;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
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
@RequiredArgsConstructor
public class VideoController {

    private final VideoService videoService;
    private final LogService   logService;

    @PostMapping("/subir")
    public ResponseEntity<Map<String, Object>> subirVideo(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestParam("file") MultipartFile file,
            @RequestParam("titulo") String titulo,
            @RequestParam(value = "idGrupo", required = false) Long idGrupo
    ) {
        String contentType = file.getContentType();
        if (contentType == null || !contentType.startsWith("video/")) {
            return ResponseEntity.badRequest().body(Map.of(
                    "status", "error",
                    "mensaje", "El archivo debe ser un video"
            ));
        }

        Map<String, Object> respuesta = new HashMap<>();
        try {
            Video guardado = videoService.subirVideo(file, userDetails.getUsername(), titulo, idGrupo);
            respuesta.put("status",   "exito");
            respuesta.put("mensaje",  "Video subido correctamente");
            respuesta.put("id_video", guardado.getIdVideo());
            respuesta.put("titulo",   guardado.getTitulo());
            respuesta.put("url",      guardado.getUrlCloudSecure());
            respuesta.put("duracion", guardado.getDuracion());
            return new ResponseEntity<>(respuesta, HttpStatus.CREATED);
        } catch (IOException e) {
            respuesta.put("status",  "error");
            respuesta.put("mensaje", "Error al leer el archivo: " + e.getMessage());
            e.printStackTrace();
            return new ResponseEntity<>(respuesta, HttpStatus.INTERNAL_SERVER_ERROR);
        } catch (Exception e) {
            respuesta.put("status",  "error");
            respuesta.put("mensaje", e.getMessage() != null ? e.getMessage() : "Error interno al subir el vídeo");
            e.printStackTrace();
            return new ResponseEntity<>(respuesta, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    /** Lista todos los vídeos del usuario (propios). Mantiene compatibilidad con clientes existentes. */
    @GetMapping
    public ResponseEntity<List<Video>> listarVideos(@AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(videoService.obtenerMisVideos(userDetails.getUsername()));
    }

    /** Mis Vídeos: vídeos subidos por el usuario autenticado (contexto Propietario). */
    @GetMapping("/mios")
    public ResponseEntity<List<Video>> listarMisVideos(@AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(videoService.obtenerMisVideos(userDetails.getUsername()));
    }

    /** Vídeos Compartidos: vídeos accesibles vía permisos de grupo (contexto Espectador). */
    @GetMapping("/compartidos")
    public ResponseEntity<List<Video>> listarVideosCompartidos(@AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(videoService.obtenerVideosCompartidos(userDetails.getUsername()));
    }

    @GetMapping("/stream/{id}")
    public ResponseEntity<InputStreamResource> streamVideo(
            @PathVariable Long id,
            @RequestHeader(value = "Range", required = false) String rangeHeader,
            @AuthenticationPrincipal UserDetails userDetails
    ) {
        try {
            return videoService.streamVideo(id, rangeHeader, userDetails.getUsername());
        } catch (AccessDeniedException e) {
            // C-1: acceso denegado debe devolver 403, no 500
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        } catch (RuntimeException e) {
            String msg = e.getMessage() != null ? e.getMessage().toLowerCase() : "";
            if (msg.contains("no encontrado")) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
            }
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    /**
     * Recibe el pulso de telemetría del reproductor cada 30 segundos.
     * Actualiza el campo segundosVistos del registro de log del día actual,
     * o crea un nuevo registro si es la primera sesión del día.
     *
     * @AuthenticationPrincipal inyecta el UserDetails cuyo username es el email
     * (establecido por JwtAuthenticationFilter al validar el token Bearer).
     */
    @PostMapping("/{idVideo}/heartbeat")
    public ResponseEntity<Void> heartbeat(
            @PathVariable Long idVideo,
            @Valid @RequestBody HeartbeatRequest request,
            @AuthenticationPrincipal UserDetails userDetails
    ) {
        logService.registrarHeartbeat(idVideo, userDetails.getUsername(), request.currentTime());
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/{idVideo}")
    public ResponseEntity<?> eliminarVideo(
            @PathVariable Long idVideo,
            @AuthenticationPrincipal UserDetails userDetails) {
        try {
            videoService.eliminarVideo(idVideo, userDetails.getUsername());
            return ResponseEntity.ok(Map.of("mensaje", "Vídeo eliminado correctamente"));
        } catch (AccessDeniedException e) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage() != null ? e.getMessage() : "Error al eliminar el vídeo"));
        }
    }
}
