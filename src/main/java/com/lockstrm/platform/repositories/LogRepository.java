package com.lockstrm.platform.repositories;

import com.lockstrm.platform.entities.Log;
import com.lockstrm.platform.entities.Usuario;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface LogRepository extends JpaRepository<Log, Long> {

    List<Log> findByUsuario(Usuario usuario);
}
