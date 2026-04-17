package com.lockstrm.platform.controllers;

import com.lockstrm.platform.dto.MiembroDto;
import com.lockstrm.platform.entities.Grupo;
import com.lockstrm.platform.services.GrupoService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;

@RestController
@RequestMapping("/api/grupos")
@RequiredArgsConstructor
public class GrupoController {

    private final GrupoService grupoService;

    @GetMapping("/stats")
    public ResponseEntity<List<GrupoStatsDTO>> obtenerGrupoStats(@AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(grupoService.obtenerGrupoStats(userDetails.getUsername()));
    }

    /** Lista todos los grupos del usuario (propios + miembro) con el campo esCreador. */
    @GetMapping
    public ResponseEntity<List<GrupoDTO>> obtenerMisGrupos(@AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(grupoService.obtenerGruposDelUsuario(userDetails.getUsername()));
    }

    /** Grupos Creados por Mí: grupos donde el usuario autenticado es el administrador/creador (contexto Propietario). */
    @GetMapping("/creados")
    public ResponseEntity<List<Grupo>> obtenerGruposCreados(@AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(grupoService.obtenerGruposCreados(userDetails.getUsername()));
    }

    /** Grupos a los que pertenezco: grupos donde el usuario es solo miembro, no creador (contexto Miembro). */
    @GetMapping("/miembro")
    public ResponseEntity<List<Grupo>> obtenerGruposComoMiembro(@AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(grupoService.obtenerGruposComoMiembro(userDetails.getUsername()));
    }

    /** Detalle de un grupo. Solo accesible si el usuario es creador o miembro del grupo (403 en caso contrario). */
    @GetMapping("/{id}")
    public ResponseEntity<?> obtenerDetalle(
            @PathVariable Long id,
            @AuthenticationPrincipal UserDetails userDetails) {
        try {
            GrupoDTO grupo = grupoService.obtenerDetalle(id, userDetails.getUsername());
            return ResponseEntity.ok(grupo);
        } catch (AccessDeniedException e) {
            return ResponseEntity.status(403).body(Map.of("error", e.getMessage()));
        } catch (NoSuchElementException e) {
            return ResponseEntity.status(404).body(Map.of("error", e.getMessage()));
        }
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
    public ResponseEntity<?> obtenerMiembros(
            @PathVariable Long idGrupo,
            @AuthenticationPrincipal UserDetails userDetails) {
        try {
            List<MiembroDto> miembros = grupoService.obtenerMiembros(idGrupo, userDetails.getUsername());
            return ResponseEntity.ok(miembros);
        } catch (AccessDeniedException e) {
            return ResponseEntity.status(403).body(Map.of("error", e.getMessage()));
        } catch (NoSuchElementException e) {
            return ResponseEntity.status(404).body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/{idGrupo}/miembros")
    public ResponseEntity<?> aniadirMiembro(
            @PathVariable Long idGrupo,
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestBody Map<String, String> body) {
        String email = body.get("email");
        if (email == null || email.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "El email del nuevo miembro es obligatorio"));
        }
        try {
            MiembroDTO miembro = grupoService.aniadirMiembro(idGrupo, userDetails.getUsername(), email.trim());
            return ResponseEntity.status(201).body(miembro);
        } catch (AccessDeniedException e) {
            return ResponseEntity.status(403).body(Map.of("error", e.getMessage()));
        } catch (NoSuchElementException e) {
            return ResponseEntity.status(404).body(Map.of("error", e.getMessage()));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @DeleteMapping("/{idGrupo}/miembros/{idUsuario}")
    public ResponseEntity<?> eliminarMiembro(
            @PathVariable Long idGrupo,
            @PathVariable Long idUsuario,
            @AuthenticationPrincipal UserDetails userDetails) {
        try {
            grupoService.eliminarMiembro(idGrupo, idUsuario, userDetails.getUsername());
            return ResponseEntity.ok(Map.of("mensaje", "Miembro eliminado correctamente"));
        } catch (AccessDeniedException e) {
            return ResponseEntity.status(403).body(Map.of("error", e.getMessage()));
        } catch (NoSuchElementException e) {
            return ResponseEntity.status(404).body(Map.of("error", e.getMessage()));
        }
    }

    @PutMapping("/{idGrupo}")
    public ResponseEntity<?> renombrarGrupo(
            @PathVariable Long idGrupo,
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestBody Map<String, String> body) {
        String nombre = body.get("nombre");
        if (nombre == null || nombre.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "El nombre del grupo es obligatorio"));
        }
        try {
            Grupo grupo = grupoService.renombrarGrupo(idGrupo, nombre, userDetails.getUsername());
            return ResponseEntity.ok(grupo);
        } catch (AccessDeniedException e) {
            return ResponseEntity.status(403).body(Map.of("error", e.getMessage()));
        } catch (NoSuchElementException e) {
            return ResponseEntity.status(404).body(Map.of("error", e.getMessage()));
        }
    }

    @DeleteMapping("/{idGrupo}")
    public ResponseEntity<?> eliminarGrupo(
            @PathVariable Long idGrupo,
            @AuthenticationPrincipal UserDetails userDetails) {
        try {
            grupoService.eliminarGrupo(idGrupo, userDetails.getUsername());
            return ResponseEntity.ok(Map.of("mensaje", "Grupo eliminado correctamente"));
        } catch (AccessDeniedException e) {
            return ResponseEntity.status(403).body(Map.of("error", e.getMessage()));
        } catch (NoSuchElementException e) {
            return ResponseEntity.status(404).body(Map.of("error", e.getMessage()));
        }
    }
}