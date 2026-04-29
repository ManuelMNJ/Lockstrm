package com.lockstrm.platform.controllers;

import com.lockstrm.platform.dto.ChangePasswordRequest;
import com.lockstrm.platform.dto.UpdatePerfilRequest;
import com.lockstrm.platform.entities.User;
import com.lockstrm.platform.services.UserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.MediaTypeFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.NoSuchElementException;

@RestController
@RequestMapping("/api/usuarios")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    @Value("${lockstrm.upload.avatars.dir}")
    private String avatarsDir;

    // ── Perfil ────────────────────────────────────────────────────────

    @GetMapping("/perfil")
    public ResponseEntity<Map<String, Object>> obtenerPerfil(
            @AuthenticationPrincipal UserDetails userDetails) {

        User usuario = userService.buscarPorEmail(userDetails.getUsername());
        if (usuario == null) return ResponseEntity.notFound().build();

        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("nombre",        usuario.getNombre()        != null ? usuario.getNombre()        : "");
        resp.put("apellidos",     usuario.getApellidos()     != null ? usuario.getApellidos()     : "");
        resp.put("username",      usuario.getUsername()      != null ? usuario.getUsername()      : "");
        resp.put("tag",           usuario.getTag()           != null ? usuario.getTag()           : "");
        resp.put("email",         usuario.getEmail());
        resp.put("fechaRegistro", usuario.getFechaRegistro());
        resp.put("avatarUrl",     resolveAvatarUrl(usuario.getAvatarUrl()));
        return ResponseEntity.ok(resp);
    }

    @PutMapping("/perfil")
    public ResponseEntity<Map<String, Object>> actualizarPerfil(
            @AuthenticationPrincipal UserDetails userDetails,
            @Valid @RequestBody UpdatePerfilRequest body) {

        User usuario = userService.actualizarPerfil(
                userDetails.getUsername(), body.getNombre(), body.getApellidos(), body.getUsername());

        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("nombre",    usuario.getNombre()    != null ? usuario.getNombre()    : "");
        resp.put("apellidos", usuario.getApellidos() != null ? usuario.getApellidos() : "");
        resp.put("username",  usuario.getUsername()  != null ? usuario.getUsername()  : "");
        resp.put("tag",       usuario.getTag()       != null ? usuario.getTag()       : "");
        resp.put("avatarUrl", resolveAvatarUrl(usuario.getAvatarUrl()));
        return ResponseEntity.ok(resp);
    }

    // ── Avatar ────────────────────────────────────────────────────────

    @PostMapping(value = "/avatar", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Map<String, String>> subirAvatar(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestParam("file") MultipartFile file) throws IOException {

        User usuario   = userService.actualizarAvatar(userDetails.getUsername(), file);
        String avatarUrl = resolveAvatarUrl(usuario.getAvatarUrl());
        Map<String, String> resp = new LinkedHashMap<>();
        resp.put("avatarUrl", avatarUrl);
        return ResponseEntity.ok(resp);
    }

    /**
     * Sirve los avatares directamente sin autenticación (igual que las miniaturas de vídeo)
     * para que {@code <img>} los cargue sin enviar Authorization header.
     * Se valida path traversal con {@code filePath.startsWith(baseDir)}.
     */
    @GetMapping("/avatars/{fileName:.+}")
    public ResponseEntity<Resource> serveAvatar(@PathVariable String fileName) throws IOException {
        Path baseDir  = Paths.get(avatarsDir).toAbsolutePath().normalize();
        Path filePath = baseDir.resolve(fileName).normalize();
        if (!filePath.startsWith(baseDir)) {
            return ResponseEntity.badRequest().build();
        }
        UrlResource resource = new UrlResource(filePath.toUri());
        if (!resource.exists() || !resource.isReadable()) {
            throw new NoSuchElementException("Avatar no encontrado: " + fileName);
        }
        MediaType mediaType = MediaTypeFactory.getMediaType(resource)
                .orElse(MediaType.IMAGE_JPEG);
        return ResponseEntity.ok()
                .contentType(mediaType)
                .header(HttpHeaders.CACHE_CONTROL, "public, max-age=604800")
                .body(resource);
    }

    // ── Contraseña ────────────────────────────────────────────────────

    @PostMapping("/cambiar-contrasena")
    public ResponseEntity<Map<String, String>> cambiarContrasena(
            @AuthenticationPrincipal UserDetails userDetails,
            @Valid @RequestBody ChangePasswordRequest body) {

        boolean ok = userService.cambiarContrasena(
                userDetails.getUsername(), body.getActual(), body.getNueva());
        if (!ok) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "La contraseña actual no es correcta"));
        }
        return ResponseEntity.ok(Map.of("mensaje", "Contraseña actualizada correctamente"));
    }

    // ── Helpers ───────────────────────────────────────────────────────

    private static String resolveAvatarUrl(String fileName) {
        if (fileName == null || fileName.isBlank()) return null;
        return "/api/usuarios/avatars/" + fileName;
    }
}
