package com.lockstrm.platform.exceptions;

import com.lockstrm.platform.dto.ErrorResponse;
import jakarta.servlet.http.HttpServletRequest;
import org.apache.catalina.connector.ClientAbortException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.multipart.MaxUploadSizeExceededException;

import java.util.HashMap;
import java.util.Map;
import java.util.NoSuchElementException;

@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    private ResponseEntity<ErrorResponse> build(HttpStatus status, String code, String message,
                                                HttpServletRequest req) {
        return ResponseEntity.status(status)
                .body(ErrorResponse.of(status.value(), code, message, req.getRequestURI()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleValidation(MethodArgumentNotValidException ex,
                                                          HttpServletRequest req) {
        Map<String, String> campos = new HashMap<>();
        String primerMensaje = null;
        for (FieldError fe : ex.getBindingResult().getFieldErrors()) {
            campos.put(fe.getField(), fe.getDefaultMessage());
            if (primerMensaje == null) primerMensaje = fe.getDefaultMessage();
        }
        // Usamos el primer mensaje específico como `message` para que el
        // frontend lo pueda mostrar directamente; los detalles por campo van en `campos`.
        String message = primerMensaje != null ? primerMensaje : "Datos de entrada inválidos";
        return ResponseEntity.badRequest().body(ErrorResponse.withFields(
                400, "VALIDATION_ERROR", message,
                req.getRequestURI(), campos));
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ErrorResponse> handleAccessDenied(AccessDeniedException ex,
                                                            HttpServletRequest req) {
        return build(HttpStatus.FORBIDDEN, "FORBIDDEN",
                "No tienes permiso para realizar esta acción", req);
    }

    @ExceptionHandler(BadCredentialsException.class)
    public ResponseEntity<ErrorResponse> handleBadCredentials(BadCredentialsException ex,
                                                              HttpServletRequest req) {
        return build(HttpStatus.UNAUTHORIZED, "INVALID_CREDENTIALS",
                "Credenciales incorrectas", req);
    }

    @ExceptionHandler(NoSuchElementException.class)
    public ResponseEntity<ErrorResponse> handleNotFound(RuntimeException ex,
                                                        HttpServletRequest req) {
        return build(HttpStatus.NOT_FOUND, "NOT_FOUND",
                ex.getMessage() != null ? ex.getMessage() : "Recurso no encontrado", req);
    }

    @ExceptionHandler(BusinessException.class)
    public ResponseEntity<ErrorResponse> handleBusiness(BusinessException ex,
                                                        HttpServletRequest req) {
        return build(HttpStatus.BAD_REQUEST, "BUSINESS_ERROR",
                ex.getMessage(), req);
    }

    @ExceptionHandler(InvalidFileException.class)
    public ResponseEntity<ErrorResponse> handleInvalidFile(InvalidFileException ex,
                                                           HttpServletRequest req) {
        return build(HttpStatus.BAD_REQUEST, "INVALID_FILE", ex.getMessage(), req);
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ErrorResponse> handleIllegalArgument(IllegalArgumentException ex,
                                                               HttpServletRequest req) {
        return build(HttpStatus.BAD_REQUEST, "INVALID_ARGUMENT",
                ex.getMessage() != null ? ex.getMessage() : "Argumento inválido", req);
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<ErrorResponse> handleMaxUpload(MaxUploadSizeExceededException ex,
                                                         HttpServletRequest req) {
        return build(HttpStatus.PAYLOAD_TOO_LARGE, "FILE_TOO_LARGE",
                "El archivo excede el tamaño máximo permitido", req);
    }

    /**
     * El cliente cerró la conexión a mitad de la transferencia (seek de vídeo,
     * cambio de src, navegación, cierre de pestaña). Es comportamiento normal
     * en streaming HTTP 206; no es un error del servidor. Devolvemos null
     * para que Spring no intente serializar nada — la respuesta ya está
     * comprometida con Content-Type del recurso (p. ej. video/mp4) y escribir
     * un JSON encima fallaría con HttpMessageNotWritableException.
     */
    @ExceptionHandler(ClientAbortException.class)
    public ResponseEntity<Void> handleClientAbort(ClientAbortException ex, HttpServletRequest req) {
        log.debug("Client aborted connection at {} {}", req.getMethod(), req.getRequestURI());
        return null;
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleGeneric(Exception ex, HttpServletRequest req) {
        log.error("Unhandled exception at {} {}: {}", req.getMethod(), req.getRequestURI(),
                ex.getMessage(), ex);
        return build(HttpStatus.INTERNAL_SERVER_ERROR, "INTERNAL_ERROR",
                "Error interno del servidor", req);
    }
}
