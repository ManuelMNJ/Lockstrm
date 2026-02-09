package com.lockstrm.plataforma.repositorios;

import com.lockstrm.plataforma.model.Video;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;


@Repository
public interface VideoRepositorio extends JpaRepository<Video, Long> {


    List<Video> findByPropietario_IdUsuario(Long idPropietario);
}