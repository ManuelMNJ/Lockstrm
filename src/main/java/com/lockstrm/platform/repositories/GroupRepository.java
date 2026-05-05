package com.lockstrm.platform.repositories;

import com.lockstrm.platform.entities.Group;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.NoSuchElementException;

@Repository
public interface GroupRepository extends JpaRepository<Group, Long> {

    List<Group> findByCreador_Email(String email);

    long countByCreador_Email(String email);

    default Group getByIdOrThrow(Long id) {
        return findById(id)
                .orElseThrow(() -> new NoSuchElementException("Group no encontrado: " + id));
    }
}
