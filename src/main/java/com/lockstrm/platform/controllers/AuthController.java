package com.lockstrm.platform.controllers;

import com.lockstrm.platform.dto.AuthResponse;
import com.lockstrm.platform.dto.LoginRequest;
import com.lockstrm.platform.dto.RegisterRequest;
import com.lockstrm.platform.entities.User;
import com.lockstrm.platform.security.JwtService;
import com.lockstrm.platform.services.UserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final UserService     userService;
    private final PasswordEncoder passwordEncoder;
    private final JwtService      jwtService;

    @GetMapping("/check-email")
    public ResponseEntity<?> checkEmail(@RequestParam String email) {
        return ResponseEntity.ok(Map.of("disponible", userService.emailDisponible(email)));
    }

    @GetMapping("/check-username")
    public ResponseEntity<?> checkUsername(@RequestParam String username) {
        return ResponseEntity.ok(Map.of("disponible", userService.usernameTieneTagLibre(username)));
    }

    @PostMapping("/registro")
    public ResponseEntity<Map<String, String>> registrarUsuario(@Valid @RequestBody RegisterRequest request) {
        if (!userService.emailDisponible(request.getEmail())) {
            throw new com.lockstrm.platform.exceptions.BusinessException("El email ya está registrado");
        }
        User nuevo = userService.registrarUsuario(request);
        return ResponseEntity.ok(Map.of("mensaje", "User registrado con exito",
                "displayTag", nuevo.getDisplayTag()));
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest request) {
        User usuario = userService.buscarPorIdentificador(request.getIdentificador());

        if (usuario == null || !passwordEncoder.matches(request.getPassword(), usuario.getPassword())) {
            throw new org.springframework.security.authentication.BadCredentialsException(
                    "Credenciales incorrectas");
        }

        UserDetails userDetails = userService.loadUserByUsername(usuario.getEmail());
        String token = jwtService.generateToken(userDetails);

        return ResponseEntity.ok(new AuthResponse(
                token, usuario.getUsername(), usuario.getTag(),
                usuario.getNombre(), usuario.getApellidos(), usuario.getIdUsuario()));
    }
}
