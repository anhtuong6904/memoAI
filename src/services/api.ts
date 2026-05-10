import axios from "axios";
import { SERVER_URL } from "../constants/config";
import { FileAttachment, Note, Reminder } from "../types";

const api = axios.create({
  baseURL: SERVER_URL,
  timeout: 60000,
  headers: { "Content-Type": "application/json" },
});

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

export const getNoteByID = (
  id: number,
): Promise<{ data: Note; extracted: any; attachments: any[] }> =>
  api.get(`/notes/${id}`).then((r) => ({
    data: r.data.data,
    extracted: r.data.extracted,
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
      | "is_pinned"
      | "is_archived"
    >
  >,
): Promise<Note> =>
  api.put(`/notes/${id}`, data).then((r) => r.data.data as Note);

export const deleteNote = (id: number): Promise<void> =>
  api.delete(`/notes/${id}`).then(() => undefined);

export const togglePin = (note: Note): Promise<Note> =>
  api.put(`/notes/${note.id}/pin`).then((r) => r.data.data as Note);

export const toggleArchive = (note: Note): Promise<Note> =>
  api.put(`/notes/${note.id}/archive`).then((r) => r.data.data as Note);

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

// ─── ANALYZE ──────────────────────────────────────────────────────────────
export const analyzeNote = (noteId: number): Promise<{ extracted: any }> =>
  api.post(`/notes/${noteId}/analyze`).then((r) => r.data);

// ─── AI SEARCH & CHAT ─────────────────────────────────────────────────────
export const searchNotes = (keyword: string): Promise<Note[]> =>
  api.post("/search", { keyword }).then((r) => r.data.data as Note[]);

export const chatWithAI = (
  question: string,
  history: { role: "user" | "assistant"; content: string }[] = [],
): Promise<{ answer: string; question: string }> =>
  api
    .post("/chat", { question, history })
    .then((r) => ({ answer: r.data.answer, question: r.data.question }));

// ─── REMINDERS — KHÔNG có trailing slash ──────────────────────────────────
export const getAllReminders = (): Promise<Reminder[]> =>
  api.get("/reminders").then((r) => r.data.data as Reminder[]);

export const markReminderDone = (id: number): Promise<void> =>
  api.put(`/reminders/${id}/done`).then(() => undefined);
