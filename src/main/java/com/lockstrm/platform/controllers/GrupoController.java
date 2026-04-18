package com.lockstrm.platform.controllers;

import com.lockstrm.platform.dto.MiembroDto;
import com.lockstrm.platform.entities.Grupo;
import com.lockstrm.platform.services.GrupoService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/grupos")
@RequiredArgsConstructor
public class GrupoController {

    private final GrupoService grupoService;

    /** Lista todos los grupos del usuario (propios + miembro). Mantiene compatibilidad con clientes existentes. */
    @GetMapping
    public ResponseEntity<List<Grupo>> obtenerMisGrupos(@AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(grupoService.obtenerGruposDelUsuario(userDetails.getUsername()));
    }

    /** Grupos Creados por Mí: grupos donde el usuario autenticado es el administrador/creador (contexto Propietario). */
    @GetMapping("/creados")
    public ResponseEntity<List<Grupo>> obtenerGruposCreados(@AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(grupoService.obtenerGruposCreados(userDetails.getUsername()));
    }

    /** Grupos disponibles para el desplegable de "Editar Vídeo": solo grupos propios. */
    @GetMapping("/desplegable")
    public ResponseEntity<List<Grupo>> obtenerGruposParaDesplegable(@AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(grupoService.obtenerGruposParaDesplegable(userDetails.getUsername()));
    }

    /** Grupos a los que pertenezco: grupos donde el usuario es solo miembro, no creador (contexto Miembro). */
    @GetMapping("/miembro")
    public ResponseEntity<List<Grupo>> obtenerGruposComoMiembro(@AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(grupoService.obtenerGruposComoMiembro(userDetails.getUsername()));
    }

    /** Detalle de un grupo. Solo accesible si el usuario es creador o miembro del grupo (403 en caso contrario). */
    @GetMapping("/{id}")
    public ResponseEntity<Grupo> obtenerDetalle(
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
        Grupo grupo = grupoService.crearGrupo(userDetails.getUsername(), nombre.trim());
        return ResponseEntity.status(201).body(grupo);
    }

    @GetMapping("/{idGrupo}/miembros")
    public ResponseEntity<List<MiembroDto>> obtenerMiembros(
            @PathVariable Long idGrupo,
            @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(grupoService.obtenerMiembros(idGrupo, userDetails.getUsername()));
    }

    @PostMapping("/{idGrupo}/miembros")
    public ResponseEntity<Map<String, String>> aniadirMiembro(
            @PathVariable Long idGrupo,
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestBody Map<String, String> body) {
        String email = body.get("email");
        if (email == null || email.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "El email del nuevo miembro es obligatorio"));
        }
        grupoService.aniadirMiembro(idGrupo, userDetails.getUsername(), email.trim());
        return ResponseEntity.ok(Map.of("mensaje", "Miembro añadido correctamente"));
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
    public ResponseEntity<Grupo> renombrarGrupo(
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
        return ResponseEntity.ok(Map.of("mensaje", "Grupo eliminado correctamente"));
    }
}
