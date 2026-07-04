package com.agmsentinel.config;

import com.agmsentinel.security.JwtAuthFilter;
import jakarta.servlet.DispatcherType;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.*;

import java.util.List;

@Configuration
public class SecurityConfig {

    private final JwtAuthFilter jwtAuthFilter;

    public SecurityConfig(JwtAuthFilter jwtAuthFilter) {
        this.jwtAuthFilter = jwtAuthFilter;
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .csrf(AbstractHttpConfigurer::disable)
            .cors(cors -> cors.configurationSource(corsSource()))
            .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                // Let internal ERROR forwards render (so a thrown 401 stays 401, not 403).
                .dispatcherTypeMatchers(DispatcherType.ERROR).permitAll()
                // Enrollment needs a full access token (more specific → declared first).
                .requestMatchers("/api/auth/enroll/**").hasAnyRole("MODERATOR", "ADMIN")
                // Public auth endpoints: attendee token, register, password login, MFA verify, WebAuthn ceremony.
                .requestMatchers("/api/auth/**", "/ws/**", "/actuator/health", "/health").permitAll()
                .requestMatchers("/api/source/**").permitAll()   // PDF opened in a new tab (no auth header)
                .requestMatchers("/api/questions/**").hasAnyRole("ATTENDEE", "MODERATOR")
                .requestMatchers("/api/clusters/**").hasRole("MODERATOR")
                .requestMatchers("/api/admin/**").hasRole("MODERATOR")
                .anyRequest().authenticated())
            .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }

    /** BCrypt for password + PIN hashing. */
    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    /** Allow the Vercel-hosted Angular app (any origin in dev) to call the API. */
    @Bean
    public CorsConfigurationSource corsSource() {
        CorsConfiguration cfg = new CorsConfiguration();
        cfg.setAllowedOriginPatterns(List.of("*"));   // tighten to your Vercel domain in prod
        cfg.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS"));
        cfg.setAllowedHeaders(List.of("*"));
        cfg.setAllowCredentials(true);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", cfg);
        return source;
    }
}
