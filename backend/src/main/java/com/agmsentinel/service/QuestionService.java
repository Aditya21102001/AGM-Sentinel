package com.agmsentinel.service;

import com.agmsentinel.dto.Dtos.*;
import com.agmsentinel.model.Question;
import com.agmsentinel.repository.QuestionRepository;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

/**
 * Orchestrates the ingest pipeline:
 *   persist question -> AI cluster assignment -> store cluster id -> push live board.
 *
 * Draft generation is triggered when a cluster gets "hot" (crosses a size threshold) or
 * on explicit moderator request, keeping bounded/free LLM usage focused on what matters.
 */
@Service
public class QuestionService {

    private static final int HOT_CLUSTER_THRESHOLD = 3;   // auto-draft once N people ask the same thing

    private final QuestionRepository questions;
    private final AiClient ai;
    private final SimpMessagingTemplate broker;

    public QuestionService(QuestionRepository questions, AiClient ai, SimpMessagingTemplate broker) {
        this.questions = questions;
        this.ai = ai;
        this.broker = broker;
    }

    public IngestResult submit(SubmitQuestionRequest req) {
        Question q = questions.save(new Question(req.text(), req.attendeeId(), req.weight()));

        IngestResult result = ai.ingest(q.getId().toString(), req.text(), req.attendeeId(), req.weight());
        q.setClusterId(UUID.fromString(result.cluster_id()));
        questions.save(q);

        // Auto-draft a grounded answer for freshly-hot clusters (fire-and-forget-ish).
        if (result.cluster_size() == HOT_CLUSTER_THRESHOLD) {
            try {
                ai.draft(result.cluster_id(), req.text());
            } catch (Exception ignored) {
                // Drafting is best-effort; never fail an attendee's submission because of it.
            }
        }

        broadcastBoard();
        return result;
    }

    /** Push the current ranked, deduplicated board to all subscribed moderators. */
    public void broadcastBoard() {
        List<ClusterView> board = ai.clusters(20);
        broker.convertAndSend("/topic/board", new BoardUpdate("board", board));
    }

    public DraftResult draftFor(String clusterId, String representativeQuestion) {
        DraftResult draft = ai.draft(clusterId, representativeQuestion);
        broadcastBoard();
        return draft;
    }
}
