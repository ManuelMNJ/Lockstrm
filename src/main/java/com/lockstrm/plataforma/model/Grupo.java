package com.lockstrm.plataforma.model;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

/**
 * Entidad que representa un Grupo en la base de datos.
 * Cada instancia de esta clase corresponde a una fila en la tabla 'grupos'.
 */
@Entity
@Table(name = "grupos")
@Data
public class Grupo {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long idGrupo;

    @Column(nullable = false, length = 100)
    private String nombre;

    // Define una relación muchos a uno con la entidad Usuario.
    // Muchos grupos pueden ser creados por un único usuario.
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "id_creador", nullable = false)
    private Usuario creador;

    @Column(name = "fecha_creacion", updatable = false)
    private LocalDateTime fechaCreacion;

    /**
     * Callback de JPA que se ejecuta antes de que la entidad sea persistida por primera vez.
     * Establece la fecha de creación si no ha sido definida previamente.
     */
    @PrePersist
    protected void onCreate() {
        if (this.fechaCreacion == null) {
            this.fechaCreacion = LocalDateTime.now();
        }
    }
}
