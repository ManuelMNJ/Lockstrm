package com.lockstrm.platform.services;

import com.lockstrm.platform.exceptions.InvalidFileException;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.util.Set;

@Component
public class VideoMimeValidator {

    private static final Set<String> ALLOWED_EXTENSIONS =
            Set.of("mp4", "m4v", "mov", "webm", "mkv", "avi");

    private static final int HEADER_BYTES = 16;

    public String validateAndGetExtension(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new InvalidFileException("El archivo está vacío");
        }

        String contentType = file.getContentType();
        if (contentType == null || !contentType.toLowerCase().startsWith("video/")) {
            throw new InvalidFileException("El archivo debe ser un vídeo");
        }

        String original = file.getOriginalFilename();
        String ext = extractExtension(original);
        if (!ALLOWED_EXTENSIONS.contains(ext)) {
            throw new InvalidFileException(
                    "Extensión no permitida. Formatos aceptados: " + ALLOWED_EXTENSIONS);
        }

        byte[] header = readHeader(file);
        if (!matchesKnownVideoSignature(header)) {
            throw new InvalidFileException(
                    "El contenido del archivo no coincide con un vídeo válido");
        }
        return ext;
    }

    private String extractExtension(String filename) {
        if (filename == null) return "";
        String clean = filename.replace('\\', '/');
        int slash = clean.lastIndexOf('/');
        if (slash >= 0) clean = clean.substring(slash + 1);
        int dot = clean.lastIndexOf('.');
        if (dot < 0 || dot == clean.length() - 1) return "";
        return clean.substring(dot + 1).toLowerCase();
    }

    private byte[] readHeader(MultipartFile file) {
        byte[] buf = new byte[HEADER_BYTES];
        try (InputStream in = file.getInputStream()) {
            int read = in.readNBytes(buf, 0, HEADER_BYTES);
            if (read < 8) {
                throw new InvalidFileException("Archivo demasiado corto para ser un vídeo");
            }
        } catch (IOException e) {
            throw new InvalidFileException("No se pudo leer el archivo");
        }
        return buf;
    }

    private boolean matchesKnownVideoSignature(byte[] h) {
        // MP4 / MOV / M4V: bytes 4..7 == "ftyp"
        if (h[4] == 'f' && h[5] == 't' && h[6] == 'y' && h[7] == 'p') return true;
        // WebM / MKV (EBML): 1A 45 DF A3
        if ((h[0] & 0xFF) == 0x1A && (h[1] & 0xFF) == 0x45
                && (h[2] & 0xFF) == 0xDF && (h[3] & 0xFF) == 0xA3) return true;
        // AVI (RIFF....AVI ): "RIFF" + "AVI "
        if (h[0] == 'R' && h[1] == 'I' && h[2] == 'F' && h[3] == 'F'
                && h[8] == 'A' && h[9] == 'V' && h[10] == 'I' && h[11] == ' ') return true;
        return false;
    }
}
