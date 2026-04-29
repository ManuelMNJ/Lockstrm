package com.lockstrm.platform.dto;

public class AuthResponse {

    private String token;
    private String username;
    private String tag;
    private String nombre;
    private String apellidos;
    private Long   id;
    private String avatarUrl;

    public AuthResponse(String token, String username, String tag,
                        String nombre, String apellidos, Long id,
                        String avatarUrl) {
        this.token     = token;
        this.username  = username;
        this.tag       = tag;
        this.nombre    = nombre;
        this.apellidos = apellidos;
        this.id        = id;
        this.avatarUrl = avatarUrl;
    }

    public String getToken()     { return token; }
    public String getUsername()  { return username; }
    public String getTag()       { return tag; }
    public String getNombre()    { return nombre; }
    public String getApellidos() { return apellidos; }
    public Long   getId()        { return id; }
    public String getAvatarUrl() { return avatarUrl; }

    public String getDisplayTag() {
        return username + "#" + tag;
    }
}
