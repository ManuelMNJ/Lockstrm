package com.lockstrm.plataforma.repositorios;

import com.lockstrm.plataforma.model.Usuario;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

/**
 * Repositorio de Spring Data JPA para la entidad Usuario.
 * Gestiona el acceso a los datos de la tabla 'usuarios'.
 */
@Repository
public interface UsuarioRepositorio extends JpaRepository<Usuario, Long> {

    /**
     * Busca un usuario por su dirección de correo electrónico.
     * @param email El email del usuario a buscar.
     * @return Un Optional que contiene el usuario si se encuentra, o un Optional vacío si no.
     */
    Optional<Usuario> findByEmail(String email);

    /**
     * Comprueba de manera eficiente si ya existe un usuario con el email especificado.
     * Esta consulta es más performante que findByEmail().isPresent() porque puede ser optimizada
     * por el proveedor de JPA para no tener que traer la entidad completa.
     * @param email El email a comprobar.
     * @return true si el email ya existe, false en caso contrario.
     */
    boolean existsByEmail(String email);
}
