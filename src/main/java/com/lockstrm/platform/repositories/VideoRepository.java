package com.lockstrm.platform.repositories;

import com.lockstrm.platform.entities.Video;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface VideoRepository extends JpaRepository<Video, Long> {

    List<Video> findByPropietario_IdUsuario(Long idPropietario);

    List<Video> findByDuracionIsNullOrDuracionEquals(Integer duracion);
}
