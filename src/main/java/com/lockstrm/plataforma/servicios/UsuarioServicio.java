package com.lockstrm.plataforma.servicios;

import com.lockstrm.plataforma.model.Rol;
import com.lockstrm.plataforma.model.Usuario;
import com.lockstrm.plataforma.repositorios.UsuarioRepositorio;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

/**
 * Servicio que encapsula la lógica de negocio relacionada con los usuarios.
 * Actúa como intermediario entre el controlador y el repositorio.
 */
@Service
@RequiredArgsConstructor // Inyección de dependencias vía constructor con Lombok
public class UsuarioServicio {

    private final UsuarioRepositorio usuarioRepositorio;
    private final PasswordEncoder passwordEncoder; // Bean definido en SecurityConfig

    /**
     * Registra un nuevo usuario en el sistema.
     * @param usuario El objeto Usuario con los datos para el registro.
     * @return El usuario guardado en la base de datos, con la contraseña hasheada y rol asignado.
     * @throws IllegalStateException Si el email ya está en uso.
     */
    public Usuario registrarUsuario(Usuario usuario) {

        // 1. Validación: Comprobar si el email ya existe en la base de datos.
        if (usuarioRepositorio.existsByEmail(usuario.getEmail())) {
            throw new IllegalStateException("El email '" + usuario.getEmail() + "' ya está registrado.");
        }

        // 2. Seguridad: Hashear la contraseña del usuario antes de guardarla.
        // Nunca se debe almacenar texto plano. Se utiliza el PasswordEncoder inyectado.
        usuario.setPassword(passwordEncoder.encode(usuario.getPassword()));

        // 3. Asignación de rol por defecto.
        // Todo nuevo usuario se registra con el rol de USUARIO.
        usuario.setRolSistema("USUARIO");

        // 4. Persistencia: Guardar el nuevo usuario en la base de datos a través del repositorio.
        return usuarioRepositorio.save(usuario);
    }
}
