package com.lockstrm.platform.dto;

public class AuthResponse {

    private String token;
    private String username;
    private Long id;

    public AuthResponse(String token, String username, Long id) {
        this.token = token;
        this.username = username;
        this.id = id;
    }

    public String getToken() { return token; }
    public String getUsername() { return username; }
    public Long getId() { return id; }
}
