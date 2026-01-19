package com.lockstrm.plataforma.configuracion;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            // 1. Desactivamos CSRF para que no bloquee los POST de Postman/Curl
            .csrf(csrf -> csrf.disable())
            
            // 2. Configuración de URLs públicas
            .authorizeHttpRequests(auth -> auth
                // Permitimos TODO lo que empiece por /api/videos/
                .requestMatchers("/api/videos/**").permitAll()
                // Permitimos el registro y login de usuarios
                .requestMatchers("/api/usuarios/**", "/login", "/registro").permitAll()
                // El resto requiere autenticación (pero las APIs están a salvo)
                .anyRequest().authenticated()
            );

        return http.build();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}