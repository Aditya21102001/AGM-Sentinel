"""RAG: draft a grounded, cited answer to a cluster's representative question.

Knowledge base = the company's annual report (PDF), chunked and embedded once at startup.
We keep it simple and free: FAISS in-memory index (no external vector DB needed for the KB).
Retrieval feeds a LangChain prompt -> free LLM (Groq/Gemini) -> answer + citations.
"""
from __future__ import annotations
import os
from pathlib import Path

from langchain_community.vectorstores import FAISS
from langchain_core.documents import Document
from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate
from langchain_text_splitters import RecursiveCharacterTextSplitter
from pypdf import PdfReader

from .embeddings import get_embeddings
from .llm import get_llm
from .schemas import Citation, DraftResponse

_KB_DIR = Path(__file__).resolve().parent.parent / "knowledge"

_PROMPT = ChatPromptTemplate.from_messages([
    ("system",
     "You are an AGM assistant drafting a concise L1 answer for a company moderator. "
     "Answer ONLY from the provided context excerpts of the annual report. "
     "If the context does not contain the answer, say you cannot find it in the report "
     "and recommend escalation. Keep it under 120 words. Do not invent figures."),
    ("human",
     "Shareholder question (representative of a cluster):\n{question}\n\n"
     "Annual-report context:\n{context}\n\nDraft answer:"),
])


class KnowledgeBase:
    """FAISS index over the annual report. Rebuilt on startup from PDFs in ai-service/knowledge/."""

    def __init__(self):
        self._store: FAISS | None = None
        self._chain = None

    def load(self) -> None:
        docs = self._load_documents()
        embeddings = get_embeddings()
        if docs:
            self._store = FAISS.from_documents(docs, embeddings)
        else:
            # Empty KB fallback so the service still boots without a PDF present.
            self._store = FAISS.from_documents(
                [Document(page_content="No annual report loaded.", metadata={"source": "none"})],
                embeddings,
            )
        # Note: the LLM chain is built lazily (see _get_chain) so the service boots and can
        # embed/cluster WITHOUT an LLM API key. Only /draft needs the key.

    def _get_chain(self):
        if self._chain is None:
            self._chain = _PROMPT | get_llm() | StrOutputParser()
        return self._chain

    def _load_documents(self) -> list[Document]:
        docs: list[Document] = []
        if not _KB_DIR.exists():
            return docs
        splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=150)
        for pdf in _KB_DIR.glob("*.pdf"):
            reader = PdfReader(str(pdf))
            for page_no, page in enumerate(reader.pages, start=1):
                text = (page.extract_text() or "").strip()
                if not text:
                    continue
                for chunk in splitter.split_text(text):
                    docs.append(Document(
                        page_content=chunk,
                        metadata={"source": f"{pdf.name} p.{page_no}"},
                    ))
        return docs

    def draft(self, cluster_id: str, question: str, k: int = 4) -> DraftResponse:
        assert self._store is not None, "KB not loaded"
        hits = self._store.similarity_search(question, k=k)
        context = "\n\n".join(f"[{d.metadata.get('source')}] {d.page_content}" for d in hits)
        answer = self._get_chain().invoke({"question": question, "context": context})
        citations = [
            Citation(source=d.metadata.get("source", "unknown"), snippet=d.page_content[:180])
            for d in hits
        ]
        return DraftResponse(cluster_id=cluster_id, answer=answer.strip(), citations=citations)


_kb: KnowledgeBase | None = None


def get_kb() -> KnowledgeBase:
    global _kb
    if _kb is None:
        _kb = KnowledgeBase()
        _kb.load()
    return _kb
