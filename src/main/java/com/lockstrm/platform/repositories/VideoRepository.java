package com.lockstrm.platform.repositories;

import com.lockstrm.platform.entities.Video;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface VideoRepository extends JpaRepository<Video, Long> {

    List<Video> findByPropietario_IdUsuario(Long idPropietario);

    List<Video> findByPropietario_Email(String email);

    /**
     * Devuelve los vídeos a los que el usuario tiene acceso a través de permisos de grupo,
     * excluyendo los vídeos de los que el propio usuario es propietario.
     * DISTINCT garantiza que no aparezcan duplicados si el vídeo está en varios grupos del usuario.
     */
    @Query("SELECT DISTINCT v FROM Video v " +
           "JOIN PermisosGrupo pg ON pg.video = v " +
           "JOIN MiembrosGrupo mg ON mg.grupo = pg.grupo " +
           "WHERE mg.usuario.email = :email " +
           "AND v.propietario.email <> :email")
    List<Video> findVideosCompartidosConUsuario(@Param("email") String email);

    @Query("SELECT v FROM Video v " +
           "JOIN PermisosGrupo pg ON pg.video = v " +
           "WHERE pg.id.idGrupoId = :idGrupo")
    List<Video> findByGrupoId(@Param("idGrupo") Long idGrupo);

    @Modifying
    @Query("DELETE FROM PermisosGrupo pg WHERE pg.id.idGrupoId = :idGrupo")
    void desasociarVideosDeGrupo(@Param("idGrupo") Long idGrupo);
}
