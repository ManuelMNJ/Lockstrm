package com.lockstrm.plataforma.controladores;


import com.lockstrm.plataforma.dto.Login;
import com.lockstrm.plataforma.dto.Registro;
import com.lockstrm.plataforma.model.Usuario;
import com.lockstrm.plataforma.servicios.UsuarioServicio;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@CrossOrigin(origins = "http://localhost:4200") // <--- AÑADE ESTO (Permite entrar a Angular)
public class AutorizacionControlador {
    @Autowired
    private UsuarioServicio usuarioServicio;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @PostMapping("/registro")
    public ResponseEntity<?> registrarUsuario(@RequestBody Registro request) {
        try {
            usuarioServicio.registrarUsuario(request);
            return ResponseEntity.ok(Map.of("mensaje", "Usuario registrado con éxito 🚀"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", "Error al registrar: " + e.getMessage()));
        }
    }


    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody Login request) { // <--- AQUÍ USAMOS TU CLASE 'Login'
        // 1. Buscamos al usuario
        Usuario usuario = usuarioServicio.buscarPorEmail(request.getEmail());

        // 2. Comprobamos si existe y si la contraseña coincide
        if (usuario == null || !passwordEncoder.matches(request.getPassword(), usuario.getPassword())) {
            return ResponseEntity.badRequest().body(Map.of("error", "Credenciales incorrectas ❌"));
        }

        // 3. Login correcto
        java.util.Map<String, Object> respuesta = new java.util.HashMap<>();
        respuesta.put("mensaje", "Login exitoso 🔓");
        respuesta.put("username", usuario.getNombre()); // Si esto es null, no pasa nada
        respuesta.put("id", usuario.getIdUsuario());

        return ResponseEntity.ok(respuesta);
    }

}
