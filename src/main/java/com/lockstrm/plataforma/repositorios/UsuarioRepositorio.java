package com.lockstrm.plataforma.repositorios;

import com.lockstrm.plataforma.model.Usuario;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface UsuarioRepositorio extends JpaRepository<Usuario, Long> {


    Optional<Usuario> findByEmail(String email);


    boolean existsByEmail(String email);
}
