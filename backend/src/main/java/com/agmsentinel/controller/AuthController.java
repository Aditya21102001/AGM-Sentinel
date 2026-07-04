package com.agmsentinel.controller;

import com.agmsentinel.dto.AuthDtos.*;
import com.agmsentinel.security.JwtService;
import com.agmsentinel.service.AuthService;
import jakarta.validation.Valid;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

/**
 * Authentication + MFA.
 *
 * Attendees stay anonymous (a light token, no password). Moderators/admins register with a
 * password and then enroll second factors (PIN, TOTP, passkey); login becomes staged MFA.
 */
@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService auth;
    private final JwtService jwt;

    public AuthController(AuthService auth, JwtService jwt) {
        this.auth = auth;
        this.jwt = jwt;
    }

    // ---- attendee (anonymous) ----------------------------------------------
    @PostMapping("/attendee")
    public TokenResponse attendee(@Valid @RequestBody AttendeeRequest req) {
        return new TokenResponse(jwt.issue(req.username(), "ATTENDEE"));
    }

    // ---- register / password login -----------------------------------------
    @PostMapping("/register")
    public LoginResult register(@Valid @RequestBody RegisterRequest req) {
        return auth.register(req);
    }

    @PostMapping("/login")
    public LoginResult login(@Valid @RequestBody LoginRequest req) {
        return auth.login(req);
    }

    @PostMapping("/mfa/verify")
    public TokenResponse verifyMfa(@Valid @RequestBody MfaVerifyRequest req) {
        return auth.verifyMfa(req);
    }

    // ---- enrollment (requires a full access token) --------------------------
    @GetMapping("/enroll/status")
    public MfaStatus status(Authentication authn) {
        return auth.status(authn.getName());
    }

    @PostMapping("/enroll/pin")
    public MfaStatus setPin(Authentication authn, @Valid @RequestBody SetPinRequest req) {
        auth.setPin(authn.getName(), req.pin());
        return auth.status(authn.getName());
    }

    @PostMapping("/enroll/totp/init")
    public TotpInitResult initTotp(Authentication authn) {
        return auth.initTotp(authn.getName());
    }

    @PostMapping("/enroll/totp/enable")
    public MfaStatus enableTotp(Authentication authn, @Valid @RequestBody TotpEnableRequest req) {
        auth.enableTotp(authn.getName(), req.code());
        return auth.status(authn.getName());
    }

    // ---- WebAuthn passkey enrollment (logged-in) ----------------------------
    @PostMapping(value = "/enroll/webauthn/start", produces = "application/json")
    public String webauthnEnrollStart(Authentication authn) {
        return auth.webAuthnEnrollStart(authn.getName());
    }

    @PostMapping("/enroll/webauthn/finish")
    public MfaStatus webauthnEnrollFinish(Authentication authn, @Valid @RequestBody WebAuthnRegFinish req) {
        return auth.webAuthnEnrollFinish(authn.getName(), req.credential().toString());
    }

    // ---- WebAuthn passkey login (public, via MFA challenge) -----------------
    @PostMapping(value = "/mfa/webauthn/start", produces = "application/json")
    public String webauthnLoginStart(@Valid @RequestBody WebAuthnLoginStart req) {
        return auth.webAuthnLoginStart(req.mfaToken());
    }

    @PostMapping("/mfa/webauthn/finish")
    public TokenResponse webauthnLoginFinish(@Valid @RequestBody WebAuthnLoginFinish req) {
        return auth.webAuthnLoginFinish(req.mfaToken(), req.credential().toString());
    }
}
