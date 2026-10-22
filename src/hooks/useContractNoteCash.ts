import { useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  deleteNote,
  noteCashProblem,
  postNoteCash,
  saveNoteEdit,
  type NoteCash,
  type NoteEdit,
} from '../services/contractNotes.service';

export type { NoteCash, NoteEdit };

export function useContractNoteCash() {
  const { user } = useAuth();
  const performedBy = user?.email || 'system';

  const postCash = useCallback(
    (n: NoteCash, createdBy: string) => postNoteCash(n, { createdBy, performedBy }),
    [performedBy],
  );
  const saveEdit = useCallback((noteId: string, values: NoteEdit) => saveNoteEdit(noteId, values, performedBy), [performedBy]);
  const removeNote = useCallback((noteId: string) => deleteNote(noteId, performedBy), [performedBy]);

  return { postCash, saveEdit, removeNote, cashProblem: noteCashProblem };
}
