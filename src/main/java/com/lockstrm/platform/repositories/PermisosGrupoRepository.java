package com.lockstrm.platform.repositories;

import com.lockstrm.platform.entities.PermisosGrupo;
import com.lockstrm.platform.entities.PermisosGrupoId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface PermisosGrupoRepository extends JpaRepository<PermisosGrupo, PermisosGrupoId> {

    Optional<PermisosGrupo> findById_IdVideoId(Long idVideoId);
}
