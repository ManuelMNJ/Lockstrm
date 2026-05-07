package com.lockstrm.platform.security;

import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.JwtException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.lang.NonNull;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtService          jwtService;
    private final UserDetailsService  userDetailsService;

    public JwtAuthenticationFilter(JwtService jwtService, UserDetailsService userDetailsService) {
        this.jwtService         = jwtService;
        this.userDetailsService = userDetailsService;
    }

    @Override
    protected void doFilterInternal(
            @NonNull HttpServletRequest  request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain         filterChain
    ) throws ServletException, IOException {

        String jwt = null;

        // 1. Intenta extraer el token de la cabecera Authorization (flujo normal)
        final String authHeader = request.getHeader("Authorization");
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            String headerToken = authHeader.substring(7);
            if (!headerToken.isBlank()) jwt = headerToken;
        }

        // 2. Para el endpoint de streaming, el tag <video src="..."> no puede enviar
        //    cabeceras HTTP. Aceptamos un TICKET firmado de corta duración como
        //    query param ?token=, atado al fileName concreto. NO se acepta el JWT
        //    principal aquí: si se filtra el ticket, solo sirve para ese vídeo
        //    durante ~60 s.
        final String requestUri = request.getRequestURI();
        if (jwt == null && requestUri.contains("/stream/")) {
            String paramToken = request.getParameter("token");
            if (paramToken != null && !paramToken.isBlank()) {
                String fileName = requestUri.substring(requestUri.indexOf("/stream/") + "/stream/".length());
                String ticketSubject = jwtService.validateStreamTicket(paramToken, fileName);
                if (ticketSubject != null
                        && SecurityContextHolder.getContext().getAuthentication() == null) {
                    UserDetails userDetails = userDetailsService.loadUserByUsername(ticketSubject);
                    UsernamePasswordAuthenticationToken authToken = new UsernamePasswordAuthenticationToken(
                            userDetails, null, userDetails.getAuthorities()
                    );
                    authToken.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                    SecurityContextHolder.getContext().setAuthentication(authToken);
                }
                filterChain.doFilter(request, response);
                return;
            }
        }

        if (jwt == null) {
            filterChain.doFilter(request, response);
            return;
        }

        final String finalJwt = jwt;

        try {
            final String userEmail = jwtService.extractEmail(finalJwt);

            if (userEmail != null && SecurityContextHolder.getContext().getAuthentication() == null) {
                UserDetails userDetails = userDetailsService.loadUserByUsername(userEmail);

                if (jwtService.isTokenValid(finalJwt, userDetails)) {
                    UsernamePasswordAuthenticationToken authToken = new UsernamePasswordAuthenticationToken(
                            userDetails, null, userDetails.getAuthorities()
                    );
                    authToken.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                    SecurityContextHolder.getContext().setAuthentication(authToken);
                }
            }
        } catch (ExpiredJwtException e) {
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            response.setContentType("application/json");
            response.getWriter().write("{\"error\":\"Token expired\"}");
            return;
        } catch (JwtException | IllegalArgumentException e) {
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            response.setContentType("application/json");
            response.getWriter().write("{\"error\":\"Invalid token\"}");
            return;
        }

        filterChain.doFilter(request, response);
    }
}
