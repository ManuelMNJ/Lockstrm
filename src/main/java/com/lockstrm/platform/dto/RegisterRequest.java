package com.lockstrm.platform.dto;

import lombok.Data;

@Data
public class RegisterRequest {
    private String nombre;
    private String apellidos;
    private String email;
    private String password;
}
