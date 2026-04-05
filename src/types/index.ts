import { RootTagContext } from "react-native";
import { registerRootComponent } from 'expo';
import App from '../../App';


registerRootComponent(App);

//khoi tao kieu du lieu Note
export interface Note {
  id: number;
  content: string;
  summary?: string;        // ? = không bắt buộc
  type: 'text' | 'image' | 'voice';  // chỉ nhận 1 trong 3 giá trị
  file_path?: string;
  tags: string;            // JSON string: '["Công việc", "Quan trọng"]'
  created_at: string;
}

//khoi tao kieu du lieu Reminder
export interface Reminder{
    id: number;
    note_id?: number;
    title: string;
    remind_at: string;
    is_done: number; //0 == chua xong, 1 == da hoan thanh
    create_at: string;
}

//khoi tao kieu props cho NoteCard component
export interface NoteCardProps{
    note: Note;
    onPress?: () => void;
    onDelete?: () => void;
    onHold?:() => void;
}

//khoi tao params cho navigation
export type RootStackParamList = {
    HomeList: undefined;
    Detail: {nodeId: number};
}

export type RootTabParamList ={
    Home: undefined;
    Capture: undefined;
    Search: undefined;
    Reminders: undefined;
}

