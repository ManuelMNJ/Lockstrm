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
import org.springframework.core.io.support.ResourceRegion;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/videos")
@RequiredArgsConstructor
public class VideoController {

    private final VideoService      videoService;
    private final LogService        logService;
    private final VideoVistaService videoVistaService;

    @PostMapping("/subir")
    public ResponseEntity<Map<String, Object>> subirVideo(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestParam("file") MultipartFile file,
            @RequestParam("titulo") String titulo,
            @RequestParam(value = "idGrupo",      required = false) Long    idGrupo,
            @RequestParam(value = "miniaturaUrl",  required = false) String  miniaturaUrl,
            @RequestParam(value = "duracion",      required = false) Integer duracion
    ) throws Exception {
        Video guardado = videoService.subirVideo(
                file, userDetails.getUsername(), titulo, idGrupo, miniaturaUrl, duracion);
        return new ResponseEntity<>(Map.of(
                "status",       "exito",
                "mensaje",      "Video subido correctamente",
                "id_video",     guardado.getIdVideo(),
                "titulo",       guardado.getTitulo(),
                "fileName",     guardado.getFileName(),
                "duracion",     guardado.getDuracion() != null ? guardado.getDuracion() : 0,
                "miniaturaUrl", guardado.getMiniaturaUrl() != null ? guardado.getMiniaturaUrl() : ""
        ), HttpStatus.CREATED);
    }

    @GetMapping("/mios")
    public ResponseEntity<List<VideoDTO>> listarMisVideos(@AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(videoService.obtenerMisVideos(userDetails.getUsername()));
    }

    @GetMapping("/compartidos")
    public ResponseEntity<List<VideoDTO>> listarVideosCompartidos(@AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(videoService.obtenerVideosCompartidos(userDetails.getUsername()));
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
        videoVistaService.incrementarVista(id, userDetails.getUsername());
        return ResponseEntity.ok().build();
    }

    @GetMapping("/{id}/estadisticas")
    public ResponseEntity<List<VideoVistaEstadisticaDto>> obtenerEstadisticas(
            @PathVariable Long id,
            @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(videoVistaService.obtenerEstadisticas(id, userDetails.getUsername()));
    }

    @DeleteMapping("/{idVideo}")
    public ResponseEntity<Map<String, String>> eliminarVideo(
            @PathVariable Long idVideo,
            @AuthenticationPrincipal UserDetails userDetails) {
        videoService.eliminarVideo(idVideo, userDetails.getUsername());
        return ResponseEntity.ok(Map.of("mensaje", "Vídeo eliminado correctamente"));
    }
}
