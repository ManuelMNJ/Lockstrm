package com.lockstrm.platform.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class ResetPasswordRequest {

    @NotBlank
    private String token;

    @NotBlank(message = "La nueva contraseña es obligatoria")
    @Size(max = 72, message = "La contraseña no puede superar 72 caracteres")
    @Pattern(
        regexp = ChangePasswordRequest.PASSWORD_REGEX,
        message = "La contraseña debe tener mínimo 8 caracteres, una mayúscula, un número y un símbolo especial"
    )
    private String nuevaContrasena;
}
