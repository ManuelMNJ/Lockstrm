package com.lockstrm.platform.services;

import com.lockstrm.platform.dto.RegisterRequest;
import com.lockstrm.platform.entities.Group;
import com.lockstrm.platform.entities.User;
import com.lockstrm.platform.entities.Video;
import com.lockstrm.platform.exceptions.InvalidFileException;
import com.lockstrm.platform.repositories.GroupMemberRepository;
import com.lockstrm.platform.repositories.GroupPermissionRepository;
import com.lockstrm.platform.repositories.GroupRepository;
import com.lockstrm.platform.repositories.LogRepository;
import com.lockstrm.platform.repositories.UserRepository;
import com.lockstrm.platform.repositories.VideoRepository;
import com.lockstrm.platform.repositories.VideoViewRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.security.SecureRandom;
import java.util.List;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class UserService implements UserDetailsService {

    private static final SecureRandom TAG_RNG      = new SecureRandom();
    private static final int          TAG_MAX_INTENTOS = 20;
    private static final long         MAX_AVATAR_SIZE  = 5L * 1024 * 1024; // 5 MB

    @Value("${lockstrm.upload.avatars.dir}")
    private String avatarsDir;

    @Value("${lockstrm.upload.dir}")
    private String uploadDir;

    @Value("${lockstrm.upload.thumbnails.dir}")
    private String thumbnailsDir;

    private final UserRepository             userRepository;
    private final PasswordEncoder            passwordEncoder;
    private final VideoRepository            videoRepository;
    private final GroupRepository            grupoRepository;
    private final GroupMemberRepository      groupMemberRepository;
    private final GroupPermissionRepository  groupPermissionRepository;
    private final VideoViewRepository        videoViewRepository;
    private final LogRepository              logRepository;

    @Override
    public UserDetails loadUserByUsername(String email) throws UsernameNotFoundException {
        User usuario = userRepository.findByEmail(email)
                .orElseThrow(() -> new UsernameNotFoundException("User no encontrado: " + email));

        return org.springframework.security.core.userdetails.User.builder()
                .username(usuario.getEmail())
                .password(usuario.getPassword())
                .authorities("ROLE_USER")
                .build();
    }

    public User registrarUsuario(RegisterRequest request) {
        User nuevo = new User();
        nuevo.setNombre(request.getNombre());
        nuevo.setApellidos(request.getApellidos());
        nuevo.setUsername(request.getUsername());
        nuevo.setEmail(request.getEmail());
        nuevo.setPassword(passwordEncoder.encode(request.getPassword()));
        nuevo.setTag(generarTagLibre(request.getUsername()));
        return userRepository.save(nuevo);
    }

    private String generarTagLibre(String username) {
        for (int i = 0; i < TAG_MAX_INTENTOS; i++) {
            String candidato = String.format("%04d", TAG_RNG.nextInt(10000));
            if (!userRepository.existsByUsernameIgnoreCaseAndTag(username, candidato)) {
                return candidato;
            }
        }
        throw new com.lockstrm.platform.exceptions.BusinessException(
                "No se pudo asignar un tag único para este nombre de usuario");
    }

    public User buscarPorEmail(String email) {
        return userRepository.findByEmail(email).orElse(null);
    }

    public User buscarPorIdentificador(String identificador) {
        if (identificador == null || identificador.isBlank()) return null;
        String limpio = identificador.trim().toLowerCase();

        if (limpio.contains("@")) {
            return userRepository.findByEmail(limpio).orElse(null);
        }

        if (limpio.contains("#")) {
            String[] partes = limpio.split("#", 2);
            if (partes.length != 2 || partes[0].isBlank() || partes[1].length() != 4) {
                return null;
            }
            return userRepository.findByUsernameIgnoreCaseAndTag(partes[0], partes[1]).orElse(null);
        }

        return null;
    }

    public boolean emailDisponible(String email) {
        return !userRepository.existsByEmail(email);
    }

    /**
     * Quedan tags libres si el nº de usuarios con ese username es < 10000.
     * El tag se asigna aleatorio, así que solo interesa saber si el espacio (username, 0000-9999)
     * tiene algún hueco. Con un retry de 20 es prácticamente seguro encontrarlo mientras haya huecos.
     */
    public boolean usernameTieneTagLibre(String username) {
        if (username == null || username.isBlank()) return false;
        for (int i = 0; i < TAG_MAX_INTENTOS; i++) {
            String candidato = String.format("%04d", TAG_RNG.nextInt(10000));
            if (!userRepository.existsByUsernameIgnoreCaseAndTag(username, candidato)) {
                return true;
            }
        }
        return false;
    }

    @Transactional
    public User actualizarPerfil(String email, String nombre, String apellidos, String nuevoUsername) {
        User usuario = userRepository.findByEmail(email)
                .orElseThrow(() -> new UsernameNotFoundException("User no encontrado"));
        usuario.setNombre(nombre);
        usuario.setApellidos(apellidos);
        if (!usuario.getUsername().equalsIgnoreCase(nuevoUsername)) {
            usuario.setUsername(nuevoUsername);
            usuario.setTag(generarTagLibre(nuevoUsername));
        }
        return userRepository.save(usuario);
    }

    @Transactional
    public boolean actualizarEmail(String emailActual, String nuevoEmail, String passwordActual) {
        User usuario = userRepository.findByEmail(emailActual)
                .orElseThrow(() -> new UsernameNotFoundException("User no encontrado"));

        if (!passwordEncoder.matches(passwordActual, usuario.getPassword())) {
            return false; // contraseña incorrecta → el caller devuelve 400
        }
        String cleanEmail = nuevoEmail.toLowerCase().trim();
        if (!emailActual.equalsIgnoreCase(cleanEmail) && !emailDisponible(cleanEmail)) {
            throw new com.lockstrm.platform.exceptions.BusinessException("El email ya está registrado");
        }
        usuario.setEmail(cleanEmail);
        userRepository.save(usuario);
        return true;
    }

    @Transactional
    public boolean cambiarContrasena(String email, String actual, String nueva) {
        return userRepository.findByEmail(email)
                .filter(u -> passwordEncoder.matches(actual, u.getPassword()))
                .map(u -> {
                    u.setPassword(passwordEncoder.encode(nueva));
                    userRepository.save(u);
                    return true;
                })
                .orElse(false);
    }

    // ── Avatar ────────────────────────────────────────────────────────

    @Transactional
    public User actualizarAvatar(String email, MultipartFile file) throws IOException {
        validateImageFile(file);

        Path baseDir = Paths.get(avatarsDir).toAbsolutePath().normalize();
        Files.createDirectories(baseDir);

        String ext         = getImageExtension(file.getContentType());
        String newFileName = UUID.randomUUID() + "." + ext;
        Path   dest        = baseDir.resolve(newFileName);

        User usuario = userRepository.findByEmail(email)
                .orElseThrow(() -> new UsernameNotFoundException("User no encontrado"));

        // Eliminar avatar anterior si existe
        String oldFileName = usuario.getAvatarUrl();
        if (oldFileName != null && !oldFileName.isBlank()) {
            try {
                Files.deleteIfExists(baseDir.resolve(oldFileName).normalize());
            } catch (IOException ignored) { /* el archivo ya no existe, no es crítico */ }
        }

        file.transferTo(dest);
        usuario.setAvatarUrl(newFileName);
        return userRepository.save(usuario);
    }

    void validateImageFile(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new InvalidFileException("El archivo está vacío");
        }
        if (file.getSize() > MAX_AVATAR_SIZE) {
            throw new InvalidFileException("El avatar no puede superar 5 MB");
        }
        String ct = file.getContentType();
        if (ct == null || !ct.toLowerCase().startsWith("image/")) {
            throw new InvalidFileException("El archivo debe ser una imagen");
        }

        byte[] header = new byte[12];
        try (InputStream in = file.getInputStream()) {
            int read = in.readNBytes(header, 0, 12);
            if (read < 4) throw new InvalidFileException("El archivo es demasiado pequeño");
        } catch (IOException e) {
            throw new InvalidFileException("No se pudo leer el archivo");
        }
        if (!isValidImageHeader(header)) {
            throw new InvalidFileException("El contenido del archivo no es una imagen válida");
        }
    }

    private boolean isValidImageHeader(byte[] h) {
        // JPEG: FF D8 FF
        if ((h[0] & 0xFF) == 0xFF && (h[1] & 0xFF) == 0xD8 && (h[2] & 0xFF) == 0xFF) return true;
        // PNG: 89 50 4E 47
        if ((h[0] & 0xFF) == 0x89 && h[1] == 'P' && h[2] == 'N' && h[3] == 'G') return true;
        // GIF: GIF8
        if (h[0] == 'G' && h[1] == 'I' && h[2] == 'F' && h[3] == '8') return true;
        // WebP: RIFF????WEBP
        if (h.length >= 12 && h[0] == 'R' && h[1] == 'I' && h[2] == 'F' && h[3] == 'F'
                && h[8] == 'W' && h[9] == 'E' && h[10] == 'B' && h[11] == 'P') return true;
        return false;
    }

    String getImageExtension(String contentType) {
        if (contentType == null) return "jpg";
        return switch (contentType.toLowerCase()) {
            case "image/png"  -> "png";
            case "image/gif"  -> "gif";
            case "image/webp" -> "webp";
            default           -> "jpg";  // jpeg / jpg / fallback
        };
    }

    // ── Eliminar cuenta ───────────────────────────────────────────────

    /**
     * Elimina la cuenta del usuario y todos sus datos en cascada:
     *
     *  1. Vídeos propios — permisos de grupo, vistas, logs de sesión y archivos en disco.
     *  2. Grupos propios — logs históricos (grupoId → NULL para conservar el historial
     *     de otros miembros), membresías y permisos de vídeo del grupo.
     *  3. Membresías del usuario en grupos ajenos.
     *  4. Logs y vistas del usuario como espectador en vídeos de otros.
     *  5. Avatar del disco.
     *  6. Entidad User.
     *
     * Toda la operación corre en una sola transacción; si algo falla no queda
     * ningún dato parcialmente eliminado.
     */
    @Transactional
    public void eliminarCuenta(String email) {
        User usuario = userRepository.findByEmail(email)
                .orElseThrow(() -> new UsernameNotFoundException("User no encontrado: " + email));

        Long idUsuario    = usuario.getIdUsuario();
        Path videoBaseDir = Paths.get(uploadDir).toAbsolutePath().normalize();
        Path thumbBaseDir = Paths.get(thumbnailsDir).toAbsolutePath().normalize();

        // 1. Vídeos propiedad del usuario
        List<Video> videos = videoRepository.findByPropietario_Email(email);
        for (Video video : videos) {
            Long idVideo = video.getIdVideo();
            groupPermissionRepository.deleteByVideoId(idVideo);
            videoViewRepository.deleteByVideoId(idVideo);
            logRepository.deleteByVideoId(idVideo);
            videoRepository.delete(video);

            if (video.getFileName() != null) {
                try {
                    Files.deleteIfExists(videoBaseDir.resolve(video.getFileName()).normalize());
                } catch (IOException e) {
                    log.warn("No se pudo eliminar vídeo '{}': {}", video.getFileName(), e.getMessage());
                }
            }
            String thumbRaw = video.getMiniaturaUrl();
            if (thumbRaw != null && !thumbRaw.startsWith("data:")) {
                try {
                    Files.deleteIfExists(thumbBaseDir.resolve(thumbRaw).normalize());
                } catch (IOException e) {
                    log.warn("No se pudo eliminar miniatura '{}': {}", thumbRaw, e.getMessage());
                }
            }
        }

        // 2. Grupos creados por el usuario
        List<Group> grupos = grupoRepository.findByCreador_Email(email);
        for (Group grupo : grupos) {
            Long idGrupo = grupo.getIdGrupo();
            // SET NULL en logs para conservar el historial de otros miembros
            logRepository.nullifyGrupoId(idGrupo);
            groupMemberRepository.deleteByGrupoId(idGrupo);
            groupPermissionRepository.deleteByGrupoId(idGrupo);
            grupoRepository.delete(grupo);
        }

        // 3. Membresías del usuario en grupos ajenos
        groupMemberRepository.deleteByUsuarioId(idUsuario);

        // 4. Logs y vistas del usuario como espectador en vídeos de otros
        logRepository.deleteByUsuarioId(idUsuario);
        videoViewRepository.deleteByUsuarioId(idUsuario);

        // 5. Avatar del disco
        String avatarFileName = usuario.getAvatarUrl();
        if (avatarFileName != null && !avatarFileName.isBlank()) {
            Path avatarBaseDir = Paths.get(avatarsDir).toAbsolutePath().normalize();
            try {
                Files.deleteIfExists(avatarBaseDir.resolve(avatarFileName).normalize());
            } catch (IOException e) {
                log.warn("No se pudo eliminar avatar '{}': {}", avatarFileName, e.getMessage());
            }
        }

        // 6. Usuario
        userRepository.delete(usuario);
        log.info("Cuenta eliminada: {}", email);
    }
}
