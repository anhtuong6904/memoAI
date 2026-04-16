import iconSet from '@expo/vector-icons/build/Fontisto';
import Fontisto from '@expo/vector-icons/Fontisto';

//khoi tao kieu du lieu Note
export interface Note {
  id:           number;
  content:      string;
  summary?:     string;        // ? = không bắt buộc
  type:         'text' | 'image' | 'voice' | 'video';  // chỉ nhận 1 trong 3 giá trị
  file_path?:   string;
  tags:         string;            // JSON string: '["Công việc", "Quan trọng"]'
  created_at:   string;
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

//khoi tao params cho navigation
export type RootStackParamList = {
  HomeList: undefined;
  Detail: { noteId: number };
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


