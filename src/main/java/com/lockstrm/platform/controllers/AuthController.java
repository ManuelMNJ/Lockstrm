package com.lockstrm.platform.controllers;

import com.lockstrm.platform.dto.LoginRequest;
import com.lockstrm.platform.dto.RegisterRequest;
import com.lockstrm.platform.entities.Usuario;
import com.lockstrm.platform.services.UserService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@CrossOrigin(origins = "http://localhost:4200")
public class AuthController {

    @Autowired
    private UserService userService;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @PostMapping("/registro")
    public ResponseEntity<?> registrarUsuario(@RequestBody RegisterRequest request) {
        try {
            userService.registrarUsuario(request);
            return ResponseEntity.ok(Map.of("mensaje", "Usuario registrado con éxito "));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", "Error al registrar: " + e.getMessage()));
        }
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody LoginRequest request) {
        // Find the user
        Usuario usuario = userService.buscarPorEmail(request.getEmail());

        // Check existence and password match
        if (usuario == null || !passwordEncoder.matches(request.getPassword(), usuario.getPassword())) {
            return ResponseEntity.badRequest().body(Map.of("error", "Credenciales incorrectas "));
        }

        // Login successful
        Map<String, Object> respuesta = new HashMap<>();
        respuesta.put("mensaje", "Login exitoso ");
        respuesta.put("username", usuario.getNombre());
        respuesta.put("id", usuario.getIdUsuario());

        return ResponseEntity.ok(respuesta);
    }
}
