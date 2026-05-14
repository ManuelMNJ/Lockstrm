package com.lockstrm.platform.controllers;

import com.lockstrm.platform.dto.AniadirMiembroRequest;
import com.lockstrm.platform.dto.CambiarRolRequest;
import com.lockstrm.platform.dto.CrearGrupoRequest;
import com.lockstrm.platform.dto.GroupDto;
import com.lockstrm.platform.dto.GroupVideoStatsDto;
import com.lockstrm.platform.dto.MemberDto;
import com.lockstrm.platform.dto.RenombrarGrupoRequest;
import com.lockstrm.platform.dto.VideoDto;
import com.lockstrm.platform.entities.Group;
import com.lockstrm.platform.services.AnalyticsService;
import com.lockstrm.platform.services.GroupService;
import com.lockstrm.platform.services.VideoService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.UrlResource;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpHeaders;
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
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;

@RestController
@RequestMapping("/api/grupos")
@RequiredArgsConstructor
public class GroupController {

    private final GroupService      grupoService;
    private final VideoService      videoService;
    private final AnalyticsService analiticasService;

    @Value("${lockstrm.upload.grupos.dir}")
    private String gruposImgDir;

    /** Lista todos los grupos del usuario (propios + miembro). */
    @GetMapping
    public ResponseEntity<List<GroupDto>> obtenerMisGrupos(@AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(
                grupoService.obtenerGruposDelUsuario(userDetails.getUsername())
                        .stream().map(GroupDto::from).toList());
    }

    /** Grupos creados por el usuario (contexto Propietario). */
    @GetMapping("/creados")
    public ResponseEntity<List<GroupDto>> obtenerGruposCreados(@AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(
                grupoService.obtenerGruposCreados(userDetails.getUsername())
                        .stream().map(GroupDto::from).toList());
    }

    /** Últimos N grupos en los que el usuario ha reproducido algún vídeo (limit acotado a [1, 10]). */
    @GetMapping("/recientes")
    public ResponseEntity<List<GroupDto>> obtenerGruposRecientes(
            @RequestParam(defaultValue = "3") int limit,
            @AuthenticationPrincipal UserDetails userDetails) {
        int safeLimit = Math.max(1, Math.min(limit, 10));
        return ResponseEntity.ok(
                grupoService.obtenerGruposRecientes(userDetails.getUsername(), safeLimit)
                        .stream().map(GroupDto::from).toList());
    }

    /** Grupos en los que el usuario es solo miembro (contexto Miembro). */
    @GetMapping("/miembro")
    public ResponseEntity<List<GroupDto>> obtenerGruposComoMiembro(@AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(
                grupoService.obtenerGruposComoMiembro(userDetails.getUsername())
                        .stream().map(GroupDto::from).toList());
    }

    /** Detalle de un grupo. 403 si el usuario no es creador ni miembro. */
    @GetMapping("/{id}")
    public ResponseEntity<GroupDto> obtenerDetalle(
            @PathVariable Long id,
            @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(GroupDto.from(
                grupoService.obtenerDetalle(id, userDetails.getUsername())));
    }

    @PostMapping
    public ResponseEntity<GroupDto> crearGrupo(
            @AuthenticationPrincipal UserDetails userDetails,
            @Valid @RequestBody CrearGrupoRequest request) {
        Group grupo = grupoService.crearGrupo(userDetails.getUsername(), request.nombre().trim());
        return ResponseEntity.status(201).body(GroupDto.from(grupo));
    }

    @GetMapping("/{idGrupo}/videos")
    public ResponseEntity<List<VideoDto>> obtenerVideosDelGrupo(
            @PathVariable Long idGrupo,
            @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(videoService.obtenerVideosPorGrupo(idGrupo, userDetails.getUsername()));
    }

    @DeleteMapping("/{idGrupo}/videos/{idVideo}")
    public ResponseEntity<Map<String, String>> quitarVideoDelGrupo(
            @PathVariable Long idGrupo,
            @PathVariable Long idVideo,
            @AuthenticationPrincipal UserDetails userDetails) {
        grupoService.quitarVideoDelGrupo(idGrupo, idVideo, userDetails.getUsername());
        return ResponseEntity.ok(Map.of("mensaje", "Vídeo eliminado del grupo correctamente"));
    }

