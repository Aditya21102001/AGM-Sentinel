package com.agmsentinel.service;

import com.agmsentinel.dto.Dtos.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;

import java.time.Duration;
import java.util.List;
import java.util.Map;

/** Thin HTTP client over the Python AI service (embedding, clustering, RAG). */
@Component
public class AiClient {

    private final WebClient web;

    public AiClient(@Value("${ai.service.url:http://localhost:8000}") String baseUrl) {
        this.web = WebClient.builder().baseUrl(baseUrl).build();
    }

    public IngestResult ingest(String questionId, String text, String attendeeId, float weight) {
        return web.post().uri("/ingest")
                .bodyValue(Map.of(
                        "question_id", questionId,
                        "text", text,
                        "attendee_id", attendeeId,
                        "weight", weight))
                .retrieve()
                .bodyToMono(IngestResult.class)
                .timeout(Duration.ofSeconds(30))   // generous: covers free-tier cold starts
                .block();
    }

    public DraftResult draft(String clusterId, String representativeQuestion) {
        return web.post().uri("/draft")
                .bodyValue(Map.of(
                        "cluster_id", clusterId,
                        "representative_question", representativeQuestion))
                .retrieve()
                .bodyToMono(DraftResult.class)
                .timeout(Duration.ofSeconds(60))
                .block();
    }

    public List<ClusterView> clusters(int limit) {
        return web.get().uri(uri -> uri.path("/clusters").queryParam("limit", limit).build())
                .retrieve()
                .bodyToFlux(ClusterView.class)
                .collectList()
                .timeout(Duration.ofSeconds(30))
                .block();
    }
}
