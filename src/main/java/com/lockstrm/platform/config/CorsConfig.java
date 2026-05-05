package com.lockstrm.platform.config;

import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class CorsConfig {

    @Value("${cors.origin:http://localhost:4200}")
    private String corsOrigin;

    @PostConstruct
    void validateCorsOrigin() {
        if ("*".equals(corsOrigin) || corsOrigin.isBlank()) {
            throw new IllegalStateException(
                "CORS_ORIGIN no puede ser '*' ni estar vacío. Configura la variable de entorno con la URL del frontend.");
        }
    }

    @Bean
    public WebMvcConfigurer corsConfigurer() {
        return new WebMvcConfigurer() {
            @Override
            public void addCorsMappings(CorsRegistry registry) {
                registry.addMapping("/**")
                        .allowedOriginPatterns(corsOrigin)
                        .allowedMethods("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS")
                        .allowedHeaders("*")
                        .allowCredentials(true);
            }
        };
    }
}
