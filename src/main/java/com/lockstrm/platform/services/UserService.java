package com.lockstrm.platform.services;

import com.lockstrm.platform.dto.RegisterRequest;
import com.lockstrm.platform.entities.Usuario;
import com.lockstrm.platform.repositories.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class UserService {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    public List<Usuario> listarTodos() {
        return userRepository.findAll();
    }

    public Usuario guardar(Usuario usuario) {
        return userRepository.save(usuario);
    }

    public Usuario obtenerPorId(Long id) {
        return userRepository.findById(id).orElse(null);
    }

    public Usuario registrarUsuario(RegisterRequest request) {
        Usuario nuevoUsuario = new Usuario();
        nuevoUsuario.setUsername(request.getUsername());
        nuevoUsuario.setEmail(request.getEmail());

        String passEncriptada = passwordEncoder.encode(request.getPassword());
        nuevoUsuario.setPassword(passEncriptada);

        return userRepository.save(nuevoUsuario);
    }

    public Usuario buscarPorEmail(String email) {
        return userRepository.findAll().stream()
                .filter(u -> u.getEmail().equals(email))
                .findFirst()
                .orElse(null);
    }
}
