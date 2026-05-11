package com.lockstrm.platform.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.util.Date;
import java.util.function.Function;

@Service
public class JwtService {

    /** Audience claim para tickets de streaming de vídeo. */
    public static final String STREAM_AUDIENCE = "stream";

    /** TTL del ticket de stream: suficiente para que el navegador inicie el <video src=...>. */
    private static final long STREAM_TICKET_TTL_MS = 60_000L;

    @Value("${jwt.secret}")
    private String secretKey;

    @Value("${jwt.expiration}")
    private long expirationMs;

    public String generateToken(UserDetails userDetails) {
        return Jwts.builder()
                .subject(userDetails.getUsername())
                .claim("cred", credFingerprint(userDetails.getPassword()))
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + expirationMs))
                .signWith(getSigningKey())
                .compact();
    }

    public String extractEmail(String token) {
        return extractClaim(token, Claims::getSubject);
    }

    public boolean isTokenValid(String token, UserDetails userDetails) {
        final String email      = extractEmail(token);
        final String tokenCred  = extractClaim(token, c -> c.get("cred", String.class));
        final String currentCred = credFingerprint(userDetails.getPassword());
        return email.equals(userDetails.getUsername())
                && !isTokenExpired(token)
                && currentCred.equals(tokenCred);
    }

    /** 16 chars del salt BCrypt (posiciones 7-23): identifica unívocamente el hash sin exponerlo. */
    private String credFingerprint(String bcryptHash) {
        if (bcryptHash == null || bcryptHash.length() < 23) return "";
        return bcryptHash.substring(7, 23);
    }

    // Tickets de streaming: el tag <video> no envía cabeceras, así que el token
    // viaja por query param. Para no exponer el JWT principal, emitimos un ticket
    // de 60 s con audiencia "stream" atado al fileName concreto.

    /** Genera un ticket firmado para reproducir un único vídeo durante 60 s. */
    public String generateStreamTicket(String email, String fileName) {
        return Jwts.builder()
                .subject(email)
                .audience().add(STREAM_AUDIENCE).and()
                .claim("file", fileName)
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + STREAM_TICKET_TTL_MS))
                .signWith(getSigningKey())
                .compact();
    }

    /** Valida un ticket de stream y devuelve el email asociado, o null si no es válido. */
    public String validateStreamTicket(String token, String fileName) {
        try {
            Claims c = Jwts.parser()
                    .verifyWith(getSigningKey())
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();
            if (c.getExpiration() == null || c.getExpiration().before(new Date())) return null;
            if (c.getAudience() == null || !c.getAudience().contains(STREAM_AUDIENCE)) return null;
            if (!fileName.equals(c.get("file", String.class))) return null;
            return c.getSubject();
        } catch (JwtException | IllegalArgumentException e) {
            return null;
        }
    }

    public long getStreamTicketTtlSeconds() {
        return STREAM_TICKET_TTL_MS / 1000L;
    }

    private boolean isTokenExpired(String token) {
        return extractClaim(token, Claims::getExpiration).before(new Date());
    }

    private <T> T extractClaim(String token, Function<Claims, T> claimsResolver) {
        Claims claims = Jwts.parser()
                .verifyWith(getSigningKey())
                .build()
                .parseSignedClaims(token)
                .getPayload();
        return claimsResolver.apply(claims);
    }

    private SecretKey getSigningKey() {
        byte[] keyBytes = Decoders.BASE64.decode(secretKey);
        return Keys.hmacShaKeyFor(keyBytes);
    }
}
