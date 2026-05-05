/**
 * hooks/useNotes.ts
 *
 * Hook quản lý toàn bộ state của notes.
 * Dùng trong HomeScreen (danh sách) và EditScreen (chi tiết).
 */

import { useCallback, useEffect, useState } from "react";
import {
  captureText,
  createNote as createNoteApi,
  deleteNote as deleteNoteApi,
  getAllNotes,
  getNoteByID,
  toggleArchive as toggleArchiveApi,
  togglePin as togglePinApi,
  updateNote as updateNoteApi,
} from "../services/api";
import { Note } from "../types";

// ── Types ─────────────────────────────────────────────────────────────────────

/** Thông tin AI trích xuất — map với bảng extracted_info trong DB */
export interface ExtractedInfo {
  id: number;
  note_id: number;
  person_name?: string;
  phone?: string;
  email?: string;
  organization?: string;
  place_name?: string;
  address?: string;
  event_title?: string;
  event_time?: string;
  deadline?: string;
  category?: string;
  action_items?: string; // JSON string: ["task1", "task2"]
  reminder_needed: number; // 0 | 1
  raw_json?: string;
  created_at: string;
}

export interface FilterOptions {
  type?: "text" | "image" | "voice" | "video" | "file" | "all";
  tag?: string;
}

interface UseNotesReturn {
  // ── Danh sách notes ──────────────────────────────────────────────────────
  notes: Note[];
  loading: boolean;
  error: string | null;

  // ── Filter ───────────────────────────────────────────────────────────────
  filter: FilterOptions;
  setFilter: (f: FilterOptions) => void;

  // ── Actions ──────────────────────────────────────────────────────────────
  reload: () => Promise<void>;
  removeNote: (id: number) => Promise<void>;

  /**
   * Tạo note text thuần — không qua AI pipeline.
   * Dùng trong EditScreen khi user gõ tay bình thường.
   * Nhanh hơn captureText vì không cần đợi LLM.
   */
  createNote: (content: string, title?: string) => Promise<Note>;

  /**
   * Tạo note qua AI pipeline.
   * Dùng khi muốn AI tự động trích xuất thông tin từ text.
   * Chậm hơn ~3s nhưng tạo ra extracted_info tự động.
   */
  captureNoteFromText: (text: string, noteId?: number) => Promise<Note>;

  updateNote: (id: number, data: Partial<Note>) => Promise<Note>;
  pinNote: (note: Note) => Promise<void>;
  archiveNote: (note: Note) => Promise<void>;
}

interface UseNoteDetailReturn {
  note: Note | null;
  extracted: ExtractedInfo | null;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

// ─────────────────────────────────────────────────────────────────────────────
// useNotes — dùng trong HomeScreen
// ─────────────────────────────────────────────────────────────────────────────

export function useNotes(): UseNotesReturn {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterOptions>({ type: "all" });

  // ── Fetch danh sách notes từ server ────────────────────────────────────────
  const reload = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const data = await getAllNotes({
        type: filter.type === "all" ? undefined : filter.type,
        tag: filter.tag,
        limit: 50, // Lấy 50 notes gần nhất
      });

      setNotes(data);
    } catch {
      setError("Không kết nối được server");
    } finally {
      setLoading(false);
    }
  }, [filter]); // Re-fetch khi filter thay đổi

  // ── Auto reload khi filter thay đổi ───────────────────────────────────────
  useEffect(() => {
    reload();
  }, [reload]);

  // ── Xóa note: update local trước, fetch lại sau ────────────────────────────
  const removeNote = async (id: number) => {
    // Optimistic update — xóa khỏi UI ngay lập tức
    setNotes((prev) => prev.filter((n) => n.id !== id));
    try {
      await deleteNoteApi(id);
    } catch {
      // Nếu server lỗi → fetch lại để đồng bộ
      await reload();
    }
  };

  // ── Tạo note text thuần (không AI) ────────────────────────────────────────
  const createNote = async (content: string, title?: string): Promise<Note> => {
    const newNote = await createNoteApi(content, title);
    setNotes((prev) => [newNote, ...prev]);
    return newNote;
  };

  // ── Tạo note qua AI pipeline ───────────────────────────────────────────────
  const captureNoteFromText = async (
    text: string,
    noteId?: number,
  ): Promise<Note> => {
    const noteResult = await captureText(text, undefined, noteId);
    if (noteId) {
      setNotes((prev) => prev.map((n) => (n.id === noteId ? noteResult : n)));
    } else {
      setNotes((prev) => [noteResult, ...prev]);
    }
    return noteResult;
  };

  // ── Update note ────────────────────────────────────────────────────────────
  const updateNote = async (id: number, data: Partial<Note>): Promise<Note> => {
    const updated = await updateNoteApi(id, data);
    setNotes((prev) => prev.map((n) => (n.id === id ? updated : n)));
    return updated;
  };

  // ── Toggle pin ─────────────────────────────────────────────────────────────
  const pinNote = async (note: Note): Promise<void> => {
    // Optimistic update
    setNotes((prev) =>
      prev.map((n) =>
        n.id === note.id
          ? { ...n, is_pinned: note.is_pinned === 1 ? 0 : 1 }
          : n,
      ),
    );
    try {
      await togglePinApi(note);
    } catch {
      await reload();
    }
  };

  // ── Toggle archive ─────────────────────────────────────────────────────────
  const archiveNote = async (note: Note): Promise<void> => {
    // Optimistic update — ẩn khỏi danh sách ngay
    setNotes((prev) => prev.filter((n) => n.id !== note.id));
    try {
      await toggleArchiveApi(note);
    } catch {
      await reload();
    }
  };

  return {
    notes,
    loading,
    error,
    filter,
    setFilter,
    reload,
    removeNote,
    createNote,
    captureNoteFromText,
    updateNote,
    pinNote,
    archiveNote,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// useNoteDetail — dùng trong EditScreen
// Load 1 note theo ID, kèm extracted_info
// ─────────────────────────────────────────────────────────────────────────────

export function useNoteDetail(noteId: number | undefined): UseNoteDetailReturn {
  const [note, setNote] = useState<Note | null>(null);
  const [extracted, setExtracted] = useState<ExtractedInfo | null>(null);
  const [loading, setLoading] = useState<boolean>(noteId !== undefined);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (noteId === undefined) return;

    try {
      setLoading(true);
      setError(null);

      // getNoteByID trả về { data: Note, extracted: ExtractedInfo | null }
      const result = await getNoteByID(noteId);
      setNote(result.data);
      setExtracted(result.extracted as ExtractedInfo | null);
    } catch {
      setError("Không tải được ghi chú");
    } finally {
      setLoading(false);
    }
  }, [noteId]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { note, extracted, loading, error, reload };
}
