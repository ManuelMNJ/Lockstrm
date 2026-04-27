package com.lockstrm.platform.entities;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.Data;
import lombok.ToString;
import java.time.LocalDateTime;
import java.util.List;

@Data
@Entity
@Table(
        name = "usuarios",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_usuarios_username_tag",
                columnNames = {"username", "tag"}
        )
)
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long idUsuario;

    private String nombre;

    private String apellidos;

    @Column(length = 30, nullable = false)
    private String username;

    @Column(unique = true, nullable = false)
    private String email;

    @Column(length = 4, nullable = false)
    private String tag;

    private String password;

    private LocalDateTime fechaRegistro;

    private String rolSistema;

    @OneToMany(mappedBy = "propietario", cascade = CascadeType.ALL)
    @JsonIgnore
    @ToString.Exclude
    private List<Video> videosSubidos;

    public String getDisplayTag() {
        return (username != null ? username : "") + "#" + (tag != null ? tag : "");
    }

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
