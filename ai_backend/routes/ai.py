"""
routes/ai.py — Search

POST /search  → vector search (Chroma) với LLM fallback
"""

import asyncio

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from database import get_connection
from services.rag import index_exists

router = APIRouter()


class SearchRequest(BaseModel):
    keyword: str


@router.post("/search")
async def search_notes(body: SearchRequest):
    if not body.keyword.strip():
        raise HTTPException(status_code=400, detail="Keyword không được để trống")

    if index_exists():
        try:
            from services.rag import _get_chroma
            store   = _get_chroma()
            loop    = asyncio.get_running_loop()
            results = await loop.run_in_executor(
                None, lambda: store.similarity_search(body.keyword, k=10)
            )
            seen, note_ids = set(), []
            for d in results:
                nid = d.metadata.get("note_id")
                if nid and nid not in seen:
                    seen.add(nid)
                    note_ids.append(nid)

            conn = get_connection()
            try:
                result = []
                for note_id in note_ids:
                    note = conn.execute(
                        "SELECT * FROM notes WHERE id=?", [note_id]
                    ).fetchone()
                    if note:
                        result.append(dict(note))
            finally:
                conn.close()

            return {"success": True, "data": result, "count": len(result), "keyword": body.keyword}
        except Exception as e:
            import logging
            logging.getLogger(__name__).warning("[search] chroma failed, fallback LLM: %s", e)

    # Fallback LLM search — run in executor để không block event loop
    from services.ollama import search_notes_by_keyword
    conn = get_connection()
    try:
        notes = conn.execute(
            "SELECT id, title, content, summary, type, tags FROM notes"
        ).fetchall()
    finally:
        conn.close()

    if not notes:
        return {"success": True, "data": [], "count": 0}

    notes_list = [dict(n) for n in notes]
    kw = body.keyword

    loop = asyncio.get_running_loop()
    relevant_ids = await loop.run_in_executor(
        None, lambda: search_notes_by_keyword(kw, notes_list)
    )

    conn = get_connection()
    try:
        result = []
        for note_id in relevant_ids:
            note = conn.execute("SELECT * FROM notes WHERE id=?", [note_id]).fetchone()
            if note:
                result.append(dict(note))
    finally:
        conn.close()

    return {"success": True, "data": result, "count": len(result), "keyword": body.keyword}
