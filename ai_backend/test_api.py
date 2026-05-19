"""
ai_backend/test_api.py

Unit tests for MemoAI FastAPI backend.

Run:
    cd ai_backend
    pytest test_api.py -v

Does NOT require Ollama, ChromaDB, or GPU.
All heavy services are mocked; only SQLite (temp file) is used.
"""

import os
import sys
import tempfile
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

# ── Ensure ai_backend/ is on sys.path ─────────────────────────────────────────
_AI_DIR = Path(__file__).parent
if str(_AI_DIR) not in sys.path:
    sys.path.insert(0, str(_AI_DIR))

# ── Ensure uploads dirs exist (StaticFiles mount needs them at import time) ────
for _subdir in ("image", "audio", "video", "document"):
    os.makedirs(_AI_DIR / "uploads" / _subdir, exist_ok=True)

# ── Temp SQLite DB (isolated per test run) ────────────────────────────────────
_tmp_db = Path(tempfile.mkdtemp(prefix="memoai_test_")) / "test.db"

# ── Start all patches BEFORE importing main.py ────────────────────────────────
_PATCHES = [
    patch("database.DB_PATH", _tmp_db),
    patch("services.rag.rebuild_index_from_db",     MagicMock()),
    patch("services.rag.schedule_rebuild",           MagicMock()),
    patch("services.rag.delete_note_from_index",     MagicMock()),
    patch("services.rag.index_exists",               MagicMock(return_value=False)),
    patch("services.ollama.rag_chat_with_note",      MagicMock(return_value="per-note mock answer")),
    patch("services.ollama.search_notes_by_keyword", MagicMock(return_value=[])),
]
for _p in _PATCHES:
    _p.start()

# ── Import app after patches are live ─────────────────────────────────────────
import database  # noqa: E402
from main import app  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

# Initialise schema in the temp DB
database.init_db()

# ── Shared state: IDs created during tests, reused across test classes ─────────
_s: dict = {}


# ── Session-scoped client fixture ─────────────────────────────────────────────
@pytest.fixture(scope="session")
def client():
    with TestClient(app) as c:
        yield c


# ══════════════════════════════════════════════════════════════════════════════
class TestHealth:
    def test_root_running(self, client):
        r = client.get("/")
        assert r.status_code == 200
        body = r.json()
        assert body["status"] == "running"
        assert "version" in body


# ══════════════════════════════════════════════════════════════════════════════
class TestNotes:
    def test_list_initially_empty(self, client):
        r = client.get("/notes")
        assert r.status_code == 200
        body = r.json()
        assert body["success"] is True
        assert isinstance(body["data"], list)

    def test_create_note(self, client):
        r = client.post("/notes", json={"title": "Test Note", "content": "Hello world"})
        assert r.status_code == 200
        body = r.json()
        assert body["success"] is True
        note = body["data"]
        assert note["title"] == "Test Note"
        assert "id" in note
        _s["note_id"] = note["id"]

    def test_get_note(self, client):
        r = client.get(f"/notes/{_s['note_id']}")
        assert r.status_code == 200
        body = r.json()
        assert body["data"]["id"] == _s["note_id"]
        assert "attachments" in body

    def test_get_note_404(self, client):
        r = client.get("/notes/99999")
        assert r.status_code == 404

    def test_update_note_title(self, client):
        r = client.put(f"/notes/{_s['note_id']}", json={"title": "Updated Title"})
        assert r.status_code == 200
        assert r.json()["data"]["title"] == "Updated Title"

    def test_update_note_no_fields_422(self, client):
        r = client.put(f"/notes/{_s['note_id']}", json={})
        assert r.status_code == 400

    def test_list_has_note(self, client):
        r = client.get("/notes")
        ids = [n["id"] for n in r.json()["data"]]
        assert _s["note_id"] in ids

    def test_create_with_valid_tags(self, client):
        r = client.post("/notes", json={
            "title": "Tagged Note",
            "content": "tag content",
            "tags": '["work", "test"]',
        })
        assert r.status_code == 200
        _s["tagged_id"] = r.json()["data"]["id"]

    def test_create_with_invalid_tags_422(self, client):
        r = client.post("/notes", json={"title": "Bad", "content": "x", "tags": "not-json"})
        assert r.status_code == 422

    def test_filter_by_tag(self, client):
        r = client.get("/notes?tag=work")
        assert r.status_code == 200
        ids = [n["id"] for n in r.json()["data"]]
        assert _s["tagged_id"] in ids

    def test_tag_filter_no_match(self, client):
        r = client.get("/notes?tag=nonexistenttag_xyz")
        assert r.status_code == 200
        assert r.json()["count"] == 0

    def test_delete_tagged_note(self, client):
        r = client.delete(f"/notes/{_s['tagged_id']}")
        assert r.status_code == 200


