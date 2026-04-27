package com.lockstrm.platform.repositories;

import com.lockstrm.platform.dto.VideoResumenDTO;
import com.lockstrm.platform.entities.Video;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.NoSuchElementException;
import java.util.Optional;

@Repository
public interface VideoRepository extends JpaRepository<Video, Long> {

    Optional<Video> findByFileName(String fileName);

    default Video getByIdOrThrow(Long id) {
        return findById(id)
                .orElseThrow(() -> new NoSuchElementException("Vídeo no encontrado: " + id));
    }

    List<Video> findByPropietario_IdUsuario(Long idPropietario);

    List<Video> findByPropietario_Email(String email);

    long countByPropietario_Email(String email);

    List<Video> findTop3ByPropietario_EmailOrderByFechaSubidaDesc(String email);

    @Query("SELECT DISTINCT v FROM Video v " +
           "JOIN PermisosGrupo pg ON pg.video = v " +
           "WHERE pg.grupo.idGrupo = :idGrupo")
    List<Video> findByGrupoId(@Param("idGrupo") Long idGrupo);
}
