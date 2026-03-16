package com.lockstrm.platform.config;

import com.lockstrm.platform.security.JwtAuthenticationFilter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.AuthenticationProvider;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthFilter;
    private final AuthenticationProvider authenticationProvider;

    public SecurityConfig(JwtAuthenticationFilter jwtAuthFilter, AuthenticationProvider authenticationProvider) {
        this.jwtAuthFilter          = jwtAuthFilter;
        this.authenticationProvider = authenticationProvider;
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            // Desactivamos CSRF porque la API no usa cookies de sesión: el token JWT
            // viaja en la cabecera Authorization, así que los ataques CSRF clásicos no aplican.
            .csrf(csrf -> csrf.disable())
            .authorizeHttpRequests(auth -> auth
                // Login y registro tienen que ser públicos, obviamente nadie puede
                // autenticarse con un token que todavía no existe.
                .requestMatchers("/api/auth/**").permitAll()
                .requestMatchers("/", "/index.html", "/css/**", "/js/**").permitAll()
                .anyRequest().authenticated()
            )
            .sessionManagement(session -> session
                // STATELESS es lo que nos permite escalar sin compartir sesión entre instancias;
                // con JWT el estado lo lleva el propio cliente, no el servidor.
                .sessionCreationPolicy(SessionCreationPolicy.STATELESS)
            )
            .authenticationProvider(authenticationProvider)
            // El filtro JWT debe ejecutarse ANTES del de Spring, si no, Spring rechaza
            // la petición sin darle oportunidad a nuestro filtro de inyectar el usuario.
            .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }
}
