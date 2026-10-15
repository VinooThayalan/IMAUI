import { loadEntityAccounts, loadNoteReviewTransactions, noteParties } from '../services/noteReview.service';

export type { EntityAccount, NoteParties, NoteReviewTransaction } from '../services/noteReview.service';

/** Buy & Sell Note Approvals: its transactions and accounts, and a note's parties. */
export function useNoteReview() {
  return { loadTransactions: loadNoteReviewTransactions, loadAccounts: loadEntityAccounts, parties: noteParties };
}
