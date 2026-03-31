import { useState, useEffect, useCallback } from 'react';
import { Note } from '../types';
import { getAllNotes, deleteNote as deleteNoteApi } from '../services/api';

interface UseNotesReturn {
  notes: Note[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  removeNote: (id: number) => Promise<void>;
}

export function useNotes(): UseNotesReturn {
  const [notes, setNotes]     = useState<Note[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError]     = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getAllNotes();
      setNotes(data);
    } catch {
      setError('Không kết nối được server');
    } finally {
      setLoading(false);
    }
  }, []);

  const removeNote = async (id: number) => {
    await deleteNoteApi(id);
    setNotes(prev => prev.filter(n => n.id !== id));
  };

  useEffect(() => { reload(); }, [reload]);

  return { notes, loading, error, reload, removeNote };
}