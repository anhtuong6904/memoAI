/**
 * src/services/api.ts
 * Toàn bộ API calls cho MemoAI
 * Aligned với Python FastAPI backend (port 8000)
 *
 * Backend response format: { success: boolean, data: T, ... }
 * Tất cả functions unwrap .data trước khi trả về
 */

import axios from "axios";
import { SERVER_URL } from "../constants/config";
import { Note, Reminder } from "../types";

// ── Axios instance dùng chung ─────────────────────────────────────────────────
const api = axios.create({
  baseURL: SERVER_URL,
  timeout: 60000, // 60s — llava đọc ảnh cần thời gian
  headers: { "Content-Type": "application/json" },
});

// ── Interceptor: log lỗi ra console khi dev ───────────────────────────────────
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const msg = err.response?.data?.detail || err.message || "Unknown error";
    console.error(`[API Error] ${err.config?.url}:`, msg);
    return Promise.reject(new Error(msg));
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// NOTES CRUD
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Lấy danh sách notes.
 * Backend: GET /notes?tag=&type=&limit=&offset=
 *
 * @param tag    - lọc theo tag vd: "liên hệ"
 * @param type   - lọc theo loại: 'text' | 'image' | 'voice' | 'video'
 * @param limit  - số note tối đa (default 10)
 * @param offset - bỏ qua bao nhiêu note (phân trang)
 */
export const getAllNotes = (options?: {
  tag?: string;
  type?: string;
  limit?: number;
  offset?: number;
}): Promise<Note[]> => {
  const params = new URLSearchParams();
  if (options?.tag) params.set("tag", options.tag);
  if (options?.type) params.set("type", options.type);
  if (options?.limit) params.set("limit", String(options.limit));
  if (options?.offset) params.set("offset", String(options.offset));

  return api
    .get(`/notes?${params.toString()}`)
    .then((r) => r.data.data as Note[]); // unwrap { success, data: Note[] }
};

/**
 * Lấy 1 note theo ID, kèm extracted_info.
 * Backend: GET /notes/:id
 * Trả về: { data: Note, extracted: ExtractedInfo | null }
 */
export const getNoteByID = (
  id: number,
): Promise<{
  data: Note;
  extracted: Record<string, any> | null;
}> =>
  api.get(`/notes/${id}`).then((r) => ({
    data: r.data.data as Note,
    extracted: r.data.extracted as Record<string, any> | null,
  }));

/**
 * Tạo note mới (text thuần — không qua AI pipeline).
 * Backend: POST /notes
 * Dùng khi user gõ tay trong EditScreen.
 */
export const createNote = (content: string, title?: string): Promise<Note> =>
  api
    .post("/notes", { content, title, type: "text" })
    .then((r) => r.data.data as Note);

/**
 * Cập nhật note.
 * Backend: PUT /notes/:id
 * Chỉ gửi fields muốn thay đổi — backend tự bỏ qua fields null.
 */
export const updateNote = (
  id: number,
  data: Partial<
    Pick<
      Note,
      "title" | "content" | "summary" | "tags" | "is_pinned" | "is_archived"
    >
  >,
): Promise<Note> =>
  api.put(`/notes/${id}`, data).then((r) => r.data.data as Note);

/**
 * Xóa note.
 * Backend: DELETE /notes/:id
 * ON DELETE CASCADE → tự xóa extracted_info, reminders, note_tags liên quan.
 */
export const deleteNote = (id: number): Promise<void> =>
  api.delete(`/notes/${id}`).then(() => undefined);

/**
 * Toggle ghim note lên đầu.
 * Gọi updateNote với is_pinned đảo ngược.
 */
export const togglePin = async (note: Note): Promise<Note> =>
  updateNote(note.id, { is_pinned: note.is_pinned === 1 ? 0 : 1 });

/**
 * Toggle lưu trữ note (ẩn khỏi danh sách chính).
 */
export const toggleArchive = async (note: Note): Promise<Note> =>
  updateNote(note.id, { is_archived: note.is_archived === 1 ? 0 : 1 });

// ─────────────────────────────────────────────────────────────────────────────
// CAPTURE — AI Pipeline
// Dùng fetch thay axios vì React Native xử lý FormData + file tốt hơn với fetch
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Helper nội bộ: gửi FormData lên backend.
 * Không export — dùng qua captureImage / captureVoice / captureText.
 */
const postFormData = async (
  endpoint: string,
  formData: FormData,
): Promise<any> => {
  const response = await fetch(`${SERVER_URL}${endpoint}`, {
    method: "POST",
    body: formData,
    // Không set Content-Type — fetch tự thêm boundary cho multipart/form-data
  });

  const json = await response.json();

  if (!response.ok) {
    throw new Error(json.detail || json.error || "Upload thất bại");
  }

  return json;
};

