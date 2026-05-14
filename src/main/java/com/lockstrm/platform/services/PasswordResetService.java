package com.lockstrm.platform.services;

import com.lockstrm.platform.entities.PasswordResetToken;
import com.lockstrm.platform.entities.User;
import com.lockstrm.platform.repositories.PasswordResetTokenRepository;
import com.lockstrm.platform.repositories.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
public class PasswordResetService {

    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    private final PasswordResetTokenRepository tokenRepository;
    private final UserRepository               userRepository;
    private final PasswordEncoder              passwordEncoder;
    private final JavaMailSender               mailSender;

    @Value("${lockstrm.mail.from}")
    private String mailFrom;

    @Value("${lockstrm.app.url}")
    private String appUrl;

    @Value("${lockstrm.reset-token.expiry-minutes}")
    private int expiryMinutes;

    @Transactional
    public void solicitarReset(String email) {
        // Respuesta siempre positiva para no revelar si el email existe
        String emailNorm = email == null ? null : email.trim().toLowerCase();
        if (emailNorm == null || emailNorm.isBlank()) return;
        Optional<User> optUser = userRepository.findByEmail(emailNorm);
        if (optUser.isEmpty()) {
            log.debug("Reset solicitado para email no registrado: {}", emailNorm);
            return;
        }

        User user = optUser.get();

        // Limpiar tokens anteriores del usuario
        tokenRepository.deleteByUsuarioId(user.getIdUsuario());
        tokenRepository.deleteExpired(LocalDateTime.now());

        // El token RAW solo viaja por correo. En BBDD guardamos su hash SHA-256
        // para que una filtración de la tabla no permita secuestrar cuentas.
        String rawToken = generarToken();
        PasswordResetToken prt = new PasswordResetToken();
        prt.setToken(hashToken(rawToken));
        prt.setUsuario(user);
        prt.setExpiraEn(LocalDateTime.now().plusMinutes(expiryMinutes));
        tokenRepository.save(prt);

        enviarCorreo(user, rawToken);
    }

    @Transactional
    public void confirmarReset(String token, String nuevaContrasena) {
        PasswordResetToken prt = tokenRepository.findByToken(hashToken(token))
                .orElseThrow(() -> new com.lockstrm.platform.exceptions.BusinessException("Token inválido o expirado."));

        if (prt.isUsado()) {
            throw new com.lockstrm.platform.exceptions.BusinessException("Este enlace ya fue utilizado.");
        }
        if (prt.getExpiraEn().isBefore(LocalDateTime.now())) {
            throw new com.lockstrm.platform.exceptions.BusinessException("El enlace ha expirado. Solicita uno nuevo.");
        }

        User user = prt.getUsuario();
        user.setPassword(passwordEncoder.encode(nuevaContrasena));
        userRepository.save(user);

        prt.setUsado(true);
        tokenRepository.save(prt);
    }

    private void enviarCorreo(User user, String token) {
        String enlace = appUrl + "/nueva-contrasena?token=" + token;
        String nombre = user.getNombreCompleto();

        SimpleMailMessage msg = new SimpleMailMessage();
        msg.setFrom(mailFrom);
        msg.setTo(user.getEmail());
        msg.setSubject("Restablecer contraseña — Lockstrm");
        msg.setText(
            "Hola " + nombre + ",\n\n" +
            "Recibimos una solicitud para restablecer tu contraseña en Lockstrm.\n\n" +
            "Haz clic en el siguiente enlace para crear una nueva contraseña:\n" +
            enlace + "\n\n" +
            "Este enlace es válido durante " + expiryMinutes + " minutos.\n\n" +
            "Si no solicitaste este cambio, puedes ignorar este correo.\n\n" +
            "— Equipo Lockstrm"
        );

        try {
            mailSender.send(msg);
            log.info("Correo de reset enviado a {}", user.getEmail());
        } catch (Exception e) {
            log.error("No se pudo enviar correo de reset a {}: {}", user.getEmail(), e.getMessage());
            // No relanzamos: el usuario verá "si el email existe recibirás un correo"
        }
    }

    private static String generarToken() {
        byte[] bytes = new byte[48];
        SECURE_RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    /** SHA-256 en hex (64 chars). Cabe en la columna `token VARCHAR(64)`. */
    private static String hashToken(String raw) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] digest = md.digest(raw.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException e) {
            // SHA-256 está garantizado por la JVM (JEP 290); si falta, el entorno está roto.
            throw new IllegalStateException("SHA-256 no disponible en la JVM", e);
        }
    }
}
