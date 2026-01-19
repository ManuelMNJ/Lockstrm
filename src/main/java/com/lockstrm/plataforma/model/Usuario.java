package com.lockstrm.plataforma.model;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;
import java.util.List;

/**
 * Entidad que representa a un Usuario en la base de datos.
 * Corresponde a la tabla 'usuarios'.
 */
@Entity
@Table(name = "usuarios")
@Data
public class Usuario {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long idUsuario;

    @Column(nullable = false, unique = true, length = 100)
    private String email;

    @Column(nullable = false)
    private String password;

    @Column(length = 50)
    private String nombre;

    // La anotación @Enumerated(EnumType.STRING) almacena el nombre del enum ('USUARIO', 'SUPER_ADMIN')
    // en la base de datos como un VARCHAR. Es preferible a EnumType.ORDINAL, que almacena el índice
    // numérico y es más frágil ante cambios en el orden del enum.
    @Enumerated(EnumType.STRING)
    @Column(name = "rol_sistema")
    private Rol rolSistema;

    @Column(name = "fecha_registro", updatable = false)
    private LocalDateTime fechaRegistro;

    /**
     * Callback de JPA que establece la fecha de registro antes de la primera persistencia.
     */
    @PrePersist
    protected void onCreate() {
        if (this.fechaRegistro == null) {
            this.fechaRegistro = LocalDateTime.now();
        }
    }

    // --- DEFINICIÓN DE RELACIONES --- //

    // Relación uno a muchos con Video.
    // 'mappedBy = "propietario"' indica que la entidad Video es la dueña de la relación
    // y que en ella se encuentra el campo 'propietario' que define la Foreign Key.
    // 'cascade = CascadeType.ALL': Las operaciones de persistencia, borrado, etc., sobre un Usuario
    // se propagan a sus vídeos asociados (ej: si se borra el usuario, se borran sus vídeos).
    // 'orphanRemoval = true': Si un vídeo es eliminado de esta lista, también será eliminado de la BBDD.
    @OneToMany(mappedBy = "propietario", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    private List<Video> videosSubidos;

    // Relación uno a muchos con MiembrosGrupo.
    // Si se elimina un usuario, se eliminan sus registros de membresía en la tabla 'miembros_grupo'.
    // Esto no elimina el grupo en sí, solo la participación del usuario en él.
    @OneToMany(mappedBy = "usuario", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    private List<MiembrosGrupo> membresias;

    // Relación uno a muchos con Grupo (para los grupos que este usuario ha creado).
    // Si el usuario creador es eliminado, los grupos que creó también serán eliminados.
    @OneToMany(mappedBy = "creador", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    private List<Grupo> gruposCreados;

}
