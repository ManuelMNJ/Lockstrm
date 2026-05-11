package com.lockstrm.platform.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.lockstrm.platform.dto.ErrorResponse;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Arrays;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;
import java.util.stream.Collectors;

/**
 * Rate-limit por IP sobre endpoints sensibles. Token bucket en memoria.
 * Para entornos multi-nodo migrar a Redis + Bucket4j.
 */
@Component
public class RateLimitFilter extends OncePerRequestFilter {

    /** TTL de inactividad: entradas no usadas en 10 min se eliminan del mapa. */
    private static final long BUCKET_TTL_MS = 10 * 60 * 1000L;

    /** Limpiar el mapa cada 500 peticiones para evitar memory leak con IPs rotativas. */
    private static final long CLEANUP_INTERVAL = 500;

    private final ConcurrentHashMap<String, Bucket> buckets = new ConcurrentHashMap<>();
    private final AtomicLong requestCount = new AtomicLong(0);
    private final ObjectMapper mapper = new ObjectMapper().findAndRegisterModules();

    @Value("${lockstrm.ratelimit.auth.capacity:10}")
    private long capacity;

    @Value("${lockstrm.ratelimit.auth.refill-per-minute:10}")
    private long refillPerMinute;

    /**
     * IPs de proxy de confianza que pueden establecer X-Forwarded-For.
     * Por defecto solo localhost (Nginx en Docker). Configurable en properties.
     */
    @Value("${lockstrm.ratelimit.trusted-proxies:127.0.0.1,::1,0:0:0:0:0:0:0:1}")
    private String trustedProxiesRaw;

    private Set<String> trustedProxies;

    @jakarta.annotation.PostConstruct
    void init() {
        trustedProxies = Arrays.stream(trustedProxiesRaw.split(","))
                .map(String::trim)
                .collect(Collectors.toSet());
    }

    private static final Set<String> PROTECTED_EXACT = Set.of(
            "/api/usuarios/cambiar-contrasena",
            "/api/usuarios/email"
    );

    @Override
    protected boolean shouldNotFilter(HttpServletRequest req) {
        String uri = req.getRequestURI();
        return !(uri.startsWith("/api/auth/") || PROTECTED_EXACT.contains(uri));
    }

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res,
                                    FilterChain chain) throws ServletException, IOException {
        // Limpieza periódica para evitar memory leak con IPs rotativas
        if (requestCount.incrementAndGet() % CLEANUP_INTERVAL == 0) {
            evictStaleBuckets();
        }

        String key = clientIp(req);
        Bucket b = buckets.computeIfAbsent(key, k -> new Bucket(capacity, refillPerMinute));
        if (!b.tryConsume()) {
            writeTooMany(req, res);
            return;
        }
        chain.doFilter(req, res);
    }

    /** Elimina entradas inactivas hace más de BUCKET_TTL_MS. */
    private void evictStaleBuckets() {
        long cutoff = System.currentTimeMillis() - BUCKET_TTL_MS;
        buckets.entrySet().removeIf(e -> e.getValue().lastAccessMs() < cutoff);
    }

    /**
     * Resuelve la IP real del cliente. Solo confía en X-Forwarded-For si la
     * petición llega desde una IP de proxy conocida (Nginx local), evitando
     * que un cliente externo falsifique su IP para eludir el rate limit.
     */
    private String clientIp(HttpServletRequest req) {
        String remoteAddr = req.getRemoteAddr();
        if (trustedProxies != null && trustedProxies.contains(remoteAddr)) {
            String xff = req.getHeader("X-Forwarded-For");
            if (xff != null && !xff.isBlank()) {
                int comma = xff.indexOf(',');
                return (comma > 0 ? xff.substring(0, comma) : xff).trim();
            }
        }
        return remoteAddr;
    }

    private void writeTooMany(HttpServletRequest req, HttpServletResponse res) throws IOException {
        res.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
        res.setContentType(MediaType.APPLICATION_JSON_VALUE);
        ErrorResponse body = ErrorResponse.of(429, "RATE_LIMITED",
                "Demasiadas peticiones. Inténtalo de nuevo en unos segundos.",
                req.getRequestURI());
        mapper.writeValue(res.getOutputStream(), body);
    }

    private static final class Bucket {
        private final long capacity;
        private final double tokensPerMs;
        private double tokens;
        private long lastRefillMs;

        Bucket(long capacity, long refillPerMinute) {
            this.capacity    = capacity;
            this.tokensPerMs = refillPerMinute / 60000.0;
            this.tokens      = capacity;
            this.lastRefillMs = System.currentTimeMillis();
        }

        synchronized boolean tryConsume() {
            long now = System.currentTimeMillis();
            tokens       = Math.min(capacity, tokens + (now - lastRefillMs) * tokensPerMs);
            lastRefillMs = now;
            if (tokens >= 1.0) {
                tokens -= 1.0;
                return true;
            }
            return false;
        }

        synchronized long lastAccessMs() {
            return lastRefillMs;
        }
    }
}
