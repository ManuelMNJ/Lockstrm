package com.lockstrm.platform.repositories;

import com.lockstrm.platform.entities.Group;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.NoSuchElementException;

@Repository
public interface GroupRepository extends JpaRepository<Group, Long> {

    List<Group> findByCreador_Email(String email);

    long countByCreador_Email(String email);

    @Query("SELECT g FROM Group g WHERE g.creador.email = :email ORDER BY g.fechaCreacion DESC")
    List<Group> findRecentByCreator(@Param("email") String email, Pageable pageable);

    default Group getByIdOrThrow(Long id) {
        return findById(id)
                .orElseThrow(() -> new NoSuchElementException("Group no encontrado: " + id));
    }
}
