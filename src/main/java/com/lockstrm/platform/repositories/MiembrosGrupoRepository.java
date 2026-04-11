package com.lockstrm.platform.repositories;

import com.lockstrm.platform.entities.Grupo;
import com.lockstrm.platform.entities.MiembrosGrupo;
import com.lockstrm.platform.entities.MiembrosGrupoId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface MiembrosGrupoRepository extends JpaRepository<MiembrosGrupo, MiembrosGrupoId> {

    boolean existsByUsuario_EmailAndId_IdGrupoId(String email, Long idGrupoId);

    @Query("SELECT mg.grupo FROM MiembrosGrupo mg WHERE mg.usuario.email = :email")
    List<Grupo> findGruposByUsuarioEmail(@Param("email") String email);

    /**
     * Grupos donde el usuario es miembro pero NO es el creador (contexto Espectador/Miembro puro).
     */
    @Query("SELECT mg.grupo FROM MiembrosGrupo mg " +
           "WHERE mg.usuario.email = :email " +
           "AND mg.grupo.creador.email <> :email")
    List<Grupo> findGruposComoMiembroNoCreador(@Param("email") String email);
}
