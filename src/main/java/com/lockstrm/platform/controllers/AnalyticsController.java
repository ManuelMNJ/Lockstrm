package com.lockstrm.platform.controllers;

import com.lockstrm.platform.dto.GlobalAnalyticsDto;
import com.lockstrm.platform.dto.VideoLogDto;
import com.lockstrm.platform.services.AnalyticsService;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDateTime;
import java.util.List;

@RestController
@RequestMapping("/api/analiticas")
@RequiredArgsConstructor
public class AnalyticsController {

    private final AnalyticsService analiticasService;

    @GetMapping("/globales")
    public ResponseEntity<GlobalAnalyticsDto> globales(
            @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(analiticasService.globales(userDetails.getUsername()));
    }

    @GetMapping("/videos/{idVideo}/logs")
    public ResponseEntity<List<VideoLogDto>> logsDelVideo(
            @PathVariable Long idVideo,
            @RequestParam(value = "grupoId", required = false) Long grupoId,
            @RequestParam(value = "desde", required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime desde,
            @RequestParam(value = "hasta", required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime hasta,
            @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(
                analiticasService.logsDelVideo(idVideo, userDetails.getUsername(), grupoId, desde, hasta));
    }
}
