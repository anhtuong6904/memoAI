/**
 * hooks/useNotes.ts
 *
 * Hook quan ly state cua notes.
 * Dung trong HomeScreen (danh sach) va EditScreen (chi tiet).
 *
 * Architecture: note-as-container
 *   - createNote: tao note rong
 *   - updateNote: cap nhat noi dung
 *   - analyzeNote: chay AI pipeline (extract info + reminders)
 *   - uploadAttachment: dinh kem file (qua FileAttachmentBar)
 */

import { useCallback, useEffect, useState } from "react";
import {
  createNote as createNoteApi,
  deleteNote as deleteNoteApi,
  getAllNotes,
  getNoteByID,
  updateNote as updateNoteApi,
} from "../services/api";
import { FileAttachment, Note } from "../types";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/** Thong tin AI trich xuat — map voi bang extracted_info trong DB */
export interface ExtractedInfo {
  id: number;
  note_id: number;
  person_name?: string;
  phone?: string;
  email?: string;
  organization?: string;
  place_name?: string;
  address?: string;
  location_lat?: number;
  location_lng?: number;
  event_title?: string;
  event_time?: string;
  deadline?: string;
  category?: string;
  action_items?: string; // JSON string: ["task1", "task2"]
  reminder_needed: number; // 0 | 1
  raw_json?: string;
  created_at: string;

  // Optional convenience fields injected by EditScreen khi merge tu Note
  summary?: string;
}

export interface FilterOptions {
  /** Phai khop voi Note.type — chi co 4 loai */
  type?: "text" | "image" | "voice" | "video" | "all";
  tag?: string;
}

interface UseNotesReturn {
  // ── Danh sach notes ──────────────────────────────────────────────────────
  notes: Note[];
  loading: boolean;
  error: string | null;

  // ── Filter ───────────────────────────────────────────────────────────────
  filter: FilterOptions;
  setFilter: (f: FilterOptions) => void;

  // ── Actions ──────────────────────────────────────────────────────────────
  reload: () => Promise<void>;
  removeNote: (id: number) => Promise<void>;
  createNote: (content: string, title?: string) => Promise<Note>;
  updateNote: (id: number, data: Partial<Note>) => Promise<Note>;
}

interface UseNoteDetailReturn {
  note: Note | null;
  extracted: ExtractedInfo | null;
  attachment: FileAttachment[] | null;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

// ─────────────────────────────────────────────────────────────────────────────
// useNotes — dung trong HomeScreen
// ─────────────────────────────────────────────────────────────────────────────

export function useNotes(): UseNotesReturn {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterOptions>({ type: "all" });

  // ── Fetch danh sach notes ────────────────────────────────────────────────
  const reload = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Loai bo "all" khi gui len server (server expect 'text' | 'image' | ...)
      const serverType =
        filter.type && filter.type !== "all" ? filter.type : undefined;

      const data = await getAllNotes({
        type: serverType,
        tag: filter.tag,
        limit: 50,
      });

      setNotes(data);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Khong ket noi duoc server";
      setError(msg);
      console.warn("[useNotes] reload error:", msg);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    reload();
  }, [reload]);

  // ── Xoa note ────────────────────────────────────────────────────────────
  const removeNote = useCallback(
    async (id: number) => {
      // Optimistic update — lưu state cũ để restore nếu API fail
      let prevNotes: Note[] = [];
      setNotes((prev) => {
        prevNotes = prev;
        return prev.filter((n) => n.id !== id);
      });
      try {
        await deleteNoteApi(id);
      } catch {
        // Restore state cũ thay vì reload toàn bộ list
        setNotes(prevNotes);
      }
    },
    [],
  );

  // ── Tao note moi ─────────────────────────────────────────────────────────
  const createNote = useCallback(
    async (content: string, title?: string): Promise<Note> => {
      const newNote = await createNoteApi(content, title);
      setNotes((prev) => [newNote, ...prev]);
      return newNote;
    },
    [],
  );

  // ── Update note ─────────────────────────────────────────────────────────
  const updateNote = useCallback(
    async (id: number, data: Partial<Note>): Promise<Note> => {
      const updated = await updateNoteApi(id, data);
      setNotes((prev) => prev.map((n) => (n.id === id ? updated : n)));
      return updated;
    },
    [],
  );

  return {
    notes,
    loading,
    error,
    filter,
    setFilter,
    reload,
    removeNote,
    createNote,
    updateNote,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// useNoteDetail — dung trong EditScreen
// Load 1 note theo ID, kem extracted_info
// ─────────────────────────────────────────────────────────────────────────────

export function useNoteDetail(
  noteId: number | undefined,
  initialNote?: Note,
): UseNoteDetailReturn {
  // initialNote từ HomeScreen — cho phép editor load content ngay lập tức
  // trước khi API round-trip hoàn tất
  const [note, setNote] = useState<Note | null>(initialNote ?? null);
  const [extracted, setExtracted] = useState<ExtractedInfo | null>(null);
  const [attachment, setAttachment] = useState<FileAttachment[]>([]);
  // Nếu có initialNote, không cần block UI — fetch extracted/attachments ngầm
  const [loading, setLoading] = useState<boolean>(
    noteId !== undefined && !initialNote,
  );
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (noteId === undefined) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const result = await getNoteByID(noteId);
      setNote(result.data);

      // Merge note.summary vao extracted de tien hien thi trong AI panel
      const ext = result.extracted as ExtractedInfo | null;
      if (ext && result.data?.summary) {
        ext.summary = result.data.summary;
      }
      setExtracted(ext);

      const attach: FileAttachment[] = (result.attachments ?? []).map(
        (a: any) => ({
          id: String(a.id),
          name: a.file_name,
          uri: a.file_url,
          mimeType: a.mime_type,
          size: a.file_size,
          uploaded: true,
          remoteUrl: a.file_url,
        }),
      );
      setAttachment(attach);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Khong tai duoc ghi chu";
      setError(msg);
      console.warn("[useNoteDetail] reload error:", msg);
    } finally {
      setLoading(false);
    }
  }, [noteId]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { note, extracted, attachment, loading, error, reload };
}
