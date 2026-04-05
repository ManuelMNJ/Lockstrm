package com.lockstrm.platform.controllers;

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

    @GetMapping
    public ResponseEntity<List<Grupo>> obtenerMisGrupos(@AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(grupoService.obtenerGruposDelUsuario(userDetails.getUsername()));
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
            grupoService.aniadirMiembro(idGrupo, userDetails.getUsername(), email.trim());
            return ResponseEntity.ok(Map.of("mensaje", "Miembro añadido correctamente"));
        } catch (AccessDeniedException e) {
            return ResponseEntity.status(403).body(Map.of("error", e.getMessage()));
        } catch (NoSuchElementException e) {
            return ResponseEntity.status(404).body(Map.of("error", e.getMessage()));
        }
    }
}
