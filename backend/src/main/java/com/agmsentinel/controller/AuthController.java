package com.agmsentinel.controller;

import com.agmsentinel.dto.Dtos.*;
import com.agmsentinel.security.JwtService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

/**
 * Demo auth: issues a JWT for an attendee or moderator. In production this would sit
 * behind the shareholder identity provider (OAuth2/MFA) — the JWT contract stays the same.
 */
@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final JwtService jwt;

    public AuthController(JwtService jwt) {
        this.jwt = jwt;
    }

    @PostMapping("/login")
    public TokenResponse login(@Valid @RequestBody LoginRequest req) {
        String role = "MODERATOR".equalsIgnoreCase(req.role()) ? "MODERATOR" : "ATTENDEE";
        return new TokenResponse(jwt.issue(req.username(), role));
    }
}
