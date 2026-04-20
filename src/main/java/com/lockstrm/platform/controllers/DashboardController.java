package com.lockstrm.platform.controllers;

import com.lockstrm.platform.dto.DashboardStatsDTO;
import com.lockstrm.platform.services.StatsService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/dashboard")
@RequiredArgsConstructor
public class DashboardController {

    private final StatsService statsService;

    @GetMapping("/stats")
    public ResponseEntity<DashboardStatsDTO> getStats(
            @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(statsService.getDashboardStats(userDetails.getUsername()));
    }
}
