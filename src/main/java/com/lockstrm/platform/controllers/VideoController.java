package com.lockstrm.platform.controllers;

import com.lockstrm.platform.dto.EditarVideoRequest;
import com.lockstrm.platform.dto.HeartbeatRequest;
import com.lockstrm.platform.dto.VideoDTO;
import com.lockstrm.platform.dto.VideoVistaEstadisticaDto;
import com.lockstrm.platform.entities.Video;
import com.lockstrm.platform.services.LogService;
import com.lockstrm.platform.services.VideoService;
import com.lockstrm.platform.services.VideoVistaService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
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

@Slf4j
@RestController
@RequestMapping("/api/videos")
@RequiredArgsConstructor
public class VideoController {

    private final VideoService videoService;
    private final LogService   logService;
    private final VideoVistaService videoVistaService;

    @PostMapping("/subir")
    public ResponseEntity<Map<String, Object>> subirVideo(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestParam("file") MultipartFile file,
            @RequestParam("titulo") String titulo,
            @RequestParam(value = "idGrupo", required = false) Long idGrupo,
            @RequestParam(value = "miniaturaUrl", required = false) String miniaturaUrl
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
            Video guardado = videoService.subirVideo(file, userDetails.getUsername(), titulo, idGrupo, miniaturaUrl);
            respuesta.put("status",       "exito");
            respuesta.put("mensaje",      "Video subido correctamente");
            respuesta.put("id_video",     guardado.getIdVideo());
            respuesta.put("titulo",       guardado.getTitulo());
            respuesta.put("url",          guardado.getUrlCloudSecure());
            respuesta.put("duracion",     guardado.getDuracion());
            respuesta.put("miniaturaUrl", guardado.getMiniaturaUrl());
            return new ResponseEntity<>(respuesta, HttpStatus.CREATED);
        } catch (IOException e) {
            log.error("Error de I/O al subir vídeo para usuario {}: {}", userDetails.getUsername(), e.getMessage(), e);
            respuesta.put("status",  "error");
            respuesta.put("mensaje", "Error al leer el archivo: " + e.getMessage());
            return new ResponseEntity<>(respuesta, HttpStatus.INTERNAL_SERVER_ERROR);
        } catch (Exception e) {
            log.error("Error al subir vídeo para usuario {}: {}", userDetails.getUsername(), e.getMessage(), e);
            respuesta.put("status",  "error");
            respuesta.put("mensaje", e.getMessage() != null ? e.getMessage() : "Error interno al subir el vídeo");
            return new ResponseEntity<>(respuesta, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    /** Lista todos los vídeos del usuario (propios). Mantiene compatibilidad con clientes existentes. */
    @GetMapping
    public ResponseEntity<List<VideoDTO>> listarVideos(@AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(videoService.obtenerMisVideos(userDetails.getUsername()));
    }

    /** Mis Vídeos: vídeos subidos por el usuario autenticado (contexto Propietario). */
    @GetMapping("/mios")
    public ResponseEntity<List<VideoDTO>> listarMisVideos(@AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(videoService.obtenerMisVideos(userDetails.getUsername()));
    }

    /** Vídeos Compartidos: vídeos accesibles vía permisos de grupo (contexto Espectador). */
    @GetMapping("/compartidos")
    public ResponseEntity<List<VideoDTO>> listarVideosCompartidos(@AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(videoService.obtenerVideosCompartidos(userDetails.getUsername()));
    }

    /**
     * El manejo de AccessDeniedException → 403 y RuntimeException("no encontrado") → 404
     * lo centraliza GlobalExceptionHandler. Aquí solo capturamos Exception genérico
     * para las IOExceptions del proxy HTTP (errores de red hacia Cloudinary),
     * que no son RuntimeException y no llegan al handler global.
     */
    @GetMapping("/stream/{id}")
    public ResponseEntity<InputStreamResource> streamVideo(
            @PathVariable Long id,
            @RequestHeader(value = "Range", required = false) String rangeHeader,
            @AuthenticationPrincipal UserDetails userDetails
    ) throws Exception {
        return videoService.streamVideo(id, rangeHeader, userDetails.getUsername());
    }

    @PostMapping("/{idVideo}/heartbeat")
    public ResponseEntity<Void> heartbeat(
            @PathVariable Long idVideo,
            @Valid @RequestBody HeartbeatRequest request,
            @AuthenticationPrincipal UserDetails userDetails
    ) {
        logService.registrarHeartbeat(idVideo, userDetails.getUsername(), request.currentTime());
        return ResponseEntity.ok().build();
    }

    @PatchMapping("/{idVideo}")
    public ResponseEntity<VideoDTO> editarVideo(
            @PathVariable Long idVideo,
            @AuthenticationPrincipal UserDetails userDetails,
            @Valid @RequestBody EditarVideoRequest req) {
        VideoDTO dto = videoService.editarVideo(idVideo, userDetails.getUsername(),
                req.titulo().trim(), req.idGrupo());
        return ResponseEntity.ok(dto);
    }

    @PostMapping("/{id}/ver")
    public ResponseEntity<Void> registrarVista(
            @PathVariable Long id,
            @AuthenticationPrincipal UserDetails userDetails) {
        try {
            videoVistaService.incrementarVista(id, userDetails.getUsername());
            return ResponseEntity.ok().build();
        } catch (RuntimeException e) {
            String msg = e.getMessage() != null ? e.getMessage() : "";
            HttpStatus status = msg.contains("no encontrado") ? HttpStatus.NOT_FOUND : HttpStatus.INTERNAL_SERVER_ERROR;
            return ResponseEntity.status(status).build();
        }
    }

    @GetMapping("/{id}/estadisticas")
    public ResponseEntity<?> obtenerEstadisticas(
            @PathVariable Long id,
            @AuthenticationPrincipal UserDetails userDetails) {
        try {
            List<VideoVistaEstadisticaDto> stats = videoVistaService.obtenerEstadisticas(id, userDetails.getUsername());
            return ResponseEntity.ok(stats);
        } catch (AccessDeniedException e) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", e.getMessage()));
        } catch (RuntimeException e) {
            String msg = e.getMessage() != null ? e.getMessage() : "";
            HttpStatus status = msg.contains("no encontrado") ? HttpStatus.NOT_FOUND : HttpStatus.INTERNAL_SERVER_ERROR;
            return ResponseEntity.status(status).body(Map.of("error", msg));
        }
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
