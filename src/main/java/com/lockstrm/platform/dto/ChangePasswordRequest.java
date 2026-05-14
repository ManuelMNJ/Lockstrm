package com.lockstrm.platform.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class ChangePasswordRequest {

    // Debe coincidir con PASSWORD_PATTERN en lockstrm-front/src/app/core/validators/password.validator.ts
    public static final String PASSWORD_REGEX = "^(?=.*[A-Z])(?=.*\\d)(?=.*[^A-Za-z\\d]).{8,}$";

    @NotBlank(message = "La contraseña actual es obligatoria")
    @Size(max = 72, message = "La contraseña no puede superar 72 caracteres")
    private String actual;

    @NotBlank(message = "La nueva contraseña es obligatoria")
    @Size(max = 72, message = "La contraseña no puede superar 72 caracteres")
    @Pattern(
        regexp = PASSWORD_REGEX,
        message = "La contraseña debe tener mínimo 8 caracteres, una mayúscula, un número y un símbolo especial"
    )
    private String nueva;
}
