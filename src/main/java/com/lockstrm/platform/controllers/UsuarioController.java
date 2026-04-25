package com.lockstrm.platform.controllers;

import com.lockstrm.platform.dto.CambiarContrasenaRequest;
import com.lockstrm.platform.entities.Usuario;
import com.lockstrm.platform.services.UserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

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

        return ResponseEntity.ok(Map.of(
            "nombre",         usuario.getNombre()        != null ? usuario.getNombre()        : "",
            "apellidos",      usuario.getApellidos()     != null ? usuario.getApellidos()     : "",
            "username",       usuario.getUsername()      != null ? usuario.getUsername()      : "",
            "tag",            usuario.getTag()           != null ? usuario.getTag()           : "",
            "email",          usuario.getEmail(),
            "fechaRegistro",  usuario.getFechaRegistro(),
            "rolSistema",     usuario.getRolSistema()    != null ? usuario.getRolSistema()    : "USER"
        ));
    }

    @PostMapping("/cambiar-contrasena")
    public ResponseEntity<Map<String, String>> cambiarContrasena(
            @AuthenticationPrincipal UserDetails userDetails,
            @Valid @RequestBody CambiarContrasenaRequest body) {

        boolean ok = userService.cambiarContrasena(userDetails.getUsername(), body.getActual(), body.getNueva());
        if (!ok) {
            return ResponseEntity.badRequest().body(Map.of("error", "La contraseña actual no es correcta"));
        }
        return ResponseEntity.ok(Map.of("mensaje", "Contraseña actualizada correctamente"));
    }
}
