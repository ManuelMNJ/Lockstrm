package com.lockstrm.plataforma.repositorios;

import com.lockstrm.plataforma.model.Log;
import com.lockstrm.plataforma.model.Usuario;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface LogRepositorio extends JpaRepository<Log, Long> {
    
    // Método útil para el futuro: "Dame todo el historial de Pepito"
    List<Log> findByUsuario(Usuario usuario);
}