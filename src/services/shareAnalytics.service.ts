/**
 * Loading the sources the Share Analytics report replays.
 *
 * Exists because a page may not import a repository. ShareAnalytics reached
 * straight into `notes.repo` for the contract notes, which put a data-access
 * call one layer above where the rules put it — and the rules are the reason the
 * note read has exactly one `ORDER BY` rather than one per screen.
 *
 * One function today. That is deliberate rather than apologetic: the rest of the
 * page's source loading — transactions, opening balances, dividends, prices,
 * scrips — belongs here too, and this is the seam it lands on when that screen
 * is migrated. Tracked under the `architecture` label.
 *
 * No React, no Supabase.
 */

import * as notesRepo from '../repositories/notes.repo';

/**
 * Every settled contract note, in replay order.
 *
 * A passthrough, and it stays one until there is a second caller or a second
 * source to join. What it buys now is that the page no longer knows there is a
 * `buy_sell_notes` table.
 */
export async function loadProcessedNotes(): Promise<notesRepo.NoteRow[]> {
  return notesRepo.listProcessed();
}
