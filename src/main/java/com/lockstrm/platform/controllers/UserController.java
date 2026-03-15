package com.lockstrm.platform.controllers;

import com.lockstrm.platform.dto.RegisterRequest;
import com.lockstrm.platform.entities.Usuario;
import com.lockstrm.platform.services.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/usuarios")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    @PostMapping("/registro")
    public ResponseEntity<Usuario> registrar(@RequestBody RegisterRequest request) {
        Usuario nuevoUsuario = userService.registrarUsuario(request);
        return new ResponseEntity<>(nuevoUsuario, HttpStatus.CREATED);
    }
}
