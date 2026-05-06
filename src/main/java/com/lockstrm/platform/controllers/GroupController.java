package com.lockstrm.platform.controllers;

import com.lockstrm.platform.dto.GroupVideoStatsDto;
import com.lockstrm.platform.dto.MemberDto;
import com.lockstrm.platform.dto.VideoDto;
import com.lockstrm.platform.entities.Group;
import com.lockstrm.platform.enums.GroupRole;
import com.lockstrm.platform.services.AnalyticsService;
import com.lockstrm.platform.services.GroupService;
import com.lockstrm.platform.services.VideoService;
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
import java.util.LinkedHashMap;
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

    /** Lista todos los grupos del usuario (propios + miembro). Mantiene compatibilidad con clientes existentes. */
    @GetMapping
    public ResponseEntity<List<Group>> obtenerMisGrupos(@AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(grupoService.obtenerGruposDelUsuario(userDetails.getUsername()));
    }

    /** Grupos Creados por Mí: grupos donde el usuario autenticado es el administrador/creador (contexto Propietario). */
    @GetMapping("/creados")
    public ResponseEntity<List<Group>> obtenerGruposCreados(@AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(grupoService.obtenerGruposCreados(userDetails.getUsername()));
    }

    /**
     * Últimos N grupos en los que el usuario ha reproducido un vídeo.
     * Usado por el sidebar para la sección "Grupos recientes".
     * El parámetro `limit` se acota a [1, 10] para evitar abuso.
     */
    @GetMapping("/recientes")
    public ResponseEntity<List<Group>> obtenerGruposRecientes(
            @RequestParam(defaultValue = "3") int limit,
            @AuthenticationPrincipal UserDetails userDetails) {
        int safeLimit = Math.max(1, Math.min(limit, 10));
        return ResponseEntity.ok(
                grupoService.obtenerGruposRecientes(userDetails.getUsername(), safeLimit));
    }

    /** Grupos a los que pertenezco: grupos donde el usuario es solo miembro, no creador (contexto Miembro). */
    @GetMapping("/miembro")
    public ResponseEntity<List<Group>> obtenerGruposComoMiembro(@AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(grupoService.obtenerGruposComoMiembro(userDetails.getUsername()));
    }

    /** Detalle de un grupo. Solo accesible si el usuario es creador o miembro del grupo (403 en caso contrario). */
    @GetMapping("/{id}")
    public ResponseEntity<Group> obtenerDetalle(
            @PathVariable Long id,
            @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(grupoService.obtenerDetalle(id, userDetails.getUsername()));
    }

    @PostMapping
    public ResponseEntity<?> crearGrupo(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestBody Map<String, String> body) {
        String nombre = body.get("nombre");
        if (nombre == null || nombre.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "El nombre del grupo es obligatorio"));
        }
        Group grupo = grupoService.crearGrupo(userDetails.getUsername(), nombre.trim());
        return ResponseEntity.status(201).body(grupo);
    }

    @GetMapping("/{idGrupo}/videos")
    public ResponseEntity<List<VideoDto>> obtenerVideosDelGrupo(
            @PathVariable Long idGrupo,
            @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(videoService.obtenerVideosPorGrupo(idGrupo, userDetails.getUsername()));
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
            @RequestBody Map<String, String> body) {
        String identificador = body.getOrDefault("identificador", body.get("email"));
        if (identificador == null || identificador.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "El identificador del nuevo miembro es obligatorio"));
        }
        grupoService.aniadirMiembro(idGrupo, userDetails.getUsername(), identificador.trim());
        return ResponseEntity.ok(Map.of("mensaje", "Miembro añadido correctamente"));
    }

    @PatchMapping("/{idGrupo}/miembros/{idUsuario}/rol")
    public ResponseEntity<Map<String, String>> cambiarRolMiembro(
            @PathVariable Long idGrupo,
            @PathVariable Long idUsuario,
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestBody Map<String, String> body) {

        String rolStr = body.get("rol");
        if (rolStr == null || rolStr.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "El campo 'rol' es obligatorio"));
        }

        GroupRole nuevoRol;
        try {
            nuevoRol = GroupRole.valueOf(rolStr.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "Rol no válido. Valores permitidos: SUPER_ADMIN, ADMIN, EDITOR, MEMBER"));
        }

        grupoService.cambiarRolMiembro(idGrupo, userDetails.getUsername(), idUsuario, nuevoRol);
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

    @PutMapping("/{idGrupo}")
    public ResponseEntity<Group> renombrarGrupo(
            @PathVariable Long idGrupo,
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestBody Map<String, String> body) {
        String nombre = body.get("nombre");
        if (nombre == null || nombre.isBlank()) {
            return ResponseEntity.badRequest().build();
        }
        return ResponseEntity.ok(grupoService.renombrarGrupo(idGrupo, nombre, userDetails.getUsername()));
    }

    @DeleteMapping("/{idGrupo}")
    public ResponseEntity<Map<String, String>> eliminarGrupo(
            @PathVariable Long idGrupo,
            @AuthenticationPrincipal UserDetails userDetails) {
        grupoService.eliminarGrupo(idGrupo, userDetails.getUsername());
        return ResponseEntity.ok(Map.of("mensaje", "Group eliminado correctamente"));
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
                .header(HttpHeaders.CACHE_CONTROL, "public, max-age=604800")
                .body(resource);
    }

    private static String resolveImagenUrl(String fileName) {
        if (fileName == null || fileName.isBlank()) return null;
        return "/api/grupos/imagenes/" + fileName;
    }
}
