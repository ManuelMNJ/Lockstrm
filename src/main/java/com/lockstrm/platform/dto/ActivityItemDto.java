package com.lockstrm.platform.dto;

import java.time.LocalDateTime;

public record ActivityItemDto(
        String icon,
        String text,
        LocalDateTime occurredAt
) {}
