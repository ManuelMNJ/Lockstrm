package com.lockstrm.plataforma.model;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Entity
@Table(name = "usuarios") // Nombre exacto de la tabla en tu foto
@Data
public class Usuario {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long idUsuario; // Generará 'id_usuario'

    @Column(nullable = false, unique = true, length = 100)
    private String email;

    @Column(nullable = false)
    private String password;

    @Column(length = 50)
    private String nombre;

    // Al usar STRING, Hibernate crea un VARCHAR en la base de datos.
    // Coincide con tu diagrama: 'rol_sistema varchar'
    @Enumerated(EnumType.STRING)
    @Column(name = "rol_sistema")
    private Rol rolSistema;

    @Column(name = "fecha_registro", updatable = false)
    private LocalDateTime fechaRegistro;

    @PrePersist
    protected void onCreate() {
        if (this.fechaRegistro == null) {
            this.fechaRegistro = LocalDateTime.now();
        }
    }

    // RELACIÓN 1: Mis Vídeos
    // Si borran al usuario, 'cascade = ALL' borra sus vídeos.
    // 'orphanRemoval = true' asegura que no queden vídeos sin dueño.
    @OneToMany(mappedBy = "propietario", cascade = CascadeType.ALL, orphanRemoval = true)
    private java.util.List<Video> videosSubidos;

    // RELACIÓN 2: Mis Grupos (Membresías)
    // Si borran al usuario, se borran sus registros en la tabla 'miembros_grupo'.
    // OJO: No se borra el Grupo entero, solo mi participación en él.
    @OneToMany(mappedBy = "usuario", cascade = CascadeType.ALL, orphanRemoval = true)
    private java.util.List<MiembrosGrupo> membresias;

    // RELACIÓN 3: Grupos creados por mí
    // Si yo creé el grupo "Clase 1A" y me borran... ¿Se borra el grupo?
    // Según tu lógica de "se borra todo lo que tiene que ver conmigo": SÍ.
    @OneToMany(mappedBy = "creador", cascade = CascadeType.ALL, orphanRemoval = true)
    private java.util.List<Grupo> gruposCreados;

}