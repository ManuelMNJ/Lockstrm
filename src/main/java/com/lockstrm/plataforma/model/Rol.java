package com.lockstrm.plataforma.model;

// Esto es un ENUM.
// Sirve para obligar a que el rol sea SOLAMENTE uno de estos dos.
// Así evito que alguien se registre con rol "HACKER" o "INVITADO" si no lo tengo controlado.
public enum Rol {
    USUARIO,        // Usuario normal (gestiona sus vídeos)
    SUPER_ADMIN     // El jefe (mantenimiento global)
}