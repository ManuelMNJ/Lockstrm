package com.lockstrm.platform.repositories;

import com.lockstrm.platform.entities.Group;
import com.lockstrm.platform.entities.GroupMember;
import com.lockstrm.platform.entities.GroupMemberId;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface GroupMemberRepository extends JpaRepository<GroupMember, GroupMemberId> {

    @Query("SELECT COUNT(mg) FROM GroupMember mg WHERE mg.usuario.email = :email AND mg.id.idGrupoId = :idGrupo")
    long countMiembroByEmailAndGrupo(@Param("email") String email, @Param("idGrupo") Long idGrupo);

    @Query("SELECT mg.grupo FROM GroupMember mg WHERE mg.usuario.email = :email")
    List<Group> findGruposByUsuarioEmail(@Param("email") String email);

    /**
     * Grupos donde el usuario es miembro pero NO es el creador (contexto Espectador/Miembro puro).
     */
    @Query("SELECT mg.grupo FROM GroupMember mg " +
           "WHERE mg.usuario.email = :email " +
           "AND mg.grupo.creador.email <> :email")
    List<Group> findGruposComoMiembroNoCreador(@Param("email") String email);

    @Query("""
            SELECT COUNT(mg) > 0 FROM GroupMember mg
            WHERE mg.id.idGrupoId IN (
                SELECT p.id.idGrupoId FROM GroupPermission p
                WHERE p.id.idVideoId = :idVideo
            )
            AND mg.usuario.email = :email
            """)
    boolean existsMiembroConAccesoAlVideo(@Param("email") String email,
                                          @Param("idVideo") Long idVideo);

    @Query("""
            SELECT COUNT(mg) > 0 FROM GroupMember mg
            WHERE mg.usuario.email = :email
            AND mg.rol IN :roles
            AND mg.id.idGrupoId IN (
                SELECT p.id.idGrupoId FROM GroupPermission p WHERE p.id.idVideoId = :idVideo
            )
            """)
    boolean existsAdminEnGrupoConVideo(@Param("email") String email,
                                       @Param("idVideo") Long idVideo,
                                       @Param("roles") java.util.Collection<com.lockstrm.platform.enums.GroupRole> roles);

    /** Elimina todos los miembros de un grupo (usado al borrar el grupo). */
    @Modifying
    @Query("DELETE FROM GroupMember mg WHERE mg.id.idGrupoId = :idGrupo")
    void deleteByGrupoId(@Param("idGrupo") Long idGrupo);

    /** Elimina un miembro concreto de un grupo. */
    @Modifying
    @Query("DELETE FROM GroupMember mg WHERE mg.id.idGrupoId = :idGrupo AND mg.id.idUsuarioId = :idUsuario")
    void deleteByGrupoIdAndUsuarioId(@Param("idGrupo") Long idGrupo, @Param("idUsuario") Long idUsuario);

    /** Elimina todas las membresías del usuario en cualquier grupo (usado al borrar la cuenta). */
    @Modifying
    @Query("DELETE FROM GroupMember mg WHERE mg.id.idUsuarioId = :idUsuario")
    void deleteByUsuarioId(@Param("idUsuario") Long idUsuario);

    /** Lista registros de membresía completos (usuario + rol) para un grupo. */
    @Query("SELECT mg FROM GroupMember mg JOIN FETCH mg.usuario WHERE mg.id.idGrupoId = :idGrupo")
    List<GroupMember> findMiembrosByGrupoId(@Param("idGrupo") Long idGrupo);

    @Query("SELECT mg FROM GroupMember mg JOIN FETCH mg.grupo WHERE mg.usuario.email = :email AND mg.grupo.creador.email <> :email ORDER BY mg.fechaUnion DESC")
    List<GroupMember> findRecentJoinsByUser(@Param("email") String email, Pageable pageable);
}