    /**
     * Analíticas B2B segregadas: una fila por vídeo del grupo con agregados
     * acotados a este contexto y, opcionalmente, a un rango de fechas.
     *
     * @param desde ISO-8601 (inclusivo) — filtra `fechaHora >= desde`.
     *              Aplicado en JOIN ON, por lo que vídeos sin visitas en el
     *              rango siguen apareciendo con 0/0.
     * @param hasta ISO-8601 (inclusivo) — filtra `fechaHora <= hasta`.
     */
    @GetMapping("/{idGrupo}/analiticas")
    public ResponseEntity<List<GroupVideoStatsDto>> obtenerAnaliticasDelGrupo(
            @PathVariable Long idGrupo,
            @RequestParam(value = "desde", required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime desde,
            @RequestParam(value = "hasta", required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime hasta,
            @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(
                analiticasService.analiticasDelGrupo(idGrupo, userDetails.getUsername(), desde, hasta));
    }

    @GetMapping("/{idGrupo}/miembros")
    public ResponseEntity<List<MemberDto>> obtenerMiembros(
            @PathVariable Long idGrupo,
            @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(grupoService.obtenerMiembros(idGrupo, userDetails.getUsername()));
    }

    @PostMapping("/{idGrupo}/miembros")
    public ResponseEntity<Map<String, String>> aniadirMiembro(
            @PathVariable Long idGrupo,
            @AuthenticationPrincipal UserDetails userDetails,
            @Valid @RequestBody AniadirMiembroRequest request) {
        grupoService.aniadirMiembro(idGrupo, userDetails.getUsername(), request.identificador().trim());
        return ResponseEntity.ok(Map.of("mensaje", "Miembro añadido correctamente"));
    }

    @PatchMapping("/{idGrupo}/miembros/{idUsuario}/rol")
    public ResponseEntity<Map<String, String>> cambiarRolMiembro(
            @PathVariable Long idGrupo,
            @PathVariable Long idUsuario,
            @AuthenticationPrincipal UserDetails userDetails,
            @Valid @RequestBody CambiarRolRequest request) {
        grupoService.cambiarRolMiembro(idGrupo, userDetails.getUsername(), idUsuario, request.rol());
        return ResponseEntity.ok(Map.of("mensaje", "Rol actualizado correctamente"));
    }

    @DeleteMapping("/{idGrupo}/miembros/{idUsuario}")
    public ResponseEntity<Map<String, String>> eliminarMiembro(
            @PathVariable Long idGrupo,
            @PathVariable Long idUsuario,
            @AuthenticationPrincipal UserDetails userDetails) {
        grupoService.eliminarMiembro(idGrupo, idUsuario, userDetails.getUsername());
        return ResponseEntity.ok(Map.of("mensaje", "Miembro eliminado correctamente"));
    }

    @PatchMapping("/{idGrupo}")
    public ResponseEntity<GroupDto> renombrarGrupo(
            @PathVariable Long idGrupo,
            @AuthenticationPrincipal UserDetails userDetails,
            @Valid @RequestBody RenombrarGrupoRequest request) {
        return ResponseEntity.ok(GroupDto.from(
                grupoService.renombrarGrupo(idGrupo, request.nombre(), userDetails.getUsername())));
    }

    @DeleteMapping("/{idGrupo}")
    public ResponseEntity<Map<String, String>> eliminarGrupo(
            @PathVariable Long idGrupo,
            @AuthenticationPrincipal UserDetails userDetails) {
        grupoService.eliminarGrupo(idGrupo, userDetails.getUsername());
        return ResponseEntity.ok(Map.of("mensaje", "Grupo eliminado correctamente"));
    }

    @PostMapping("/{idGrupo}/imagen")
    public ResponseEntity<Map<String, String>> subirImagenGrupo(
            @PathVariable Long idGrupo,
            @RequestParam("file") MultipartFile file,
            @AuthenticationPrincipal UserDetails userDetails) throws IOException {
        Group grupo = grupoService.actualizarImagenGrupo(idGrupo, userDetails.getUsername(), file);
        return ResponseEntity.ok(Map.of("imagenUrl", grupo.getImagenUrl()));
    }

    @GetMapping("/imagenes/{fileName:.+}")
    public ResponseEntity<org.springframework.core.io.Resource> serveImagenGrupo(
            @PathVariable String fileName) throws IOException {
        Path baseDir  = Paths.get(gruposImgDir).toAbsolutePath().normalize();
        Path filePath = baseDir.resolve(fileName).normalize();
        if (!filePath.startsWith(baseDir)) return ResponseEntity.badRequest().build();
        UrlResource resource = new UrlResource(filePath.toUri());
        if (!resource.exists() || !resource.isReadable()) {
            throw new NoSuchElementException("Imagen no encontrada: " + fileName);
        }
        MediaType mediaType = MediaTypeFactory.getMediaType(resource).orElse(MediaType.IMAGE_JPEG);
        return ResponseEntity.ok()
                .contentType(mediaType)
                .header(HttpHeaders.CACHE_CONTROL, "no-cache, must-revalidate")
                .body(resource);
    }

}
