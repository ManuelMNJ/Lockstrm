package com.lockstrm.platform.controllers;

import com.lockstrm.platform.entities.Usuario;
import com.lockstrm.platform.services.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/usuarios")
@RequiredArgsConstructor
public class UsuarioController {

    private final UserService userService;

    @GetMapping("/perfil")
    public ResponseEntity<Map<String, Object>> obtenerPerfil(@AuthenticationPrincipal UserDetails userDetails) {
        Usuario usuario = userService.buscarPorEmail(userDetails.getUsername());
        if (usuario == null) return ResponseEntity.notFound().build();

        Map<String, Object> perfil = new HashMap<>();
        perfil.put("nombre", usuario.getNombre());
        perfil.put("apellidos", usuario.getApellidos());
        perfil.put("email", usuario.getEmail());
        perfil.put("fechaRegistro", usuario.getFechaRegistro());
        perfil.put("rolSistema", usuario.getRolSistema());
        return ResponseEntity.ok(perfil);
    }

    @PostMapping("/cambiar-contrasena")
    public ResponseEntity<Map<String, String>> cambiarContrasena(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestBody Map<String, String> body) {
        String actual = body.get("actual");
        String nueva  = body.get("nueva");

        if (actual == null || nueva == null || nueva.length() < 8) {
            return ResponseEntity.badRequest().body(Map.of("error", "La nueva contraseña debe tener al menos 8 caracteres"));
        }

        boolean ok = userService.cambiarContrasena(userDetails.getUsername(), actual, nueva);
        if (!ok) {
            return ResponseEntity.status(400).body(Map.of("error", "La contraseña actual no es correcta"));
        }
        return ResponseEntity.ok(Map.of("mensaje", "Contraseña actualizada correctamente"));
    }
}
