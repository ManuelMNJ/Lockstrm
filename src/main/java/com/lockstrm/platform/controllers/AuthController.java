package com.lockstrm.platform.controllers;

import com.lockstrm.platform.dto.AuthResponse;
import com.lockstrm.platform.dto.LoginRequest;
import com.lockstrm.platform.dto.RegisterRequest;
import com.lockstrm.platform.entities.Usuario;
import com.lockstrm.platform.security.JwtService;
import com.lockstrm.platform.services.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@CrossOrigin(origins = "http://localhost:4200")
@RequiredArgsConstructor
public class AuthController {

    private final UserService     userService;
    private final PasswordEncoder passwordEncoder;
    private final JwtService      jwtService;

    @PostMapping("/registro")
    public ResponseEntity<?> registrarUsuario(@RequestBody RegisterRequest request) {
        try {
            userService.registrarUsuario(request);
            return ResponseEntity.ok(Map.of("mensaje", "Usuario registrado con exito"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", "Error al registrar: " + e.getMessage()));
        }
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody LoginRequest request) {
        Usuario usuario = userService.buscarPorEmail(request.getEmail());

        if (usuario == null || !passwordEncoder.matches(request.getPassword(), usuario.getPassword())) {
            return ResponseEntity.badRequest().body(Map.of("error", "Credenciales incorrectas"));
        }

        UserDetails userDetails = userService.loadUserByUsername(usuario.getEmail());
        String token = jwtService.generateToken(userDetails);

        return ResponseEntity.ok(new AuthResponse(token, usuario.getNombre(), usuario.getIdUsuario()));
    }
}
