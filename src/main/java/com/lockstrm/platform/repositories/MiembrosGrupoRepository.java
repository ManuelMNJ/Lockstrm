package com.lockstrm.platform.repositories;

import com.lockstrm.platform.entities.MiembrosGrupo;
import com.lockstrm.platform.entities.MiembrosGrupoId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface MiembrosGrupoRepository extends JpaRepository<MiembrosGrupo, MiembrosGrupoId> {

    boolean existsByUsuario_EmailAndId_IdGrupoId(String email, Long idGrupoId);
}
