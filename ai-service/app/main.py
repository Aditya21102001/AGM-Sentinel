"""FastAPI entrypoint for the AI service.

Endpoints (called by the Spring Boot backend over HTTP):
  GET  /health          liveness + readiness (used by UptimeRobot keep-warm)
  POST /ingest          embed + cluster one question, return its cluster assignment
  POST /draft           RAG-draft a grounded answer for a cluster
  GET  /clusters        current ranked cluster board

Design note: we expose HTTP so the system works on free tiers *without* a shared Redis.
The Redis Streams path (see consumer.py) is the production-scale ingest; flip QUEUE_MODE
to enable it. Both feed the same OnlineClusterer.
"""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .clustering import get_clusterer
from .embeddings import get_embeddings
from .rag import get_kb
from .schemas import (
    ClusterView, DraftRequest, DraftResponse, IngestRequest, IngestResponse,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Warm the heavy singletons at startup so the first request isn't slow.
    get_embeddings()
    get_kb()
    yield


app = FastAPI(title="AGM Sentinel — AI Service", version="1.0.0", lifespan=lifespan)

# Angular (Vercel) calls the backend, but allow direct CORS for local dev/testing.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.post("/ingest", response_model=IngestResponse)
def ingest(req: IngestRequest) -> IngestResponse:
    embedding = get_embeddings().embed_query(req.text)
    result = get_clusterer().assign(req.text, embedding, weight=req.weight)
    return IngestResponse(
        question_id=req.question_id,
        cluster_id=result.cluster.cluster_id,
        is_new_cluster=result.is_new,
        similarity=round(result.similarity, 4),
        cluster_size=result.cluster.size,
    )


@app.post("/draft", response_model=DraftResponse)
def draft(req: DraftRequest) -> DraftResponse:
    result = get_kb().draft(req.cluster_id, req.representative_question)
    # Cache the draft on the cluster so it rides along on the next /clusters board push.
    cluster = get_clusterer().get(req.cluster_id)
    if cluster is not None:
        cluster.draft = result.answer
    return result


@app.get("/clusters", response_model=list[ClusterView])
def clusters(limit: int = 20) -> list[ClusterView]:
    return [
        ClusterView(
            cluster_id=c.cluster_id,
            representative_question=c.representative_question,
            size=c.size,
            priority_score=round(c.priority_score, 4),
            draft=c.draft,
        )
        for c in get_clusterer().top(limit)
    ]
