package com.lockstrm.platform.repositories;

import com.lockstrm.platform.entities.Log;
import com.lockstrm.platform.entities.Usuario;
import com.lockstrm.platform.entities.Video;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface LogRepository extends JpaRepository<Log, Long> {

    List<Log> findByUsuario(Usuario usuario);

    /**
     * Busca el registro de log más reciente para un usuario y vídeo concretos
     * dentro de un rango de fecha/hora (uso habitual: inicio y fin del día actual).
     * El "findFirst" garantiza exactamente un Optional aunque hubiera duplicados.
     */
    Optional<Log> findFirstByUsuarioAndVideoAndFechaHoraBetween(
            Usuario usuario,
            Video video,
            LocalDateTime inicio,
            LocalDateTime fin
    );

    @Modifying
    @Query("DELETE FROM Log l WHERE l.video.idVideo = :idVideo")
    void deleteByVideoId(@Param("idVideo") Long idVideo);
}
