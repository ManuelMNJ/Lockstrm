package com.lockstrm.plataforma.configuracion;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;

/**
 * Clase de configuración para Spring Security.
 * Define las reglas de seguridad web, autenticación y autorización de la aplicación.
 */
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    /**
     * Define un bean para el encriptador de contraseñas.
     * Este bean estará disponible en todo el contexto de Spring para ser inyectado donde se necesite.
     * @return Una implementación de PasswordEncoder que utiliza el algoritmo BCrypt.
     */
    @Bean
    public PasswordEncoder passwordEncoder() {
        // Se utiliza BCrypt porque es el estándar de facto para el hashing de contraseñas.
        // Internamente, genera un 'salt' aleatorio por cada contraseña, lo que protege contra
        // ataques de tablas precalculadas (rainbow tables). Su naturaleza computacionalmente lenta
        // también mitiga los ataques de fuerza bruta.
        return new BCryptPasswordEncoder();
    }

    /**
     * Configura la cadena de filtros de seguridad de Spring Security.
     * Este método define qué rutas son públicas, cuáles requieren autenticación y cómo se gestiona el login.
     * @param http El objeto HttpSecurity para configurar la seguridad web.
     * @return El objeto SecurityFilterChain construido.
     * @throws Exception Si ocurre un error durante la configuración.
     */
    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                // Deshabilitación de la protección contra Cross-Site Request Forgery (CSRF).
                // Es común deshabilitarlo para APIs RESTful sin estado o durante fases iniciales de desarrollo.
                // NOTA: Para aplicaciones web tradicionales con formularios y sesiones, debe estar habilitado.
                .csrf(csrf -> csrf.disable())

                // Define las reglas de autorización para las peticiones HTTP.
                .authorizeHttpRequests(auth -> auth
                        // Permite el acceso público a recursos estáticos.
                        .requestMatchers("/css/**", "/js/**", "/images/**").permitAll()
                        // Permite el acceso público a las rutas de registro y login.
                        .requestMatchers("/login", "/registro", "/api/usuarios/registro").permitAll()
                        // Exige autenticación para cualquier otra petición no definida anteriormente.
                        .anyRequest().authenticated()
                )

                // Configuración del formulario de login.
                // Se utilizará el formulario de login provisto por defecto por Spring Security.
                .formLogin(form -> form
                        .permitAll() // Permite a todos los usuarios acceder a la página de login.
                )

                // Configuración del proceso de logout.
                .logout(logout -> logout
                        .permitAll()); // Permite a todos los usuarios acceder a la funcionalidad de logout.

        return http.build();
    }
}
