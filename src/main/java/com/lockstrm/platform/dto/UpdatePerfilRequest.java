package com.lockstrm.platform.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class UpdatePerfilRequest {

    @NotBlank(message = "El nombre es obligatorio")
    private String nombre;

    @NotBlank(message = "Los apellidos son obligatorios")
    private String apellidos;

    @NotBlank(message = "El nombre de usuario es obligatorio")
    @Size(min = 3, max = 20, message = "El nombre de usuario debe tener entre 3 y 20 caracteres")
    @Pattern(regexp = "^[A-Za-z0-9_-]+$", message = "Solo letras, números, guion y guion bajo")
    private String username;
}
