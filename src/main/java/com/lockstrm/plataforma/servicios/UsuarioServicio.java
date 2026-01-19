package com.lockstrm.plataforma.servicios;

import com.lockstrm.plataforma.model.Rol;
import com.lockstrm.plataforma.model.Usuario;
import com.lockstrm.plataforma.repositorios.UsuarioRepositorio;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class UsuarioServicio {

    private final UsuarioRepositorio usuarioRepositorio;
    private final PasswordEncoder passwordEncoder;

    @Transactional
    public Usuario registrarUsuario(Usuario usuario) {
        // 1. Validar que el email no exista
        if (usuarioRepositorio.existsByEmail(usuario.getEmail())) {
            throw new RuntimeException("El email ya está registrado");
        }

        // 2. Encriptar contraseña
        usuario.setPassword(passwordEncoder.encode(usuario.getPassword()));

        // 3. Asignar Rol por defecto
        if (usuario.getRolSistema() == null) {
            usuario.setRolSistema(Rol.USUARIO);
        }

        // 4. Guardar
        return usuarioRepositorio.save(usuario);
    }
}