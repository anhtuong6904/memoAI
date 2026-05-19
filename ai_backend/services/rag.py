"""
services/rag.py — LangChain RAG pipeline (fully local)

Fixes applied:
  #5  Incremental embedding — chỉ embed notes thay đổi (cột embedded_at)
  #6  HuggingFaceEmbeddings trực tiếp thay Ollama HTTP (5-10x nhanh hơn)
  #7  Chroma thay FAISS — hỗ trợ delete by note_id native

Stack:
  Embedding  : BAAI/bge-m3 via sentence-transformers (GPU nếu có)
  Retrieval  : Hybrid BM25 (keyword) + Chroma (semantic), ensemble 40/60
  Reranking  : BAAI/bge-reranker-v2-m3 cross-encoder (CPU, lazy load)
  Generation : qwen3:8b via Ollama

Setup (chạy 1 lần):
  pip install sentence-transformers chromadb langchain-chroma
"""

import json
import logging
import threading
from datetime import datetime
from pathlib import Path

from langchain_community.retrievers import BM25Retriever
from langchain_core.documents import Document
from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_ollama import ChatOllama
from langchain_text_splitters import RecursiveCharacterTextSplitter

logger = logging.getLogger(__name__)

CHROMA_PATH   = str(Path(__file__).parent.parent / "chroma_db")
EMBED_MODEL   = "BAAI/bge-m3"
CHAT_MODEL    = "qwen3:8b"
RERANKER_MODEL = "BAAI/bge-reranker-v2-m3"

RETRIEVAL_K  = 20
RERANKER_TOP = 5

# Fix #6: HuggingFace embeddings — lazy load, không chạy lúc import
_embeddings_instance = None
_embeddings_lock = threading.Lock()


def _get_device() -> str:
    """Detect CUDA an toàn — tránh crash khi torch là CPU-only build."""
    try:
        import torch
        if torch.cuda.is_available():
            torch.tensor([1.0]).cuda()  # thử thực sự để xác nhận
            return "cuda"
    except Exception:
        pass
    return "cpu"


def _get_embeddings() -> HuggingFaceEmbeddings:
    """Lazy load — chỉ khởi tạo khi cần, không block lúc import."""
    global _embeddings_instance
    if _embeddings_instance is None:
        with _embeddings_lock:
            if _embeddings_instance is None:
                device = _get_device()
                logger.info("[RAG] embedding device: %s", device)
                _embeddings_instance = HuggingFaceEmbeddings(
                    model_name=EMBED_MODEL,
                    model_kwargs={"device": device},
                    encode_kwargs={
                        "batch_size": 32 if device == "cuda" else 8,
                        "normalize_embeddings": True,
                    },
                )
    return _embeddings_instance

text_splitter = RecursiveCharacterTextSplitter(
    chunk_size=1000,
    chunk_overlap=200,
    add_start_index=True,
    strip_whitespace=True,
    separators=["\n\n", "\n", " ", ""],
)

RAG_PROMPT = """Bạn là trợ lý AI của ứng dụng MemoAI. Trả lời câu hỏi dựa trên ghi chú của người dùng.

Quy tắc:
1. Chỉ dùng thông tin từ Ngữ cảnh bên dưới
2. Nếu không tìm thấy, trả lời: "Tôi không tìm thấy thông tin này trong ghi chú của bạn."
3. Trả lời bằng tiếng Việt, ngắn gọn, rõ ràng
4. Có thể trích dẫn tiêu đề ghi chú nguồn nếu phù hợp

Ngữ cảnh (từ ghi chú của bạn):
{context}
{history}
Câu hỏi: {question}

Trả lời:"""

_index_lock  = threading.Lock()
_reranker    = None
_reranker_lk = threading.Lock()

# Debounce state — trailing debounce via threading.Timer
_rebuild_timer: "threading.Timer | None" = None
_rebuild_lock   = threading.Lock()

# ── Chroma singleton ───────────────────────────────────────────────────────────
# Tạo 1 lần, tái dùng cho mọi query — tránh reconnect DB + load embedding mỗi call.

_chroma_instance = None
_chroma_lock     = threading.Lock()