# ══════════════════════════════════════════════════════════════════════════════
class TestReminders:
    def test_list_initially_empty_or_ok(self, client):
        r = client.get("/reminders")
        assert r.status_code == 200
        assert r.json()["success"] is True

    def test_create_reminder(self, client):
        r = client.post("/reminders", json={
            "title": "Test Reminder",
            "remind_at": "2099-12-31T09:00:00",
        })
        assert r.status_code == 200
        body = r.json()
        assert body["success"] is True
        _s["reminder_id"] = body["data"]["id"]

    def test_create_reminder_linked_to_note(self, client):
        r = client.post("/reminders", json={
            "title": "Linked Reminder",
            "remind_at": "2099-06-01T10:00:00",
            "note_id": _s["note_id"],
        })
        assert r.status_code == 200
        _s["linked_reminder_id"] = r.json()["data"]["id"]

    def test_create_reminder_invalid_date_422(self, client):
        r = client.post("/reminders", json={"title": "Bad", "remind_at": "not-a-date"})
        assert r.status_code == 422

    def test_list_reminders(self, client):
        r = client.get("/reminders")
        assert r.status_code == 200
        assert r.json()["count"] >= 1

    def test_mark_done(self, client):
        r = client.put(f"/reminders/{_s['reminder_id']}/done")
        assert r.status_code == 200
        assert r.json()["success"] is True

    def test_mark_done_404(self, client):
        r = client.put("/reminders/99999/done")
        assert r.status_code == 404

    def test_done_reminder_excluded_from_default_list(self, client):
        r = client.get("/reminders")
        ids = [rem["id"] for rem in r.json()["data"]]
        assert _s["reminder_id"] not in ids

    def test_include_done_query(self, client):
        r = client.get("/reminders?include_done=true")
        ids = [rem["id"] for rem in r.json()["data"]]
        assert _s["reminder_id"] in ids

    def test_delete_reminder(self, client):
        r = client.delete(f"/reminders/{_s['reminder_id']}")
        assert r.status_code == 200

    def test_delete_reminder_404(self, client):
        r = client.delete("/reminders/99999")
        assert r.status_code == 404

    def test_cleanup_linked_reminder(self, client):
        r = client.delete(f"/reminders/{_s['linked_reminder_id']}")
        assert r.status_code == 200


# ══════════════════════════════════════════════════════════════════════════════
class TestChat:
    def test_history_empty_on_start(self, client):
        r = client.get("/chat/history")
        assert r.status_code == 200
        assert r.json()["success"] is True

    def test_send_message(self, client):
        with patch("services.rag.rag_chat", return_value="Xin chào! Tôi là MemoAI."):
            r = client.post("/chat", json={"question": "Xin chào MemoAI"})
        assert r.status_code == 200
        body = r.json()
        assert body["success"] is True
        assert body["question"] == "Xin chào MemoAI"
        assert isinstance(body["answer"], str)
        assert len(body["answer"]) > 0

    def test_send_empty_question_400(self, client):
        r = client.post("/chat", json={"question": "   "})
        assert r.status_code == 400

    def test_history_saved_after_chat(self, client):
        r = client.get("/chat/history")
        assert r.status_code == 200
        data = r.json()
        assert data["count"] >= 2  # user message + assistant message

    def test_history_limit_param(self, client):
        r = client.get("/chat/history?limit=1")
        assert r.status_code == 200
        assert r.json()["count"] <= 1

    def test_clear_history(self, client):
        r = client.delete("/chat/history")
        assert r.status_code == 200
        assert r.json()["success"] is True

    def test_history_empty_after_clear(self, client):
        r = client.get("/chat/history")
        assert r.json()["count"] == 0


# ══════════════════════════════════════════════════════════════════════════════
class TestNoteChat:
    def test_setup_note_for_chat(self, client):
        r = client.post("/notes", json={
            "title": "Chat Note",
            "content": "Per-note chat test content.",
        })
        assert r.status_code == 200
        _s["chat_note_id"] = r.json()["data"]["id"]

    def test_per_note_chat(self, client):
        nid = _s["chat_note_id"]
        r = client.post(f"/notes/{nid}/chat", json={"message": "Tóm tắt ghi chú này"})
        assert r.status_code == 200
        body = r.json()
        assert body["success"] is True
        assert body["note_id"] == nid
        assert isinstance(body["answer"], str)

    def test_per_note_chat_with_history(self, client):
        nid = _s["chat_note_id"]
        r = client.post(f"/notes/{nid}/chat", json={
            "message": "Nội dung chính là gì?",
            "history": [
                {"role": "user", "content": "xin chào"},
                {"role": "assistant", "content": "xin chào bạn"},
            ],
        })
        assert r.status_code == 200
        assert r.json()["success"] is True

    def test_per_note_chat_empty_message_400(self, client):
        nid = _s["chat_note_id"]
        r = client.post(f"/notes/{nid}/chat", json={"message": "  "})
        assert r.status_code == 400

    def test_per_note_chat_missing_note_404(self, client):
        r = client.post("/notes/99999/chat", json={"message": "test"})
        assert r.status_code == 404

    def test_cleanup_chat_note(self, client):
        r = client.delete(f"/notes/{_s['chat_note_id']}")
        assert r.status_code == 200


# ══════════════════════════════════════════════════════════════════════════════
class TestSearch:
    def test_search_empty_keyword_400(self, client):
        r = client.post("/search", json={"keyword": "  "})
        assert r.status_code == 400

    def test_search_no_index_returns_ok(self, client):
        # index_exists() is mocked to False → falls back to LLM keyword search
        # search_notes_by_keyword is mocked to return [] → empty results
        r = client.post("/search", json={"keyword": "hello"})
        assert r.status_code == 200
        body = r.json()
        assert body["success"] is True
        assert "data" in body
        assert isinstance(body["data"], list)

    def test_search_keyword_echoed(self, client):
        r = client.post("/search", json={"keyword": "test query"})
        assert r.status_code == 200
        assert r.json()["keyword"] == "test query"

    def test_delete_main_note(self, client):
        r = client.delete(f"/notes/{_s['note_id']}")
        assert r.status_code == 200
        assert r.json()["success"] is True

    def test_deleted_note_returns_404(self, client):
        r = client.get(f"/notes/{_s['note_id']}")
        assert r.status_code == 404
