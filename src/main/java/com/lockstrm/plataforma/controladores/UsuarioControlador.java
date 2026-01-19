package com.lockstrm.plataforma.controladores;

import com.lockstrm.plataforma.model.Usuario;
import com.lockstrm.plataforma.servicios.UsuarioServicio;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * Controlador REST para gestionar las operaciones relacionadas con los usuarios.
 * Expone los endpoints de la API para interactuar con el recurso Usuario.
 */
@RestController
@RequestMapping("/api/usuarios")
@RequiredArgsConstructor
public class UsuarioControlador {

    // Inyección de dependencias del servicio de usuarios.
    private final UsuarioServicio usuarioServicio;

    /**
     * Endpoint para registrar un nuevo usuario en el sistema.
     * Escucha las peticiones POST en la ruta /api/usuarios/registro.
     * @param usuario El objeto Usuario a crear, deserializado desde el cuerpo (body) de la petición JSON.
     * @return Un ResponseEntity con el usuario creado y un estado HTTP 201 (Created).
     */
    @PostMapping("/registro")
    public ResponseEntity<Usuario> registrar(@RequestBody Usuario usuario) {
        Usuario nuevoUsuario = usuarioServicio.registrarUsuario(usuario);
        return new ResponseEntity<>(nuevoUsuario, HttpStatus.CREATED);
    }
}
