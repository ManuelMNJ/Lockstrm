package com.lockstrm.plataforma.repositorios;

import com.lockstrm.plataforma.model.Usuario;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface UsuarioRepositorio extends JpaRepository<Usuario, Long> {
    
    // Busca un usuario por su email
    Optional<Usuario> findByEmail(String email);

    // Comprueba si existe (true/false) sin traerse todos los datos
    boolean existsByEmail(String email);
}