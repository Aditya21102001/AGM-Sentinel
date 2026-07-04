package com.agmsentinel.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * How an OTP code is delivered. The default implementation just logs (used when
 * otp.demo-mode=true, or as a safe fallback). To send real messages, provide another
 * {@code OtpDelivery} bean (e.g. a Gmail-SMTP email sender or an SMS-gateway client) —
 * Spring will inject it in place of this one.
 */
public interface OtpDelivery {
    void send(String channel, String destination, String code);
}

@Component
class LoggingOtpDelivery implements OtpDelivery {
    private static final Logger log = LoggerFactory.getLogger(LoggingOtpDelivery.class);

    @Override
    public void send(String channel, String destination, String code) {
        // Real providers plug in here. Never log codes in a real deployment.
        log.info("[OTP delivery:{}] would send code {} to {}", channel, code, destination);
    }
}
