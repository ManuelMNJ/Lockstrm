package com.lockstrm.platform.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public class ActualizarEmailRequest {

    @NotBlank
    @Email
    private String nuevoEmail;

    @NotBlank
    private String passwordActual;

    public String getNuevoEmail()      { return nuevoEmail; }
    public String getPasswordActual()  { return passwordActual; }
}
