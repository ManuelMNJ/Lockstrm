package com.lockstrm.platform.repositories;

import com.lockstrm.platform.dto.GrupoStatsDTO;
import com.lockstrm.platform.entities.Grupo;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface GrupoRepository extends JpaRepository<Grupo, Long> {

    List<Grupo> findByCreador_Email(String email);

    @Modifying
    @Query("DELETE FROM Grupo g WHERE g.idGrupo = :idGrupo")
    void deleteGrupoById(@Param("idGrupo") Long idGrupo);

    @Query("""
            SELECT g
            FROM Grupo g
            WHERE g.creador.email = :email
               OR g.idGrupo IN (
                   SELECT mg.id.idGrupoId FROM MiembrosGrupo mg
                   WHERE mg.usuario.email = :email
               )
            """)
    List<Grupo> findGruposForUser(@Param("email") String email);

    @Query("""
            SELECT new com.lockstrm.platform.dto.GrupoStatsDTO(
                g.idGrupo,
                g.nombre,
                g.creador.idUsuario,
                COUNT(m.id.idUsuarioId)
            )
            FROM Grupo g
            LEFT JOIN MiembrosGrupo m ON m.id.idGrupoId = g.idGrupo
            WHERE g.creador.email = :email
               OR g.idGrupo IN (
                   SELECT mg.id.idGrupoId FROM MiembrosGrupo mg
                   WHERE mg.usuario.email = :email
               )
            GROUP BY g.idGrupo, g.nombre, g.creador.idUsuario
            """)
    List<GrupoStatsDTO> findGrupoStatsForUser(@Param("email") String email);
}
