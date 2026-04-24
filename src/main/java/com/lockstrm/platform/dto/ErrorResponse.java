package com.lockstrm.platform.dto;

import java.time.OffsetDateTime;
import java.util.Map;

public record ErrorResponse(
        OffsetDateTime timestamp,
        int status,
        String code,
        String message,
        String path,
        Map<String, String> campos
) {
    public static ErrorResponse of(int status, String code, String message, String path) {
        return new ErrorResponse(OffsetDateTime.now(), status, code, message, path, null);
    }

    public static ErrorResponse withFields(int status, String code, String message,
                                           String path, Map<String, String> campos) {
        return new ErrorResponse(OffsetDateTime.now(), status, code, message, path, campos);
    }
}
