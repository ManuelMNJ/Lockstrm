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
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.core.io.support.ResourceRegion;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.MediaTypeFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;

@Slf4j
@RestController
@RequestMapping("/api/videos")
@RequiredArgsConstructor
public class VideoController {

    private final VideoService      videoService;
    private final LogService        logService;
    private final VideoVistaService videoVistaService;

    @Value("${lockstrm.upload.thumbnails.dir}")
    private String thumbnailsDir;

    @PostMapping("/subir")
    public ResponseEntity<Map<String, Object>> subirVideo(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestParam("file") MultipartFile file,
            @RequestParam("titulo") String titulo,
            // Multi-valor: el cliente envía `idGrupos=1&idGrupos=2` (FormData
            // soporta valores repetidos para la misma clave). Spring lo bindea
            // a List<Long>. `idGrupo` (singular) se mantendría sin efecto.
            @RequestParam(value = "idGrupos",  required = false) List<Long>   idGrupos,
            @RequestParam(value = "miniatura", required = false) MultipartFile miniatura,
            @RequestParam(value = "duracion",  required = false) Integer       duracion
    ) throws Exception {
        Video guardado = videoService.subirVideo(
                file, userDetails.getUsername(), titulo, idGrupos, miniatura, duracion);
        // Map.of() no acepta valores null → usamos un Map mutable para el campo opcional.
        java.util.Map<String, Object> respuesta = new java.util.LinkedHashMap<>();
        respuesta.put("status",       "exito");
        respuesta.put("mensaje",      "Video subido correctamente");
        respuesta.put("id_video",     guardado.getIdVideo());
        respuesta.put("titulo",       guardado.getTitulo());
        respuesta.put("fileName",     guardado.getFileName());
        respuesta.put("duracion",     guardado.getDuracion() != null ? guardado.getDuracion() : 0);
        // resolveThumbnailUrl convierte el nombre del fichero en ruta pública,
        // o devuelve null si no se subió miniatura.
        respuesta.put("miniaturaUrl", VideoService.resolveThumbnailUrl(guardado.getMiniaturaUrl()));
        return new ResponseEntity<>(respuesta, HttpStatus.CREATED);
    }

    @GetMapping("/espacio")
    public ResponseEntity<Map<String, Long>> obtenerEspacio(@AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(videoService.obtenerEspacioUsado(userDetails.getUsername()));
    }

    @GetMapping("/mios")
    public ResponseEntity<List<VideoDTO>> listarMisVideos(@AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(videoService.obtenerMisVideos(userDetails.getUsername()));
    }

    @GetMapping("/stream/{fileName:.+}")
    public ResponseEntity<ResourceRegion> streamVideo(
            @PathVariable String fileName,
            @RequestHeader HttpHeaders headers,
            @AuthenticationPrincipal UserDetails userDetails
    ) throws Exception {
        return videoService.streamVideoLocal(fileName, headers, userDetails.getUsername());
    }

    @PostMapping("/{idVideo}/heartbeat")
    public ResponseEntity<Void> heartbeat(
            @PathVariable Long idVideo,
            @Valid @RequestBody HeartbeatRequest request,
            @AuthenticationPrincipal UserDetails userDetails
    ) {
        logService.registrarHeartbeat(idVideo, userDetails.getUsername(),
                request.currentTime(), request.sessionId(), request.grupoId());
        return ResponseEntity.ok().build();
    }

    @PatchMapping("/{idVideo}")
    public ResponseEntity<VideoDTO> editarVideo(
            @PathVariable Long idVideo,
            @AuthenticationPrincipal UserDetails userDetails,
            @Valid @RequestBody EditarVideoRequest req) {
        VideoDTO dto = videoService.editarVideo(idVideo, userDetails.getUsername(),
                req.titulo().trim(), req.idGrupos());
        return ResponseEntity.ok(dto);
    }

    @PostMapping("/{id}/ver")
    public ResponseEntity<Void> registrarVista(
            @PathVariable Long id,
            @AuthenticationPrincipal UserDetails userDetails) {
        videoVistaService.incrementarVista(id, userDetails.getUsername());
        return ResponseEntity.ok().build();
    }

    @GetMapping("/{id}/estadisticas")
    public ResponseEntity<List<VideoVistaEstadisticaDto>> obtenerEstadisticas(
            @PathVariable Long id,
            @RequestParam(value = "grupoId", required = false) Long grupoId,
            @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(
                videoVistaService.obtenerEstadisticas(id, userDetails.getUsername(), grupoId));
    }

    /**
     * Sirve una miniatura JPEG almacenada en disco. El endpoint es público
     * (sin autenticación) porque las miniaturas son imágenes de preview sin
     * contenido sensible, y el tag <img> del navegador no puede enviar headers
     * de autorización. La ruta del fichero se valida con `startsWith` para
     * evitar path traversal.
     */
    @GetMapping("/thumbnails/{fileName:.+}")
    public ResponseEntity<Resource> serveThumbnail(@PathVariable String fileName) throws IOException {
        Path baseDir  = Paths.get(thumbnailsDir).toAbsolutePath().normalize();
        Path filePath = baseDir.resolve(fileName).normalize();
        if (!filePath.startsWith(baseDir)) {
            return ResponseEntity.badRequest().build();
        }
        UrlResource resource = new UrlResource(filePath.toUri());
        if (!resource.exists() || !resource.isReadable()) {
            throw new NoSuchElementException("Miniatura no encontrada: " + fileName);
        }
        MediaType mediaType = MediaTypeFactory.getMediaType(resource)
                .orElse(MediaType.IMAGE_JPEG);
        return ResponseEntity.ok()
                .contentType(mediaType)
                .header(HttpHeaders.CACHE_CONTROL, "public, max-age=31536000, immutable")
                .body(resource);
    }

    @DeleteMapping("/{idVideo}")
    public ResponseEntity<Map<String, String>> eliminarVideo(
            @PathVariable Long idVideo,
            @AuthenticationPrincipal UserDetails userDetails) {
        videoService.eliminarVideo(idVideo, userDetails.getUsername());
        return ResponseEntity.ok(Map.of("mensaje", "Vídeo eliminado correctamente"));
    }
}
