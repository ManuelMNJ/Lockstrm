package com.lockstrm.plataforma.repositorios;

import com.lockstrm.plataforma.model.Log;
import com.lockstrm.plataforma.model.Usuario;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * Repositorio de Spring Data JPA para la entidad Log.
 * Proporciona métodos CRUD (Crear, Leer, Actualizar, Borrar) y la capacidad de definir
 * consultas personalizadas para acceder a los datos de los logs.
 */
@Repository
public interface LogRepositorio extends JpaRepository<Log, Long> {

    /**
     * Busca y devuelve todos los registros de log asociados a un usuario específico.
     * Spring Data JPA genera automáticamente la consulta a partir del nombre del método.
     * @param usuario El usuario cuyos logs se quieren obtener.
     * @return Una lista de logs pertenecientes al usuario.
     */
    List<Log> findByUsuario(Usuario usuario);
}
