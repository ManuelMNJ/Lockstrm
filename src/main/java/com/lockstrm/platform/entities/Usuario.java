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

    @Column(unique = true, nullable = false)
    private String email;

    private String password;

    private LocalDateTime fechaRegistro;

    private String rolSistema;

    @OneToMany(mappedBy = "propietario", cascade = CascadeType.ALL)
    @JsonIgnore
    @ToString.Exclude
    private List<Video> videosSubidos;

    @PrePersist
    protected void onCreate() {
        fechaRegistro = LocalDateTime.now();
    }

    public void setUsername(String username) {
        this.nombre = username;
    }
}
