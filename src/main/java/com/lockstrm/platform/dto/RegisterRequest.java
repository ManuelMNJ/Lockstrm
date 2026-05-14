package com.lockstrm.platform.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class RegisterRequest {

    @NotBlank(message = "El nombre es obligatorio")
    @Size(max = 100, message = "El nombre no puede superar 100 caracteres")
    private String nombre;

    @NotBlank(message = "Los apellidos son obligatorios")
    @Size(max = 100, message = "Los apellidos no pueden superar 100 caracteres")
    private String apellidos;

    @NotBlank(message = "El nombre de usuario es obligatorio")
    @Size(min = 3, max = 20, message = "El nombre de usuario debe tener entre 3 y 20 caracteres")
    @Pattern(
            regexp = "^[A-Za-z0-9_-]+$",
            message = "Solo se permiten letras, números, guion y guion bajo"
    )
    private String username;

    @NotBlank(message = "El email es obligatorio")
    @Size(max = 254, message = "El email no puede superar 254 caracteres")
    @Email(message = "El email no tiene un formato válido")
    private String email;

    @NotBlank(message = "La contraseña es obligatoria")
    @Size(max = 72, message = "La contraseña no puede superar 72 caracteres")
    @Pattern(
        regexp = ChangePasswordRequest.PASSWORD_REGEX,
        message = "La contraseña debe tener mínimo 8 caracteres, una mayúscula, un número y un símbolo especial"
    )
    private String password;
}
