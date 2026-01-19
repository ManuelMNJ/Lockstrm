package com.lockstrm.plataforma.model;

/**
 * Enumeración que define los roles de sistema disponibles en la aplicación.
 * El uso de un enum garantiza la integridad de los datos, ya que el rol de un usuario
 * solo puede ser uno de los valores predefinidos, evitando inconsistencias.
 */
public enum Rol {
    /**
     * Rol estándar para usuarios registrados. Tienen control sobre sus propios recursos (ej. vídeos).
     */
    USUARIO,

    /**
     * Rol con privilegios elevados para la administración global del sistema.
     */
    SUPER_ADMIN
}