def _get_chroma():
    global _chroma_instance
    if _chroma_instance is None:
        with _chroma_lock:
            if _chroma_instance is None:
                from langchain_chroma import Chroma
                _chroma_instance = Chroma(
                    persist_directory=CHROMA_PATH,
                    embedding_function=_get_embeddings(),
                    collection_name="memoai_notes",
                )
                logger.info("[RAG] Chroma singleton created")
    return _chroma_instance


def _reset_chroma_singleton() -> None:
    """Gọi sau khi xóa/rebuild để force reconnect (tránh stale handle)."""
    global _chroma_instance
    with _chroma_lock:
        _chroma_instance = None


def index_exists() -> bool:
    return Path(CHROMA_PATH).exists()


# ── BM25 cache ─────────────────────────────────────────────────────────────────
# Xây BM25 1 lần sau mỗi rebuild, tái dùng cho mọi query.
# Invalidate khi index thay đổi (rebuild / delete).

import time as _time

_bm25_cache      = None
_bm25_cache_time = 0.0
_bm25_cache_lock = threading.Lock()
BM25_TTL         = 300.0   # 5 phút — tự invalidate nếu quên gọi _invalidate_bm25


def _invalidate_bm25() -> None:
    global _bm25_cache
    with _bm25_cache_lock:
        _bm25_cache = None
    logger.debug("[RAG] BM25 cache invalidated")


def _get_bm25(store) -> "BM25Retriever | None":
    """Trả về BM25Retriever đã build, dùng cache nếu còn hạn."""
    global _bm25_cache, _bm25_cache_time
    now = _time.monotonic()
    with _bm25_cache_lock:
        if _bm25_cache is not None and (now - _bm25_cache_time) < BM25_TTL:
            return _bm25_cache
    # Build ngoài lock để không block query khác quá lâu
    try:
        all_docs_result = store.get(include=["documents", "metadatas"])
        all_docs = [
            Document(page_content=doc, metadata=meta)
            for doc, meta in zip(
                all_docs_result["documents"],
                all_docs_result["metadatas"],
            )
        ]
        if not all_docs:
            return None
        retriever = BM25Retriever.from_documents(all_docs, k=RETRIEVAL_K)
        with _bm25_cache_lock:
            _bm25_cache      = retriever
            _bm25_cache_time = _time.monotonic()
        logger.info("[RAG] BM25 cache built (%d docs)", len(all_docs))
        return retriever
    except Exception as e:
        logger.warning("[RAG] BM25 build failed: %s", e)
        return None


# ── Module-level LLM chain (tạo 1 lần, không new mỗi query) ───────────────────

_rag_prompt = ChatPromptTemplate.from_template(RAG_PROMPT)
_rag_llm    = ChatOllama(model=CHAT_MODEL, temperature=0, num_predict=2048)
_rag_chain  = _rag_prompt | _rag_llm | StrOutputParser()


# ── Reranker ───────────────────────────────────────────────────────────────────

def _get_reranker():
    global _reranker
    if _reranker is None:
        with _reranker_lk:
            if _reranker is None:
                try:
                    from sentence_transformers import CrossEncoder
                    _reranker = CrossEncoder(RERANKER_MODEL, max_length=512)
                    logger.info("[RAG] reranker loaded: %s", RERANKER_MODEL)
                except Exception as e:
                    logger.warning("[RAG] reranker unavailable: %s", e)
                    _reranker = False
    return _reranker if _reranker else None


def _rerank(question: str, docs: list[Document]) -> list[Document]:
    if not docs:
        return docs
    reranker = _get_reranker()
    if reranker is None:
        return docs[:RERANKER_TOP]
    try:
        pairs  = [(question, d.page_content) for d in docs]
        scores = reranker.predict(pairs)
        ranked = sorted(range(len(scores)), key=lambda i: scores[i], reverse=True)
        return [docs[i] for i in ranked[:RERANKER_TOP]]
    except Exception as e:
        logger.warning("[RAG] rerank error: %s", e)
        return docs[:RERANKER_TOP]


# ── Document builder ───────────────────────────────────────────────────────────

