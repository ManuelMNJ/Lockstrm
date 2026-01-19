package com.lockstrm.plataforma;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

// @SpringBootApplication: Esta es la anotación más importante.
// Le dice a Java: "Esto no es un programa normal, es una aplicación Spring Boot".
// Activa automáticamente la configuración, el escaneo de componentes y la conexión a BBDD.
@SpringBootApplication
public class LockstrmPlataformaApplication {

    // El método main es estándar en Java. Todo programa empieza aquí.
    public static void main(String[] args) {
        // SpringApplication.run(): Aquí ocurre la magia.
        // 1. Arranca el servidor web (Tomcat) en el puerto 8080.
        // 2. Lee el archivo application.properties.
        // 3. Se conecta a la base de datos Docker.
        // 4. Crea las tablas si no existen (gracias al ddl-auto).
        SpringApplication.run(LockstrmPlataformaApplication.class, args);
        
        System.out.println(">>> 🚀 LOCKSTRM PLATAFORMA HA ARRANCADO CORRECTAMENTE 🚀 <<<");
    }

}