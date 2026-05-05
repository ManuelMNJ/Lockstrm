package com.lockstrm.platform.repositories;

import com.lockstrm.platform.dto.VideoSummaryDto;
import com.lockstrm.platform.entities.User;
import com.lockstrm.platform.entities.Video;
import com.lockstrm.platform.entities.VideoView;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface VideoViewRepository extends JpaRepository<VideoView, Long> {

    Optional<VideoView> findByUsuarioAndVideo(User usuario, Video video);

    @Query("SELECT vv FROM VideoView vv JOIN FETCH vv.usuario WHERE vv.video.idVideo = :idVideo")
    List<VideoView> findByVideoIdWithUsuario(@Param("idVideo") Long idVideo);

    @Modifying
    @Query("DELETE FROM VideoView vv WHERE vv.video.idVideo = :idVideo")
    void deleteByVideoId(@Param("idVideo") Long idVideo);

    /** Elimina todas las vistas registradas por el usuario (usado al borrar la cuenta). */
    @Modifying
    @Query("DELETE FROM VideoView vv WHERE vv.usuario.idUsuario = :idUsuario")
    void deleteByUsuarioId(@Param("idUsuario") Long idUsuario);

    /** Total de reproducciones acumuladas en todos los vídeos del propietario. */
    @Query("SELECT COALESCE(SUM(vv.contador), 0) FROM VideoView vv WHERE vv.video.propietario.email = :email")
    long sumVistasByOwnerEmail(@Param("email") String email);

    /** Top N vídeos más vistos del propietario (solo vídeos con al menos 1 vista). */
    @Query("""
            SELECT new com.lockstrm.platform.dto.VideoSummaryDto(
                vv.video.idVideo,
                vv.video.titulo,
                vv.video.duracion,
                vv.video.miniaturaUrl,
                SUM(vv.contador),
                vv.video.fechaSubida
            )
            FROM VideoView vv
            WHERE vv.video.propietario.email = :email
            GROUP BY vv.video.idVideo,
                     vv.video.titulo,
                     vv.video.duracion,
                     vv.video.miniaturaUrl,
                     vv.video.fechaSubida
            ORDER BY SUM(vv.contador) DESC
            """)
    List<VideoSummaryDto> findTopVistedByOwner(@Param("email") String email, Pageable pageable);
}
