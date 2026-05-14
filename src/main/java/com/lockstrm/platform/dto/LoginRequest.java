package com.lockstrm.platform.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class LoginRequest {

    @NotBlank(message = "El identificador es obligatorio")
    @Size(max = 254, message = "El identificador es demasiado largo")
    private String identificador;

    @NotBlank(message = "La contraseña es obligatoria")
    @Size(max = 72, message = "La contraseña no puede superar 72 caracteres")
    private String password;
}
