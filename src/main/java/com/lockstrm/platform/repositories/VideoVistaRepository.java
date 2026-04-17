package com.lockstrm.platform.repositories;

import com.lockstrm.platform.entities.Usuario;
import com.lockstrm.platform.entities.Video;
import com.lockstrm.platform.entities.VideoVista;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface VideoVistaRepository extends JpaRepository<VideoVista, Long> {

    Optional<VideoVista> findByUsuarioAndVideo(Usuario usuario, Video video);

    @Query("SELECT vv FROM VideoVista vv JOIN FETCH vv.usuario WHERE vv.video.idVideo = :idVideo")
    List<VideoVista> findByVideoIdWithUsuario(@Param("idVideo") Long idVideo);
}
