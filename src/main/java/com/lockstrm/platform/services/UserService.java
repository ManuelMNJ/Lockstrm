package com.lockstrm.platform.services;

import com.lockstrm.platform.dto.RegisterRequest;
import com.lockstrm.platform.entities.Usuario;
import com.lockstrm.platform.repositories.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class UserService implements UserDetailsService {

    private final UserRepository  userRepository;
    private final PasswordEncoder passwordEncoder;

    @Override
    public UserDetails loadUserByUsername(String email) throws UsernameNotFoundException {
        Usuario usuario = userRepository.findByEmail(email)
                .orElseThrow(() -> new UsernameNotFoundException("Usuario no encontrado: " + email));

        return User.builder()
                .username(usuario.getEmail())
                .password(usuario.getPassword())
                .authorities("ROLE_USER")
                .build();
    }

    public Usuario registrarUsuario(RegisterRequest request) {
        Usuario nuevo = new Usuario();
        nuevo.setNombre(request.getNombre());
        nuevo.setApellidos(request.getApellidos());
        nuevo.setEmail(request.getEmail());
        nuevo.setPassword(passwordEncoder.encode(request.getPassword()));
        nuevo.setRolSistema("USER");
        return userRepository.save(nuevo);
    }

    public Usuario buscarPorEmail(String email) {
        return userRepository.findByEmail(email).orElse(null);
    }

    public boolean emailDisponible(String email) {
        return !userRepository.existsByEmail(email);
    }

    @Transactional
    public boolean cambiarContrasena(String email, String actual, String nueva) {
        Usuario usuario = userRepository.findByEmail(email)
                .orElseThrow(() -> new UsernameNotFoundException("Usuario no encontrado"));
        if (!passwordEncoder.matches(actual, usuario.getPassword())) {
            return false;
        }
        usuario.setPassword(passwordEncoder.encode(nueva));
        userRepository.save(usuario);
        return true;
    }
}
