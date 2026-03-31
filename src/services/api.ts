import axios from 'axios';
import { Note, Reminder } from '../types';
import { API_URL, SERVER_URL } from '../constants/config';

const api = axios.create({ baseURL: API_URL, timeout: 30000 });

export const getAllNotes    = (): Promise<Note[]>  => api.get('/notes').then(r => r.data);
export const getNoteById   = (id: number): Promise<Note> => api.get(`/notes/${id}`).then(r => r.data);
export const createNote    = (content: string): Promise<Note> => api.post('/notes', { content, type: 'text' }).then(r => r.data);
export const deleteNote    = (id: number): Promise<void> => api.delete(`/notes/${id}`).then(r => r.data);
export const searchNotes   = (q: string): Promise<Note[]> => api.get(`/notes/search?q=${encodeURIComponent(q)}`).then(r => r.data);

export const uploadImage = async (imageUri: string): Promise<Note> => {
  const formData = new FormData();
  formData.append('image', { uri: imageUri, name: 'photo.jpg', type: 'image/jpeg' } as any);
  const res = await fetch(`${SERVER_URL}/api/notes/image`, {
    method: 'POST',
    body: formData,
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.json();
};

export const getAllReminders  = (): Promise<Reminder[]> => api.get('/reminders').then(r => r.data);
export const createReminder  = (noteId: number, title: string, remindAt: string): Promise<Reminder> =>
  api.post('/reminders', { noteId, title, remindAt }).then(r => r.data);
export const markReminderDone = (id: number): Promise<void> => api.put(`/reminders/${id}/done`).then(r => r.data);