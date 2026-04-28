package com.lockstrm.platform.services;

import com.lockstrm.platform.dto.RegisterRequest;
import com.lockstrm.platform.entities.User;
import com.lockstrm.platform.repositories.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;

@Service
@RequiredArgsConstructor
public class UserService implements UserDetailsService {

    private static final SecureRandom TAG_RNG = new SecureRandom();
    private static final int TAG_MAX_INTENTOS = 20;

    private final UserRepository  userRepository;
    private final PasswordEncoder passwordEncoder;

    @Override
    public UserDetails loadUserByUsername(String email) throws UsernameNotFoundException {
        User usuario = userRepository.findByEmail(email)
                .orElseThrow(() -> new UsernameNotFoundException("User no encontrado: " + email));

        return org.springframework.security.core.userdetails.User.builder()
                .username(usuario.getEmail())
                .password(usuario.getPassword())
                .authorities("ROLE_USER")
                .build();
    }

    public User registrarUsuario(RegisterRequest request) {
        User nuevo = new User();
        nuevo.setNombre(request.getNombre());
        nuevo.setApellidos(request.getApellidos());
        nuevo.setUsername(request.getUsername());
        nuevo.setEmail(request.getEmail());
        nuevo.setPassword(passwordEncoder.encode(request.getPassword()));
        nuevo.setTag(generarTagLibre(request.getUsername()));
        return userRepository.save(nuevo);
    }

    private String generarTagLibre(String username) {
        for (int i = 0; i < TAG_MAX_INTENTOS; i++) {
            String candidato = String.format("%04d", TAG_RNG.nextInt(10000));
            if (!userRepository.existsByUsernameIgnoreCaseAndTag(username, candidato)) {
                return candidato;
            }
        }
        throw new com.lockstrm.platform.exceptions.BusinessException(
                "No se pudo asignar un tag único para este nombre de usuario");
    }

    public User buscarPorEmail(String email) {
        return userRepository.findByEmail(email).orElse(null);
    }

    public User buscarPorIdentificador(String identificador) {
        if (identificador == null || identificador.isBlank()) return null;
        String limpio = identificador.trim().toLowerCase();

        if (limpio.contains("@")) {
            return userRepository.findByEmail(limpio).orElse(null);
        }

        if (limpio.contains("#")) {
            String[] partes = limpio.split("#", 2);
            if (partes.length != 2 || partes[0].isBlank() || partes[1].length() != 4) {
                return null;
            }
            return userRepository.findByUsernameIgnoreCaseAndTag(partes[0], partes[1]).orElse(null);
        }

        return null;
    }

    public boolean emailDisponible(String email) {
        return !userRepository.existsByEmail(email);
    }

    /**
     * Quedan tags libres si el nº de usuarios con ese username es < 10000.
     * El tag se asigna aleatorio, así que solo interesa saber si el espacio (username, 0000-9999)
     * tiene algún hueco. Con un retry de 20 es prácticamente seguro encontrarlo mientras haya huecos.
     */
    public boolean usernameTieneTagLibre(String username) {
        if (username == null || username.isBlank()) return false;
        for (int i = 0; i < 50; i++) {
            String candidato = String.format("%04d", TAG_RNG.nextInt(10000));
            if (!userRepository.existsByUsernameIgnoreCaseAndTag(username, candidato)) {
                return true;
            }
        }
        return false;
    }

    @Transactional
    public boolean cambiarContrasena(String email, String actual, String nueva) {
        return userRepository.findByEmail(email)
                .filter(u -> passwordEncoder.matches(actual, u.getPassword()))
                .map(u -> {
                    u.setPassword(passwordEncoder.encode(nueva));
                    userRepository.save(u);
                    return true;
                })
                .orElse(false);
    }
}
