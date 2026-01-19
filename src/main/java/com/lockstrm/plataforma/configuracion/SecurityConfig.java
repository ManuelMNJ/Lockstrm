package com.lockstrm.plataforma.configuracion;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;

@Configuration // Le digo a Spring: "Oye, lee esto al arrancar porque aquí hay configuraciones
               // importantes".
@EnableWebSecurity // Activo la seguridad web de Spring Security.
public class SecurityConfig {

    // 1. EL ENCRIPTADOR DE CONTRASEÑAS (El que arregla el error en UsuarioService)
    @Bean
    public PasswordEncoder passwordEncoder() {
        // Uso BCrypt porque es el estándar actual. Es seguro porque incluye "sal"
        // (salt) aleatoria
        // y es lento de calcular a propósito para evitar ataques de fuerza bruta.
        return new BCryptPasswordEncoder();
    }

    // 2. EL FILTRO DE SEGURIDAD (El Portero de la Discoteca)
    // Aquí defino las reglas: quién pasa y quién no.
    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                // Deshabilito CSRF de momento para facilitar las pruebas con formularios
                // simples o Postman.
                // En producción para una web con Thymeleaf, esto debería estar activado.
                .csrf(csrf -> csrf.disable())

                // Reglas de autorización de rutas
                .authorizeHttpRequests(auth -> auth
                        // Permito entrar a cualquiera a las rutas de recursos estáticos (CSS, JS,
                        // imágenes)
                        .requestMatchers("/css/**", "/js/**", "/images/**").permitAll()
                        // Permito entrar a cualquiera a la página de login y registro (cuando las
                        // creemos)
                        .requestMatchers("/login", "/registro", "/api/usuarios/registro").permitAll()
                        // Para TODO lo demás, el usuario tiene que estar autenticado.
                        .anyRequest().authenticated())

                // Configuración del formulario de Login (usaremos el de por defecto de momento)
                .formLogin(form -> form
                        .permitAll() // Todos pueden ver el formulario de login
                )

                // Configuración de Logout
                .logout(logout -> logout
                        .permitAll());

        return http.build();
    }
}