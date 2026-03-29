package com.lockstrm.platform.repositories;

import com.lockstrm.platform.entities.PermisosGrupo;
import com.lockstrm.platform.entities.PermisosGrupoId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface PermisosGrupoRepository extends JpaRepository<PermisosGrupo, PermisosGrupoId> {
}
