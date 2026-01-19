package com.lockstrm.plataforma.controladores;

import com.lockstrm.plataforma.model.Usuario;
import com.lockstrm.plataforma.servicios.UsuarioServicio;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController // Indica que esta clase responde a peticiones web (API REST)
@RequestMapping("/api/usuarios") // Todas las rutas empezarán por /api/usuarios
@RequiredArgsConstructor
public class UsuarioControlador {

    private final UsuarioServicio usuarioServicio;

    // POST /api/usuarios/registro
    // Recibe un JSON con los datos del usuario y lo crea
    @PostMapping("/registro")
    public ResponseEntity<Usuario> registrar(@RequestBody Usuario usuario) {
        Usuario nuevoUsuario = usuarioServicio.registrarUsuario(usuario);
        return new ResponseEntity<>(nuevoUsuario, HttpStatus.CREATED);
    }
}