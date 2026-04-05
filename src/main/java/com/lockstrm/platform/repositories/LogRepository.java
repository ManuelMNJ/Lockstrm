package com.lockstrm.platform.repositories;

import com.lockstrm.platform.entities.Log;
import com.lockstrm.platform.entities.Usuario;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface LogRepository extends JpaRepository<Log, Long> {

    List<Log> findByUsuario(Usuario usuario);

    @Modifying
    @Query("DELETE FROM Log l WHERE l.video.idVideo = :idVideo")
    void deleteByVideoId(@Param("idVideo") Long idVideo);
}
