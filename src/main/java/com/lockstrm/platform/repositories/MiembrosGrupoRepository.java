package com.lockstrm.platform.repositories;

import com.lockstrm.platform.entities.Grupo;
import com.lockstrm.platform.entities.MiembrosGrupo;
import com.lockstrm.platform.entities.MiembrosGrupoId;
import com.lockstrm.platform.entities.Usuario;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface MiembrosGrupoRepository extends JpaRepository<MiembrosGrupo, MiembrosGrupoId> {

    @Query("SELECT COUNT(mg) FROM MiembrosGrupo mg WHERE mg.usuario.email = :email AND mg.id.idGrupoId = :idGrupo")
    long countMiembroByEmailAndGrupo(@Param("email") String email, @Param("idGrupo") Long idGrupo);

    @Query("SELECT mg.grupo FROM MiembrosGrupo mg WHERE mg.usuario.email = :email")
    List<Grupo> findGruposByUsuarioEmail(@Param("email") String email);

    /**
     * Grupos donde el usuario es miembro pero NO es el creador (contexto Espectador/Miembro puro).
     */
    @Query("SELECT mg.grupo FROM MiembrosGrupo mg " +
           "WHERE mg.usuario.email = :email " +
           "AND mg.grupo.creador.email <> :email")
    List<Grupo> findGruposComoMiembroNoCreador(@Param("email") String email);

    @Query("""
            SELECT COUNT(mg) > 0 FROM MiembrosGrupo mg
            WHERE mg.id.idGrupoId IN (
                SELECT p.id.idGrupoId FROM PermisosGrupo p
                WHERE p.id.idVideoId = :idVideo
            )
            AND mg.usuario.email = :email
            """)
    boolean existsMiembroConAccesoAlVideo(@Param("email") String email,
                                          @Param("idVideo") Long idVideo);

    /** Elimina todos los miembros de un grupo (usado al borrar el grupo). */
    @Modifying
    @Query("DELETE FROM MiembrosGrupo mg WHERE mg.id.idGrupoId = :idGrupo")
    void deleteByGrupoId(@Param("idGrupo") Long idGrupo);

    /** Elimina un miembro concreto de un grupo. */
    @Modifying
    @Query("DELETE FROM MiembrosGrupo mg WHERE mg.id.idGrupoId = :idGrupo AND mg.id.idUsuarioId = :idUsuario")
    void deleteByGrupoIdAndUsuarioId(@Param("idGrupo") Long idGrupo, @Param("idUsuario") Long idUsuario);

    /** Lista los usuarios miembros de un grupo. */
    @Query("SELECT mg.usuario FROM MiembrosGrupo mg WHERE mg.id.idGrupoId = :idGrupo")
    List<Usuario> findUsuariosByGrupoId(@Param("idGrupo") Long idGrupo);
}
