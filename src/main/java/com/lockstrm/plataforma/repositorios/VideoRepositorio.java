package com.lockstrm.plataforma.repositorios;

import com.lockstrm.plataforma.model.Video;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * Interfaz de acceso a datos para la entidad Video.
 * Permite realizar operaciones CRUD y consultas personalizadas sobre la tabla 'videos'.
 */
@Repository
public interface VideoRepositorio extends JpaRepository<Video, Long> {

    /**
     * Busca todos los vídeos subidos por un usuario concreto.
     * @param idPropietario El ID del usuario creador.
     * @return Lista de vídeos pertenecientes a ese usuario.
     */
    List<Video> findByPropietario_IdUsuario(Long idPropietario);
}