/**
 * Capture text → AI pipeline.
 * Backend: POST /capture/text
 * mistral:7b trích xuất thông tin → tạo note mới + extracted_info.
 *
 * @param text     - nội dung text user nhập
 * @param location - JSON string vị trí GPS (optional)
 *                   vd: '{"lat":10.76,"lng":106.66,"address":"Quận 1"}'
 */
export const captureText = async (
  text: string,
  location?: string,
): Promise<Note> => {
  const formData = new FormData();
  formData.append("text", text);
  if (location) formData.append("location", location);

  const result = await postFormData("/capture/text", formData);
  return result.data as Note;
};

/**
 * Capture ảnh → AI pipeline.
 * Backend: POST /capture/image
 * llava:7b đọc ảnh → trích xuất text + thông tin → tạo note mới.
 *
 * @param imageUri - URI từ expo-image-picker vd: "file:///data/.../photo.jpg"
 * @param location - JSON string vị trí GPS (optional)
 *
 * Trả về Note với file_url = "http://192.168.x.x:8000/uploads/images/xxx.jpg"
 * → Dùng trực tiếp trong <Image source={{ uri: note.file_url }} />
 */
export const captureImage = async (
  imageUri: string,
  location?: string,
): Promise<Note> => {
  const formData = new FormData();
  formData.append("file", {
    uri: imageUri,
    name: `photo-${Date.now()}.jpg`,
    type: "image/jpeg",
  } as any);
  if (location) formData.append("location", location);

  const result = await postFormData("/capture/image", formData);
  return result.data as Note;
};

/**
 * Capture giọng nói → AI pipeline.
 * Backend: POST /capture/voice
 * Whisper STT → transcript → mistral trích xuất → tạo note mới.
 *
 * @param audioUri - URI từ expo-av vd: "file:///data/.../recording.m4a"
 * @param location - JSON string vị trí GPS (optional)
 *
 * Trả về Note với:
 *   file_url   = "http://192.168.x.x:8000/uploads/audio/xxx.m4a"
 *   transcript = "nội dung giọng nói đã nhận diện"
 * → Phát lại audio: <Audio source={{ uri: note.file_url }} />
 */
export const captureVoice = async (
  audioUri: string,
  location?: string,
): Promise<Note & { transcript: string }> => {
  const isM4a = audioUri.toLowerCase().includes(".m4a");
  const mimeType = isM4a ? "audio/x-m4a" : "audio/mp4";
  const fileName = `voice-${Date.now()}.${isM4a ? "m4a" : "mp4"}`;

  const formData = new FormData();
  formData.append("file", {
    uri: audioUri,
    name: fileName,
    type: mimeType,
  } as any);
  if (location) formData.append("location", location);

  const result = await postFormData("/capture/voice", formData);
  return {
    ...(result.data as Note),
    transcript: result.transcript as string,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// AI — Search & Chat
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Tìm kiếm semantic — LLM hiểu ngữ nghĩa, không chỉ match keyword.
 * Backend: POST /search
 *
 * Ví dụ:
 *   "số điện thoại"     → tìm notes có contact info
 *   "cuộc họp tuần tới" → tìm meeting notes
 */
export const searchNotes = (keyword: string): Promise<Note[]> =>
  api.post("/search", { keyword }).then((r) => r.data.data as Note[]);

/**
 * Chat với AI về toàn bộ notes (Second Brain).
 * Backend: POST /chat
 *
 * @param question - câu hỏi của user
 * @param history  - lịch sử chat [{ role: 'user'|'assistant', content: '...' }]
 *
 * Ví dụ câu hỏi:
 *   "Số điện thoại của anh Minh là gì?"
 *   "Tôi có cuộc họp nào sắp tới không?"
 *   "Tóm tắt những gì tôi đã ghi chú tuần này"
 */
export const chatWithAI = (
  question: string,
  history: { role: "user" | "assistant"; content: string }[] = [],
): Promise<{ answer: string; question: string }> =>
  api
    .post("/chat", { question, history })
    .then((r) => ({ answer: r.data.answer, question: r.data.question }));

// ─────────────────────────────────────────────────────────────────────────────
// REMINDERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Lấy danh sách reminders chưa hoàn thành, sắp xếp theo thời gian gần nhất.
 * Backend: GET /reminders
 *
 * Mỗi reminder kèm note_title từ JOIN với bảng notes.
 */
export const getAllReminders = (): Promise<Reminder[]> =>
  api.get("/reminders").then((r) => r.data.data as Reminder[]);

/**
 * Lấy tất cả reminders kể cả đã xong.
 * Backend: GET /reminders?include_done=true
 */
export const getAllRemindersIncludeDone = (): Promise<Reminder[]> =>
  api
    .get("/reminders?include_done=true")
    .then((r) => r.data.data as Reminder[]);

/**
 * Đánh dấu reminder là đã hoàn thành.
 * Backend: PUT /reminders/:id/done
 */
export const markReminderDone = (id: number): Promise<void> =>
  api.put(`/reminders/${id}/done`).then(() => undefined);