def _notes_to_docs(notes: list[dict]) -> list[Document]:
    docs: list[Document] = []
    for n in notes:
        parts = []
        if n.get("title"):
            parts.append(f"Tiêu đề: {n['title']}")
        if n.get("content"):
            parts.append(n["content"])
        if n.get("summary"):
            parts.append(f"Tóm tắt: {n['summary']}")

        raw = n.get("raw_json")
        if raw:
            try:
                info = json.loads(raw) if isinstance(raw, str) else raw
                if info.get("extracted_text"):
                    parts.append(f"Nội dung đính kèm:\n{info['extracted_text']}")
                for field in ("person_name", "phone", "email", "organization",
                              "place_name", "address", "event_title"):
                    val = info.get(field)
                    if val:
                        parts.append(f"{field}: {val}")
            except Exception:
                pass

        att_texts = n.get("attachment_texts")
        if att_texts:
            parts.append(f"Nội dung file đính kèm:\n{att_texts}")

        full_text = "\n\n".join(parts).strip()
        if not full_text:
            continue

        chunks = text_splitter.create_documents(
            [full_text],
            metadatas=[{"note_id": n["id"], "title": n.get("title") or ""}],
        )
        docs.extend(chunks)
    return docs


# ── Image extraction ───────────────────────────────────────────────────────────

def _extract_pending_images(conn) -> None:
    import base64
    import os
    from services.ollama import extract_from_image

    rows = conn.execute(
        """SELECT id, file_path, file_name
           FROM note_attachments
           WHERE file_group = 'image'
             AND (extracted_text IS NULL OR extracted_text = '')"""
    ).fetchall()

    for row in rows:
        candidates = [row["file_path"],
                      row["file_path"].replace("/", os.sep),
                      row["file_path"].replace("\\", "/")]
        fpath = next((p for p in candidates if os.path.exists(p)), None)
        if not fpath:
            continue
        try:
            with open(fpath, "rb") as f:
                b64 = base64.b64encode(f.read()).decode()
            result = extract_from_image(b64)
            text = result.get("extracted_text") or ""
            if text.strip():
                conn.execute(
                    "UPDATE note_attachments SET extracted_text=? WHERE id=?",
                    [text.strip(), row["id"]],
                )
                conn.commit()
                logger.info("[RAG] indexed image %s (%d chars)", row["file_name"], len(text))
        except Exception as e:
            logger.warning("[RAG] image extract skip %s: %s", row["file_name"], e)


# ── Fix #5: Incremental rebuild — chỉ embed notes thay đổi ────────────────────

def rebuild_index_from_db() -> None:
    """Incremental rebuild: chỉ embed notes có updated_at > embedded_at.
    Thread-safe, chạy background."""
    from database import get_connection

    def _run():
        with _index_lock:
            try:
                conn = get_connection()
                _extract_pending_images(conn)

                # Chỉ lấy notes chưa embed hoặc đã thay đổi
                new_rows = conn.execute(
                    """SELECT n.id, n.title, n.content, n.summary, e.raw_json
                       FROM notes n
                       LEFT JOIN extracted_info e ON n.id = e.note_id
                       WHERE (n.embedded_at IS NULL OR n.updated_at > n.embedded_at)
                       ORDER BY n.created_at DESC"""
                ).fetchall()
                new_notes = [dict(r) for r in new_rows]

                if not new_notes:
                    logger.info("[RAG] No new/changed notes — skipping rebuild")
                    conn.close()
                    return

                att_rows = conn.execute(
                    """SELECT note_id, file_name, extracted_text
                       FROM note_attachments
                       WHERE extracted_text IS NOT NULL AND extracted_text != ''"""
                ).fetchall()
                conn.close()

                att_map: dict[int, list[str]] = {}
                for a in att_rows:
                    att_map.setdefault(a["note_id"], []).append(
                        f"[{a['file_name']}]:\n{a['extracted_text']}"
                    )
                for note in new_notes:
                    if note["id"] in att_map:
                        note["attachment_texts"] = "\n\n".join(att_map[note["id"]])

                new_docs = _notes_to_docs(new_notes)
                if not new_docs:
                    logger.warning("[RAG] No documents to index")
                    return

                store = _get_chroma()

                # Fix #7: delete stale vectors cho các notes sắp re-embed
                note_ids_to_update = [n["id"] for n in new_notes]
                try:
                    store.delete(where={"note_id": {"$in": note_ids_to_update}})
                except Exception as e:
                    logger.warning("[RAG] chroma delete old vectors: %s", e)

                store.add_documents(new_docs)
                logger.info("[RAG] Incremental index: +%d chunks from %d notes",
                            len(new_docs), len(new_notes))

                # Cập nhật embedded_at
                now = datetime.now().isoformat()
                conn2 = get_connection()
                placeholders = ",".join("?" * len(note_ids_to_update))
                conn2.execute(
                    f"UPDATE notes SET embedded_at=? WHERE id IN ({placeholders})",
                    [now] + note_ids_to_update,
                )
                conn2.commit()
                conn2.close()

                # Invalidate BM25 cache — sẽ rebuild lần query tiếp theo
                _invalidate_bm25()

            except Exception as ex:
                logger.error("[RAG] rebuild failed: %s", ex)

    threading.Thread(target=_run, daemon=True).start()


