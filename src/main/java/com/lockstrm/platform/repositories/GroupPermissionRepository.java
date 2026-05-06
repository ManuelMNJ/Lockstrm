package com.lockstrm.platform.repositories;

import com.lockstrm.platform.entities.GroupPermission;
import com.lockstrm.platform.entities.GroupPermissionId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface GroupPermissionRepository extends JpaRepository<GroupPermission, GroupPermissionId> {

    @Query("SELECT pg FROM GroupPermission pg JOIN FETCH pg.grupo WHERE pg.id.idVideoId IN :videoIds")
    List<GroupPermission> findByVideoIds(@Param("videoIds") List<Long> videoIds);

    @Query("SELECT COUNT(pg) > 0 FROM GroupPermission pg WHERE pg.id.idVideoId = :idVideo AND pg.grupo.creador.email = :email")
    boolean existsByVideoIdAndGrupoCreadorEmail(@Param("idVideo") Long idVideo, @Param("email") String email);

    /**
     * `clearAutomatically` evita que queden referencias gestionadas a las
     * filas borradas en el persistence context — imprescindible cuando el
     * mismo método de servicio re-inserta combinaciones (idVideo, idGrupo)
     * que acaban de desaparecer (caso típico del `editarVideo`).
     * `flushAutomatically` garantiza que cualquier cambio pendiente se
     * vuelque a BBDD ANTES de ejecutar el DELETE.
     */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("DELETE FROM GroupPermission pg WHERE pg.id.idVideoId = :idVideo")
    void deleteByVideoId(@Param("idVideo") Long idVideo);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("DELETE FROM GroupPermission pg WHERE pg.id.idGrupoId = :idGrupo")
    void deleteByGrupoId(@Param("idGrupo") Long idGrupo);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("DELETE FROM GroupPermission pg WHERE pg.id.idVideoId = :idVideo AND pg.id.idGrupoId = :idGrupo")
    void deleteByVideoIdAndGrupoId(@Param("idVideo") Long idVideo, @Param("idGrupo") Long idGrupo);
}
