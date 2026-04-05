package com.lockstrm.platform.repositories;

import com.lockstrm.platform.entities.PermisosGrupo;
import com.lockstrm.platform.entities.PermisosGrupoId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface PermisosGrupoRepository extends JpaRepository<PermisosGrupo, PermisosGrupoId> {

    List<PermisosGrupo> findById_IdVideoId(Long idVideoId);

    @Modifying
    @Query("DELETE FROM PermisosGrupo pg WHERE pg.id.idVideoId = :idVideo")
    void deleteByVideoId(@Param("idVideo") Long idVideo);
}
