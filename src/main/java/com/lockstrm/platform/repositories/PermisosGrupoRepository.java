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

    /**
     * Carga los permisos de un conjunto de vídeos en una única query con JOIN FETCH del grupo,
     * evitando el N+1 que se producía al llamar a {@code findById_IdVideoId} por cada vídeo.
     */
    @Query("SELECT pg FROM PermisosGrupo pg JOIN FETCH pg.grupo WHERE pg.id.idVideoId IN :videoIds")
    List<PermisosGrupo> findByVideoIds(@Param("videoIds") List<Long> videoIds);

    @Modifying
    @Query("DELETE FROM PermisosGrupo pg WHERE pg.id.idVideoId = :idVideo")
    void deleteByVideoId(@Param("idVideo") Long idVideo);

    @Modifying
    @Query("DELETE FROM PermisosGrupo pg WHERE pg.id.idGrupoId = :idGrupo")
    void deleteByGrupoId(@Param("idGrupo") Long idGrupo);
}
