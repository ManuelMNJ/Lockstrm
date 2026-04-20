package com.lockstrm.platform.repositories;

import com.lockstrm.platform.dto.VideoResumenDTO;
import com.lockstrm.platform.entities.Usuario;
import com.lockstrm.platform.entities.Video;
import com.lockstrm.platform.entities.VideoVista;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface VideoVistaRepository extends JpaRepository<VideoVista, Long> {

    Optional<VideoVista> findByUsuarioAndVideo(Usuario usuario, Video video);

    @Query("SELECT vv FROM VideoVista vv JOIN FETCH vv.usuario WHERE vv.video.idVideo = :idVideo")
    List<VideoVista> findByVideoIdWithUsuario(@Param("idVideo") Long idVideo);

    @Modifying
    @Query("DELETE FROM VideoVista vv WHERE vv.video.idVideo = :idVideo")
    void deleteByVideoId(@Param("idVideo") Long idVideo);

    /** Total de reproducciones acumuladas en todos los vídeos del propietario. */
    @Query("SELECT COALESCE(SUM(vv.contador), 0) FROM VideoVista vv WHERE vv.video.propietario.email = :email")
    long sumVistasByOwnerEmail(@Param("email") String email);

    /** Top N vídeos más vistos del propietario (solo vídeos con al menos 1 vista). */
    @Query("""
            SELECT new com.lockstrm.platform.dto.VideoResumenDTO(
                vv.video.idVideo,
                vv.video.titulo,
                vv.video.duracion,
                vv.video.miniaturaUrl,
                SUM(vv.contador),
                vv.video.fechaSubida
            )
            FROM VideoVista vv
            WHERE vv.video.propietario.email = :email
            GROUP BY vv.video.idVideo,
                     vv.video.titulo,
                     vv.video.duracion,
                     vv.video.miniaturaUrl,
                     vv.video.fechaSubida
            ORDER BY SUM(vv.contador) DESC
            """)
    List<VideoResumenDTO> findTopVistedByOwner(@Param("email") String email, Pageable pageable);
}
