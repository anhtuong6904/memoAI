// src/types/index.ts

// ── Note ──────────────────────────────────────────────────────────────────────

export interface Note {
  id: number;
  title?: string;
  content: string;
  summary?: string;
  type: "text" | "image" | "voice" | "video";
  file_path?: string; // relative: "uploads/images/xxx.jpg"
  tags: string; // JSON string
  source_url?: string;
  location?: string;
  is_pinned: number;
  is_archived: number;
  ai_processed: number;
  created_at: string;
  updated_at: string;
}

// ── Reminder ──────────────────────────────────────────────────────────────────

export interface Reminder {
  id: number;
  note_id?: number;
  title: string;
  remind_at: string;
  is_done: number;
  created_at: string;
}

// ── Block ─────────────────────────────────────────────────────────────────────

export type BlockType =
  | "text"
  | "heading1"
  | "heading2"
  | "heading3"
  | "bullet"
  | "numbered"
  | "checkbox"
  | "quote"
  | "divider"
  // ── Media blocks ─────────────────────────────────────
  | "image" // ảnh — chọn từ thư viện hoặc chụp
  | "audio" // ghi âm — từ expo-av
  | "video" // video — từ thư viện
  | "file"; // file tuỳ loại — pdf, docx, ...

export interface Block {
  id: string;
  type: BlockType;
  content: string; // text content (empty string với media blocks)
  checked?: boolean; // chỉ dùng cho checkbox

  // ── Media fields (chỉ dùng với image | audio | video | file) ─────────────
  /** URI local từ picker / recorder. Dùng để hiển thị trước khi upload */
  uri?: string;
  /** Tên file gốc, vd: "photo-2026.jpg", "recording.m4a", "report.pdf" */
  fileName?: string;
  /** MIME type, vd: "image/jpeg", "audio/x-m4a", "application/pdf" */
  mimeType?: string;
  /** Kích thước file (bytes) */
  fileSize?: number;
  /** Duration (ms) — chỉ dùng cho audio / video */
  duration?: number;
  /** Width / height — chỉ dùng cho image */
  width?: number;
  height?: number;
}

// ── Slash commands ────────────────────────────────────────────────────────────

export interface SlashCommand {
  id: BlockType;
  label: string;
  icon: string;
  desc: string;
}

export const SLASH_COMMANDS: SlashCommand[] = [
  // Text formatting
  { id: "text", icon: "¶", label: "Đoạn văn", desc: "Văn bản thông thường" },
  { id: "heading1", icon: "H1", label: "Tiêu đề lớn", desc: "Cỡ chữ lớn nhất" },
  { id: "heading2", icon: "H2", label: "Tiêu đề vừa", desc: "Cỡ chữ vừa" },
  { id: "heading3", icon: "H3", label: "Tiêu đề nhỏ", desc: "Cỡ chữ nhỏ" },
  { id: "bullet", icon: "•", label: "Danh sách", desc: "Danh sách dấu chấm" },
  {
    id: "numbered",
    icon: "1.",
    label: "Danh sách số",
    desc: "Danh sách đánh số",
  },
  { id: "checkbox", icon: "☐", label: "Checklist", desc: "Ô checkbox" },
  { id: "quote", icon: '"', label: "Trích dẫn", desc: "Highlight nổi bật" },
  { id: "divider", icon: "—", label: "Đường kẻ", desc: "Phân cách nội dung" },
  // Media
  { id: "image", icon: "🖼️", label: "Ảnh", desc: "Chèn ảnh từ thư viện" },
  { id: "audio", icon: "🎙️", label: "Ghi âm", desc: "Ghi âm và chèn vào" },
  { id: "video", icon: "🎬", label: "Video", desc: "Chèn video từ thư viện" },
  { id: "file", icon: "📎", label: "File đính kèm", desc: "Đính kèm tài liệu" },
];

// ── Navigation ────────────────────────────────────────────────────────────────

export type RootStackParamList = {
  HomeList: undefined;
  Edit: { noteId?: number };
};

export type RootTabParamList = {
  Home: undefined;
  Capture: undefined;
  Search: undefined;
  Reminders: undefined;
};

// ── Component props ────────────────────────────────────────────────────────────

export interface NoteCardProps {
  note: Note;
  onPress: () => void;
  onDelete?: () => void;
  onHold?: () => void;
}

export interface TagPillProps {
  label: string;
  color?: string;
}

export interface EmptyStateProps {
  message: string;
  icon?: string;
}

export interface LoadingSpinnerProps {
  size?: "small" | "large";
  color?: string;
}

export interface ApiError {
  error: string;
}

export interface DeleteResponse {
  message: string;
  id: number;
}

export interface ErrorProps {
  value?: string;
  onReload: () => Promise<void>;
}

export interface HomeHeaderProps {
  total: number;
  loading: boolean;
  onAddPress: () => void;
}

export interface HomeSearchSection {
  value: string;
  onChange: (text: string) => void;
}

export const FILTER_TYPES = [
  { key: "all", label: "Tất cả" },
  { key: "text", label: "Ghi chú" },
  { key: "image", label: "Ảnh" },
  { key: "voice", label: "Giọng nói" },
  { key: "video", label: "Video" },
] as const;

export type FilterKey = (typeof FILTER_TYPES)[number]["key"];

export interface NotesListProps {
  data: Note[];
  loading: boolean;
  refreshing: boolean;
  onRefresh: () => void;
  onDelete: (id: number) => void;
  onPress: (note: Note) => void;
  search: string;
  filter: FilterKey;
}

// ── Capture ────────────────────────────────────────────────────────────────────

export interface ActionItem {
  key: string;
  icon: React.ReactElement;
  label: string;
}

export type CaptureMode = "note" | "task" | "meeting";
