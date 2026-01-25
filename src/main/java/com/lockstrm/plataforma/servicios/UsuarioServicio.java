package com.lockstrm.plataforma.servicios;

import com.lockstrm.plataforma.dto.Registro;
import com.lockstrm.plataforma.model.Usuario;
import com.lockstrm.plataforma.repositorios.UsuarioRepositorio;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class UsuarioServicio {

    @Autowired
    private UsuarioRepositorio usuarioRepositorio;

    @Autowired
    private PasswordEncoder passwordEncoder; // Inyectamos el encriptador

    public List<Usuario> listarTodos() {
        return usuarioRepositorio.findAll();
    }

    public Usuario guardar(Usuario usuario) {
        return usuarioRepositorio.save(usuario);
    }

    public Usuario obtenerPorId(Long id) {
        return usuarioRepositorio.findById(id).orElse(null);
    }

    // NUEVO MÉTODO: REGISTRAR CON ENCRIPTACIÓN
    public Usuario registrarUsuario(Registro request) {
        Usuario nuevoUsuario = new Usuario();
        nuevoUsuario.setUsername(request.getUsername());
        nuevoUsuario.setEmail(request.getEmail());

        // AQUÍ OCURRE LA MAGIA: Encriptamos la contraseña antes de guardarla
        String passEncriptada = passwordEncoder.encode(request.getPassword());
        nuevoUsuario.setPassword(passEncriptada);

        // Asignamos un rol por defecto (opcional)
        // nuevoUsuario.setRol("USER");

        return usuarioRepositorio.save(nuevoUsuario);
    }

    public Usuario buscarPorEmail(String email) {
        return usuarioRepositorio.findAll().stream()
                .filter(u -> u.getEmail().equals(email))
                .findFirst()
                .orElse(null);
    }
}