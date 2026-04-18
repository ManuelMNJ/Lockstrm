package com.lockstrm.platform.entities;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.Data;
import lombok.ToString;
import java.time.LocalDateTime;
import java.util.List;

@Data
@Entity
@Table(name = "usuarios")
public class Usuario {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long idUsuario;

    private String nombre;

    private String apellidos;

    @Column(unique = true, nullable = false)
    private String email;

    private String password;

    private LocalDateTime fechaRegistro;

    private String rolSistema;

    @OneToMany(mappedBy = "propietario", cascade = CascadeType.ALL)
    @JsonIgnore
    @ToString.Exclude
    private List<Video> videosSubidos;

    public String getNombreCompleto() {
        String n = nombre    != null ? nombre    : "";
        String a = apellidos != null ? apellidos : "";
        String full = (n + " " + a).trim();
        return full.isEmpty() ? email : full;
    }

    @PrePersist
    protected void onCreate() {
        fechaRegistro = LocalDateTime.now();
    }
}
