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
import java.util.concurrent.ConcurrentHashMap;

/**
 * Rate-limit por IP sobre /api/auth/*. Token bucket en memoria (suficiente para
 * un solo nodo; para cluster migrar a Redis + Bucket4j).
 */
@Component
public class RateLimitFilter extends OncePerRequestFilter {

    private final ConcurrentHashMap<String, Bucket> buckets = new ConcurrentHashMap<>();
    private final ObjectMapper mapper = new ObjectMapper().findAndRegisterModules();

    @Value("${lockstrm.ratelimit.auth.capacity:10}")
    private long capacity;

    @Value("${lockstrm.ratelimit.auth.refill-per-minute:10}")
    private long refillPerMinute;

    @Override
    protected boolean shouldNotFilter(HttpServletRequest req) {
        return !req.getRequestURI().startsWith("/api/auth/");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res,
                                    FilterChain chain) throws ServletException, IOException {
        String key = clientIp(req);
        Bucket b = buckets.computeIfAbsent(key, k -> new Bucket(capacity, refillPerMinute));
        if (!b.tryConsume()) {
            writeTooMany(req, res);
            return;
        }
        chain.doFilter(req, res);
    }

    private String clientIp(HttpServletRequest req) {
        String xff = req.getHeader("X-Forwarded-For");
        if (xff != null && !xff.isBlank()) {
            int comma = xff.indexOf(',');
            return (comma > 0 ? xff.substring(0, comma) : xff).trim();
        }
        return req.getRemoteAddr();
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
            this.capacity = capacity;
            this.tokensPerMs = refillPerMinute / 60000.0;
            this.tokens = capacity;
            this.lastRefillMs = System.currentTimeMillis();
        }

        synchronized boolean tryConsume() {
            long now = System.currentTimeMillis();
            tokens = Math.min(capacity, tokens + (now - lastRefillMs) * tokensPerMs);
            lastRefillMs = now;
            if (tokens >= 1.0) {
                tokens -= 1.0;
                return true;
            }
            return false;
        }
    }
}
