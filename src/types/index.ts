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

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export type RootStackParamList = {
  HomeList: undefined;
  Edit: { noteId?: number; initialNote?: Note };
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