# Fix #4: Debounced rebuild — trailing debounce, cancel & restart timer on every call ──

def _trigger_rebuild() -> None:
    """Chạy sau khi timer hết hạn — reset timer rồi gọi rebuild."""
    global _rebuild_timer
    with _rebuild_lock:
        _rebuild_timer = None
    rebuild_index_from_db()


def schedule_rebuild(delay: float = 5.0) -> None:
    """Trailing debounce: huỷ timer cũ và bắt đầu lại mỗi khi được gọi.
    Rebuild xảy ra `delay` giây sau lần gọi CUỐI CÙNG — tránh rebuild thừa
    khi user lưu nhiều note liên tiếp."""
    global _rebuild_timer
    with _rebuild_lock:
        if _rebuild_timer is not None:
            _rebuild_timer.cancel()
        _rebuild_timer = threading.Timer(delay, _trigger_rebuild)
        _rebuild_timer.daemon = True
        _rebuild_timer.start()


# Fix #7: Delete vectors theo note_id khi note bị xóa ─────────────────────────

def delete_note_from_index(note_id: int) -> None:
    """Xóa tất cả vectors của note_id khỏi Chroma ngay lập tức."""
    if not index_exists():
        return
    try:
        store = _get_chroma()
        store.delete(where={"note_id": note_id})
        _invalidate_bm25()
        logger.info("[RAG] deleted vectors for note_id=%d", note_id)
    except Exception as e:
        logger.warning("[RAG] delete_note_from_index error: %s", e)


# ── RAG chat ───────────────────────────────────────────────────────────────────

def rag_chat(question: str, history: list[dict] | None = None) -> str:
    """Hybrid retrieval (BM25 + Chroma) → rerank → qwen3:8b.
    history: list of {"role": "user"|"assistant", "content": str}
    """
    if not index_exists():
        return "Chưa có dữ liệu để tìm kiếm. Hãy tạo một số ghi chú và thử lại."

    try:
        store = _get_chroma()
    except Exception as e:
        logger.error("[RAG] load chroma failed: %s", e)
        return "Không thể tải dữ liệu tìm kiếm. Vui lòng thử lại sau."

    chroma_retriever = store.as_retriever(
        search_type="similarity_score_threshold",
        search_kwargs={"k": RETRIEVAL_K, "score_threshold": 0.2},
    )

    bm25_retriever = _get_bm25(store)

    try:
        if bm25_retriever:
            from langchain.retrievers import EnsembleRetriever
            ensemble = EnsembleRetriever(
                retrievers=[chroma_retriever, bm25_retriever],
                weights=[0.6, 0.4],
            )
            candidates = ensemble.invoke(question)
        else:
            candidates = chroma_retriever.invoke(question)
    except Exception as e:
        logger.warning("[RAG] retrieval error, fallback: %s", e)
        candidates = chroma_retriever.invoke(question)

    if not candidates:
        return "Tôi không tìm thấy thông tin này trong ghi chú của bạn."

    top_docs = _rerank(question, candidates)

    context = "\n\n---\n\n".join(
        f"[{d.metadata.get('title', 'Ghi chú')}]\n{d.page_content}"
        for d in top_docs
    )

    # Đưa lịch sử hội thoại gần nhất vào prompt (tối đa 6 turn)
    history_section = ""
    if history:
        turns = history[-12:] if len(history) > 12 else history  # 6 turn = 12 messages
        lines = ["\nLịch sử hội thoại:"]
        for h in turns:
            role = "Người dùng" if h.get("role") == "user" else "AI"
            lines.append(f"{role}: {h.get('content', '')}")
        history_section = "\n".join(lines) + "\n"

    return _rag_chain.invoke({"context": context, "history": history_section, "question": question})