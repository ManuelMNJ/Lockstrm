package com.lockstrm.plataforma.controladores;

import com.lockstrm.plataforma.dto.Registro;
import com.lockstrm.plataforma.model.Usuario;
import com.lockstrm.plataforma.servicios.UsuarioServicio;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;


@RestController
@RequestMapping("/api/usuarios")
@RequiredArgsConstructor
public class UsuarioControlador {


    private final UsuarioServicio usuarioServicio;

    @PostMapping("/registro")
    public ResponseEntity<Usuario> registrar(@RequestBody Registro request) {
        Usuario nuevoUsuario = usuarioServicio.registrarUsuario(request);
        return new ResponseEntity<>(nuevoUsuario, HttpStatus.CREATED);
    }
}
