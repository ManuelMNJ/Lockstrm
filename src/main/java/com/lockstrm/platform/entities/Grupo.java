package com.lockstrm.platform.entities;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Entity
@Table(name = "grupos")
@Data
public class Grupo {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_grupo")
    private Long idGrupo;

    @Column(nullable = false, length = 100)
    private String nombre;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "id_creador", nullable = false)
    private Usuario creador;

    @Column(name = "fecha_creacion", updatable = false)
    private LocalDateTime fechaCreacion;

    /** Expuesto en JSON para que el frontend pueda comparar con el usuario autenticado. */
    public Long getIdCreador() {
        return creador != null ? creador.getIdUsuario() : null;
    }

    @PrePersist
    protected void onCreate() {
        if (this.fechaCreacion == null) {
            this.fechaCreacion = LocalDateTime.now();
        }
    }
}
