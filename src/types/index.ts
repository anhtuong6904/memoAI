
//khoi tao kieu du lieu Note
export interface Note {
  id:           number;
  title?:       string;        // optional — voice/image có thể không có title
  content:      string;
  summary?:     string;
  type:         'text' | 'image' | 'voice' | 'video';
  file_path?:   string;
  tags:         string;        // JSON string
  source_url?:  string;        // link nguồn nếu capture từ web
  location?:    string;        // JSON string vị trí
  is_pinned:    number;        // 0 | 1
  is_archived:  number;        // 0 | 1
  ai_processed: number;        // 0 | 1
  created_at:   string;
  updated_at:   string;
}

//khoi tao kieu du lieu Reminder
export interface Reminder{
    id: number;
    note_id?: number;
    title: string;
    remind_at: string;
    is_done: number; //0 == chua xong, 1 == da hoan thanh
    created_at: string;
}

//khoi tao kieu props cho NoteCard component
export interface NoteCardProps{
    note: Note;
    onPress: () => void;
    onDelete?: () => void;
    onHold?:() => void;
}

export interface TagPillProps{
    label: string;
    color?: string;
}

export interface EmptyStateProps{
    message: string;
    icon?: string;
}

export interface LoadingSpinnerProps{
    size?: 'small' | 'large';
    color?: string;
}

export type BlockType =
  | 'text'        // đoạn văn thường
  | 'heading1'    // # Tiêu đề lớn
  | 'heading2'    // ## Tiêu đề vừa
  | 'heading3'    // ### Tiêu đề nhỏ
  | 'bullet'      // • danh sách
  | 'numbered'    // 1. danh sách số
  | 'checkbox'    // ☐ checklist
  | 'quote'       // > trích dẫn
  | 'divider';    // --- đường kẻ ngang

export interface Block {
  id:       string;   // unique id cho mỗi block
  type:     BlockType;
  content:  string;   // nội dung text
  checked?: boolean;  // chỉ dùng cho type = 'checkbox'
}

// Lệnh slash menu
export interface SlashCommand {
  id:      BlockType;
  label:   string;
  icon:    string;
  desc:    string;
}

export const SLASH_COMMANDS: SlashCommand[] = [
  { id: 'text',      icon: '¶',  label: 'Đoạn văn',      desc: 'Văn bản thông thường'   },
  { id: 'heading1',  icon: 'H1', label: 'Tiêu đề lớn',   desc: 'Cỡ chữ lớn nhất'       },
  { id: 'heading2',  icon: 'H2', label: 'Tiêu đề vừa',   desc: 'Cỡ chữ vừa'            },
  { id: 'heading3',  icon: 'H3', label: 'Tiêu đề nhỏ',   desc: 'Cỡ chữ nhỏ'            },
  { id: 'bullet',    icon: '•',  label: 'Danh sách',      desc: 'Danh sách dấu chấm'    },
  { id: 'numbered',  icon: '1.', label: 'Danh sách số',   desc: 'Danh sách đánh số'     },
  { id: 'checkbox',  icon: '☐',  label: 'Checklist',      desc: 'Ô checkbox'             },
  { id: 'quote',     icon: '"',  label: 'Trích dẫn',      desc: 'Highlight nổi bật'     },
  { id: 'divider',   icon: '—',  label: 'Đường kẻ',       desc: 'Phân cách nội dung'    },
];

//khoi tao params cho navigation
export type RootStackParamList = {
  HomeList: undefined;
  Edit: { noteId?: number };
}

export type RootTabParamList ={
    Home: undefined;
    Capture: undefined;
    Search: undefined;
    Reminders: undefined;
}

//api response


export interface ApiError {
    error: string;
}

export interface DeleteResponse{
    message: string;
    id: number;
}

//error props
export interface ErrorProps{
    value?: string;
    onReload: () => Promise<void>;
}

//Home Props
export interface HomeHeaderProps{
    total: number;
    loading: boolean;
    onAddPress: () => void;
}

export interface HomeSearchSection{
    value: string;
    onChange: (text: string) => void;
}

export const FILTER_TYPES = [
  { key: 'all',   label: 'Tất cả' },
  { key: 'text',  label: 'Ghi chú' },
  { key: 'image', label: 'Ảnh'     },
  { key: 'voice', label: 'Giọng nói' },
  { key: 'video', label: 'Video'   },
] as const;

export type FilterKey = typeof FILTER_TYPES[number]['key'];


export interface NotesListProps {
  data: Note[];
  loading: boolean;
  refreshing: boolean;
  onRefresh: () => void;
  onDelete: (id: number) => void;
  onPress: (note: Note) => void; // ✅ thêm dòng này
  search: string;
  filter: FilterKey;
}


//capture component
export interface ActionItem{
    key: string;
    icon: React.ReactElement;
    label: string;
}
export interface CaptureAttachmentQuickActionProps{
    onPress: (key:string) => void;
}
export interface CaptureContentComposerProps {
  value: string;
  onChangeText: (text: string) => void;
}

export interface MarkdownTemplate {
  key: string;
  
  label: string;
  snippet: string;
}

export interface CaptureDateTimeRowProps{
    dateLabel: string;
    startLabel: string;
    endLabel: string;
    onPickDate:() => void;
    onPickStart:() => void;
    onPickEnd: () => void;
}

export interface CaptureHeaderProps {
  title: string;
  subtitle?: string;
  onActionPress?: () => void;
}

export type CaptureMode = 'note' | 'task' | 'meeting';

export interface CaptureModeTabsProps {
  mode: CaptureMode;
  onModeChange: (mode: CaptureMode) => void;
}

export interface CaptureSectionCardProps{
    label: string;
    helper?: string;
    children: React.ReactNode;
}

export interface CaptureTitleInputProps {
  value: string;
  onChangeText: (text: string) => void;
}

export interface ChatInputProp{
    
} 
export interface ChatInputField{
    
} 

export interface ChatInputActions{

}

export interface MessageListProp{

}
export interface MessageItem{

}
export interface MessageBubble{

}


