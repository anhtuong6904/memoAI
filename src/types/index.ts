export interface Note {
  id: number;
  title?: string;
  content: string;
  content_json?: string;
  summary?: string;
  type: "text" | "image" | "voice" | "video";
  file_path?: string;
  file_url?: string;
  tags: string;
  source_url?: string;
  location?: string;
  is_pinned: number;
  is_archived: number;
  ai_processed: number;
  created_at: string;
  updated_at: string;
}

export interface Reminder {
  id: number;
  note_id?: number;
  title: string;
  body?: string;
  remind_at: string;
  repeat_type?: string;
  is_done: number;
  created_at: string;
  note_title?: string;
}

export interface FileAttachment {
  id: string;
  name: string;
  uri: string;
  mimeType?: string;
  size?: number;
  uploaded: boolean;
  remoteUrl?: string;
}

// Kiểu trả về từ backend (bảng note_attachments)
export interface NoteAttachment {
  id: number;
  note_id: number;
  file_name: string;
  file_path: string;
  file_url: string;
  mime_type?: string;
  file_group: "image" | "audio" | "video" | "document";
  file_size?: number;
  created_at: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export type RootStackParamList = {
  HomeList: undefined;
  Edit: { noteId?: number };
};

export type RootTabParamList = {
  Home: undefined;
  Search: undefined;
  Chat: undefined;
  Reminders: undefined;
};

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
  onChange: (t: string) => void;
}

export const FILTER_TYPES = [
  { key: "all", label: "Tat ca" },
  { key: "text", label: "Ghi chu" },
  { key: "image", label: "Anh" },
  { key: "voice", label: "Giong noi" },
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

export type BlockType =
  | "text"
  | "heading1"
  | "heading2"
  | "heading3"
  | "bullet"
  | "numbered"
  | "checkbox"
  | "quote"
  | "divider";

export interface Block {
  id: string;
  type: BlockType;
  content: string;
  checked?: boolean;
}
export interface SlashCommand {
  id: BlockType;
  label: string;
  icon: string;
  desc: string;
}
export const SLASH_COMMANDS: SlashCommand[] = [
  { id: "text", icon: "P", label: "Doan van", desc: "Van ban thuong" },
  { id: "heading1", icon: "H1", label: "Tieu de lon", desc: "Co chu lon nhat" },
  { id: "heading2", icon: "H2", label: "Tieu de vua", desc: "Co chu vua" },
  { id: "heading3", icon: "H3", label: "Tieu de nho", desc: "Co chu nho" },
  { id: "bullet", icon: "*", label: "Danh sach", desc: "Dau cham" },
  { id: "numbered", icon: "1.", label: "So thu tu", desc: "Danh so" },
  { id: "checkbox", icon: "[]", label: "Checklist", desc: "O checkbox" },
  { id: "quote", icon: '"', label: "Trich dan", desc: "Highlight" },
  { id: "divider", icon: "--", label: "Duong ke", desc: "Phan cach" },
];
