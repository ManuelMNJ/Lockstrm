package com.lockstrm.plataforma;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * Clase principal que sirve como punto de entrada para la aplicación Spring Boot.
 * La anotación @SpringBootApplication es una conveniencia que encapsula:
 * - @Configuration: Marca la clase como una fuente de definiciones de beans.
 * - @EnableAutoConfiguration: Intenta configurar automáticamente la aplicación Spring.
 * - @ComponentScan: Escanea componentes, configuraciones y servicios en el paquete actual.
 */
@SpringBootApplication
public class LockstrmPlataformaApplication {

    /**
     * Método principal estándar de Java, es el punto de inicio de la ejecución.
     * @param args Argumentos de línea de comandos pasados al iniciar la aplicación.
     */
    public static void main(String[] args) {
        // SpringApplication.run() arranca la aplicación.
        // Inicia el contenedor de Spring, realiza la autoconfiguración y despliega el servidor web embebido (ej. Tomcat).
        SpringApplication.run(LockstrmPlataformaApplication.class, args);
        
        System.out.println(">>>  LOCKSTRM PLATAFORMA HA ARRANCADO CORRECTAMENTE  <<<");
    }

}
