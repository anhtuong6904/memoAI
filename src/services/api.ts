import axios from 'axios';
import { Note, Reminder } from '../types';
import { API_URL, SERVER_URL } from '../constants/config';

//tao 1 axios dung chung 
//baseURL: moi request deu bat dau tu API_URL
//timeout: neu 30s khong co phan hoi => loi 
const api = axios.create({
  baseURL: API_URL, 
  timeout: 30000,
});

//notes
//lay tat ca cac note
export const getAllNotes = (options?: {
  archived?: boolean;
  pinned?:   boolean;
}): Promise<Note[]> => {
  const params = new URLSearchParams();
  if (options?.archived) params.set('archived', '1');
  if (options?.pinned)   params.set('pinned', '1');
  return api.get(`/notes?${params.toString()}`).then(r => r.data);
};


//lay note theo id
export const getNoteByID = (id : number) : Promise<Note> =>
  api.get(`/notes/${id}`).then(r => r.data);

//search 
// encodeURIComponent: mã hóa ký tự đặc biệt trong tiếng Việt
// vd: "họp nhóm" → "h%E1%BB%8Dp%20nh%C3%B3m"
export const searchNote = (q: string) : Promise<Note> =>
  api.get(`/notes/search?q=${encodeURIComponent(q)}`).then(r => r.data);



//create note
export const createNote = (
  content: string,
  title?: string
): Promise<Note> =>
  api.post('/notes', { content, title, type: 'text' }).then(r => r.data);

//update note
export const updateNote = (
  id : number,
  data : Partial<Pick<Note, 'content'| 'summary' | 'tags'>>
) : Promise<Note> => 
  api.put(`/notes/${id}`, data).then(r => r.data);
  
//delete note
export const deleteNote = (id: number) => 
  api.delete(`/notes/${id}`).then(r => r.data);

//upload file 
//dung fetch thay vi axios vi axios khong xu li tot formdata + file tren react native
//fetch hoat dong on dinh hon multipart/form-data

//helper dung chung: tao formdata va gui file len server
//fieldName: ten field server expect ('image' | 'audio'| 'video')
//fileUri: duong dan file tren thiet bi 
//fileName: ten file
//mimeType: loai file
//endpoint: route tren server 
const uploadFile = async (
  fieldName: string,
  fileUri: string,
  fileName: string,
  mimeType: string,
  endpoint: string
) : Promise<Note> => {
  const formData = new FormData();

  // 'as any' cần thiết vì React Native FormData
  // khác với Web FormData — TypeScript không nhận kiểu này mặc định
  formData.append(fieldName, {
    uri: fileUri,
    name: fileName,
    type: mimeType,
  } as any);

  const response = await fetch(`${SERVER_URL}${endpoint}`, {
    method: 'POST',
    body: formData,
    headers:{'Content-Type' : 'multipart/form-data'},
  })

  if(!response.ok){
    const error = await response.json();
    throw new Error(error.error || 'Upload that bai');  
  }

  return response.json();
}

//upload image nhan uri tu expo-image-picker
export const uploadImage = (imageUri: string) : Promise<Note> =>
  uploadFile(
    'image',
    imageUri,
    `photo-${Date.now()}.jpg`,
    'image/jpeg',
    '/api/notes/image'
  );


//upload audio 
export const uploadAudio = (audioUri: string): Promise<Note> => {
  // Tự động detect đuôi file và mime type
  const isM4a     = audioUri.endsWith('.m4a') || audioUri.includes('.m4a');
  const fileName  = `recording-${Date.now()}.${isM4a ? 'm4a' : 'mp4'}`;
  const mimeType  = isM4a ? 'audio/x-m4a' : 'audio/mp4';

  return uploadFile('audio', audioUri, fileName, mimeType, '/api/notes/audio');
};

//upload video 
export const uploadVideo = (videoUri: string): Promise<Note> =>
  uploadFile(
    'video',
    videoUri,
    `video-${Date.now()}.mp4`,
    'video/mp4',
    '/api/notes/video'
  );


// reminder 
// Lấy tất cả nhắc nhở (kèm thông tin note gốc từ JOIN)
export const getAllReminders = (): Promise<Reminder[]> =>
  api.get('/reminders').then(r => r.data);

// Lấy nhắc nhở sắp tới (chưa xong, chưa qua thời hạn)
export const getUpcomingReminders = (): Promise<Reminder[]> =>
  api.get('/reminders/upcoming').then(r => r.data);

//tao nhac nho moi 
// noteId:   id của ghi chú liên quan (có thể không có)
// title:    tiêu đề nhắc nhở vd: "Gọi cho anh Minh"
// remindAt: ISO string vd: "2025-04-04T09:00:00.000Z"
export const createReminder = (
  noteId: number | null,
  title: string,
  remindAt: string
): Promise<Reminder> =>
  api.post('/reminders', { noteId, title, remindAt }).then(r => r.data);

// Toggle trạng thái hoàn thành (done ↔ undone)
export const markReminderDone = (id: number): Promise<Reminder> =>
  api.put(`/reminders/${id}/done`).then(r => r.data);

// Cập nhật thông tin nhắc nhở
export const updateReminder = (
  id: number,
  data: Partial<Pick<Reminder, 'title' | 'remind_at'>>
): Promise<Reminder> =>
  api.put(`/reminders/${id}`, data).then(r => r.data);

// Xóa nhắc nhở
export const deleteReminder = (id: number): Promise<void> =>
  api.delete(`/reminders/${id}`).then(r => r.data);

export const togglePin = (id: number): Promise<{ is_pinned: number }> =>
  api.patch(`/notes/${id}/pin`).then(r => r.data);

// Toggle lưu trữ
export const toggleArchive = (id: number): Promise<{ is_archived: number }> =>
  api.patch(`/notes/${id}/archive`).then(r => r.data);