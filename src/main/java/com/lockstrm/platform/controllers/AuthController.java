package com.lockstrm.platform.controllers;

import com.lockstrm.platform.dto.AuthResponse;
import com.lockstrm.platform.dto.LoginRequest;
import com.lockstrm.platform.dto.RegisterRequest;
import com.lockstrm.platform.entities.Usuario;
import com.lockstrm.platform.repositories.UserRepository;
import com.lockstrm.platform.security.JwtService;
import com.lockstrm.platform.services.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
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
    private final UserRepository  userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService      jwtService;

    @GetMapping("/check-email")
    public ResponseEntity<?> checkEmail(@RequestParam String email) {
        boolean tomado = userRepository.existsByEmail(email);
        return ResponseEntity.ok(Map.of("disponible", !tomado));
    }

    @PostMapping("/registro")
    public ResponseEntity<?> registrarUsuario(@RequestBody RegisterRequest request) {
        // Comprobación explícita antes de intentar guardar; evita depender de la excepción
        // de constraint de BD y permite devolver un mensaje claro al frontend.
        if (userRepository.existsByEmail(request.getEmail())) {
            return ResponseEntity
                    .status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("error", "El email ya está registrado"));
        }
        try {
            userService.registrarUsuario(request);
            return ResponseEntity.ok(Map.of("mensaje", "Usuario registrado con exito"));
        } catch (Exception e) {
            return ResponseEntity
                    .status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Error interno al registrar el usuario"));
        }
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody LoginRequest request) {
        Usuario usuario = userService.buscarPorEmail(request.getEmail());

        if (usuario == null || !passwordEncoder.matches(request.getPassword(), usuario.getPassword())) {
            return ResponseEntity
                    .status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "Credenciales incorrectas o usuario no encontrado"));
        }

        UserDetails userDetails = userService.loadUserByUsername(usuario.getEmail());
        String token = jwtService.generateToken(userDetails);

        return ResponseEntity.ok(new AuthResponse(token, usuario.getNombre(), usuario.getIdUsuario()));
    }
}
