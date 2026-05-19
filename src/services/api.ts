import axios from "axios";
import { SERVER_URL } from "../constants/config";
import { FileAttachment, Note, Reminder } from "../types";

const api = axios.create({
  baseURL: SERVER_URL,
  timeout: 30000,
  headers: { "Content-Type": "application/json" },
});

// LLM calls take 1-3 min on local hardware
const AI_TIMEOUT = 300_000;

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const msg = err.response?.data?.detail || err.message || "Unknown error";
    console.error(
      `[API] ${err.config?.method?.toUpperCase()} ${err.config?.url}:`,
      msg,
    );
    return Promise.reject(new Error(msg));
  },
);

// ─── NOTES — KHÔNG có trailing slash ──────────────────────────────────────
export const getAllNotes = (opts?: {
  tag?: string;
  type?: string;
  limit?: number;
  offset?: number;
}): Promise<Note[]> => {
  const p = new URLSearchParams();
  if (opts?.tag) p.set("tag", opts.tag);
  if (opts?.type) p.set("type", opts.type);
  if (opts?.limit) p.set("limit", String(opts.limit));
  if (opts?.offset) p.set("offset", String(opts.offset));
  const qs = p.toString();
  return api
    .get(qs ? `/notes?${qs}` : "/notes")
    .then((r) => r.data.data as Note[]);
};

export interface ExtractedInfoRaw {
  id: number;
  note_id: number;
  person_name?: string | null;
  phone?: string | null;
  email?: string | null;
  organization?: string | null;
  place_name?: string | null;
  address?: string | null;
  location_lat?: number | null;
  location_lng?: number | null;
  event_title?: string | null;
  event_time?: string | null;
  deadline?: string | null;
  category?: string | null;
  action_items?: string | null;
  reminder_needed: number;
  raw_json?: string | null;
  created_at: string;
}

export interface AttachmentRaw {
  id: number;
  note_id: number;
  file_name: string;
  file_path: string;
  file_url: string;
  mime_type?: string | null;
  file_group: string;
  file_size?: number | null;
  extracted_text?: string | null;
  created_at: string;
}

export const getNoteByID = (
  id: number,
): Promise<{ data: Note; extracted: ExtractedInfoRaw | null; attachments: AttachmentRaw[] }> =>
  api.get(`/notes/${id}`).then((r) => ({
    data: r.data.data,
    extracted: r.data.extracted ?? null,
    attachments: r.data.attachments ?? [],
  }));

export const createNote = (content: string, title?: string): Promise<Note> =>
  api.post("/notes", { content, title }).then((r) => r.data.data as Note);

export const updateNote = (
  id: number,
  data: Partial<
    Pick<
      Note,
      | "title"
      | "content"
      | "content_json"
      | "summary"
      | "tags"
    >
  >,
): Promise<Note> =>
  api.put(`/notes/${id}`, data).then((r) => r.data.data as Note);

export const deleteNote = (id: number): Promise<void> =>
  api.delete(`/notes/${id}`).then(() => undefined);

// ─── ATTACHMENTS ──────────────────────────────────────────────────────────
export const getAttachments = (noteId: number): Promise<any[]> =>
  api.get(`/notes/${noteId}/attachments`).then((r) => r.data.data);

export const uploadAttachment = async (
  noteId: number,
  fileUri: string,
  fileName: string,
  mimeType?: string,
): Promise<FileAttachment> => {
  const form = new FormData();
  form.append("file", {
    uri: fileUri,
    name: fileName,
    type: mimeType ?? "application/octet-stream",
  } as any);
  form.append("file_name", fileName);

  const res = await fetch(`${SERVER_URL}/notes/${noteId}/attachments`, {
    method: "POST",
    body: form,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.detail ?? "Upload failed");
  const att = json.data;
  return {
    id: String(att.id),
    name: att.file_name,
    uri: att.file_url,
    mimeType: att.mime_type,
    size: att.file_size,
    uploaded: true,
    remoteUrl: att.file_url,
  };
};

export const deleteAttachment = (
  noteId: number,
  attId: string,
): Promise<void> =>
  api.delete(`/notes/${noteId}/attachments/${attId}`).then(() => undefined);

// ─── ANALYZE ─────────────────────────────────────────────────────────────
export const analyzeNote = (
  id: number,
): Promise<{ success: boolean; extracted: Record<string, unknown>; reminder?: Reminder | null }> =>
  api.post(`/notes/${id}/analyze`, {}, { timeout: AI_TIMEOUT }).then((r) => r.data);

// ─── REMINDERS (create) ───────────────────────────────────────────────────
export const createReminder = (data: {
  title: string;
  remind_at: string;
  note_id?: number;
  body?: string;
}): Promise<Reminder> =>
  api.post("/reminders", data).then((r) => r.data.data as Reminder);

// ─── NOTE RAG CHAT ────────────────────────────────────────────────────────
export const chatWithNote = (
  noteId: number,
  message: string,
  history: { role: "user" | "assistant"; content: string }[] = [],
): Promise<{ answer: string }> =>
  api
    .post(`/notes/${noteId}/chat`, { message, history }, { timeout: AI_TIMEOUT })
    .then((r) => ({ answer: r.data.answer as string }));

// ─── AI SEARCH & CHAT ─────────────────────────────────────────────────────
export const searchNotes = (keyword: string): Promise<Note[]> =>
  api.post("/search", { keyword }).then((r) => r.data.data as Note[]);

export const chatWithAI = (
  question: string,
): Promise<{ answer: string; question: string }> =>
  api
    .post("/chat", { question }, { timeout: AI_TIMEOUT })
    .then((r) => ({ answer: r.data.answer, question: r.data.question }));

// ─── CHAT HISTORY ─────────────────────────────────────────────────────────
export const getChatHistory = (
  limit = 50,
): Promise<{ role: "user" | "assistant"; content: string }[]> =>
  api
    .get(`/chat/history?limit=${limit}`)
    .then((r) => r.data.data as { role: "user" | "assistant"; content: string }[]);

export const clearChatHistory = (): Promise<void> =>
  api.delete("/chat/history").then(() => undefined);

// ─── REMINDERS — KHÔNG có trailing slash ──────────────────────────────────
export const getAllReminders = (): Promise<Reminder[]> =>
  api.get("/reminders").then((r) => r.data.data as Reminder[]);

export const markReminderDone = (id: number): Promise<void> =>
  api.put(`/reminders/${id}/done`).then(() => undefined);

export const deleteReminder = (id: number): Promise<void> =>
  api.delete(`/reminders/${id}`).then(() => undefined);
