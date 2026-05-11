package com.lockstrm.platform.repositories;

import com.lockstrm.platform.entities.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.NoSuchElementException;
import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<User, Long> {

    Optional<User> findByEmail(String email);

    boolean existsByEmail(String email);

    Optional<User> findByUsernameIgnoreCaseAndTag(String username, String tag);

    boolean existsByUsernameIgnoreCaseAndTag(String username, String tag);

    long countByUsernameIgnoreCase(String username);

    default User getByEmailOrThrow(String email) {
        return findByEmail(email)
                .orElseThrow(() -> new NoSuchElementException("Usuario no encontrado: " + email));
    }
}
