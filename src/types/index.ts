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
    onPress?: () => void;
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
    Detail: {noteId: number};
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

