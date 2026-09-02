/**
 * Who a transactional email is addressed to.
 *
 * Both halves of the dialog were answered separately on every screen that opens
 * it, and the answers disagreed.
 *
 * **CC** — three copies, one of which answered "none":
 *
 *   Transactions.handleEmailTransaction      setCcAddresses([])   <- reported
 *   Transactions.handleCancelNotifyBroker    all three slots
 *   TransactionApprovals.openEmailModal      all three slots
 *
 * So the same dialog filled its CC row or left it empty depending on which
 * button opened it.
 *
 * **To** — two copies, one of which cannot answer at all:
 *
 *   Transactions            resolves through entity_brokers, offers candidates
 *   TransactionApprovals    transaction.broker_id only
 *
 * `transactions.broker_id` is null on essentially every row, so on Transaction
 * Approvals the To box came up empty with nothing to click and nothing said. The
 * resolver below is the one Transactions already used; both screens now share it.
 */

/** The CC-bearing columns of `entities`. Optional so any row shape satisfies it. */
export interface EntityCcContacts {
  cc_email?: string | null;
  cc_email_2?: string | null;
  cc_email_3?: string | null;
}

/**
 * The CC list for an entity's transactional email, in slot order.
 *
 * Blank slots are absent rather than empty strings: a `NULL` column and one
 * holding `'   '` both mean nobody was named, and an empty recipient reaching the
 * send path is a bounce, not a CC. Nothing is invented to fill the gap — an
 * entity with no CC addresses returns `[]`, and the dialog shows its placeholder.
 *
 * De-duplicated case-insensitively, keeping the first spelling seen. Two slots
 * holding the same person is a data entry accident, and mailing them twice is a
 * defect the reader sees.
 */
export function entityCcAddresses(entity: EntityCcContacts | null | undefined): string[] {
  if (!entity) return [];

  const slots = [entity.cc_email, entity.cc_email_2, entity.cc_email_3];
  const out: string[] = [];
  const seen = new Set<string>();

  for (const slot of slots) {
    if (typeof slot !== 'string') continue;
    const address = slot.trim();
    if (!address) continue;
    const key = address.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(address);
  }

  return out;
}

/** A broker as the recipient rules need it. */
export interface BrokerContact {
  id: string;
  broker_name: string;
  contact_person_email?: string | null;
}

/** A row of `entity_brokers`: which broker or custodian an entity trades through. */
export interface EntityBrokerLink {
  entity_id: string;
  broker_id?: string | null;
  broker_account_number?: string | null;
  custodian_account_number?: string | null;
}

/** The fields of a transaction that decide who it is addressed to. */
export interface RecipientTransaction {
  entity_id: string;
  broker_id?: string | null;
  cds_account_id?: string | null;
}

export interface ResolvedRecipient<B extends BrokerContact, L extends EntityBrokerLink> {
  /** Set only when the answer is unambiguous. Null means do not prefill. */
  broker: B | null;
  /** Every broker assigned to the entity, deduplicated, by name. */
  candidates: B[];
  /** What the dialog should offer as one-click recipients. */
  recipientOptions: B[];
  /** Several brokers assigned and nothing to choose between them on. */
  ambiguous: boolean;
  /**
   * The matched assignment, for the account numbers shown in the email body.
   * Generic so a caller keeps whatever else its own row type carries —
   * `relationship_type` and `bank_account_number` are read off it downstream.
   */
  entityBroker: L | null;
}

/**
 * Which broker a transaction's confirmation goes to.
 *
 * `broker` is set only when the answer is unambiguous — the transaction names a
 * broker, its CDS account matches an assignment, or the entity has exactly one
 * broker. It is deliberately not a guess: with several brokers assigned and
 * nothing to match on, guessing would address a client's trade details to an
 * unrelated brokerage. The ambiguity is handed to the user through `candidates`
 * instead, and `ambiguous` says to explain why nothing was prefilled.
 *
 * Account numbers are compared exactly, on purpose. ENT001 carries a custodian
 * account `CMB - 5826 - LC/000` while its transactions carry
 * `CMB - 5826 - LC/00` — one character apart. Matching loosely to paper over that
 * would silently pick a custodian nobody confirmed; it is a data discrepancy to
 * correct in the records, not a comparison to weaken here.
 */
export function resolveTransactionRecipient<B extends BrokerContact, L extends EntityBrokerLink>(
  transaction: RecipientTransaction,
  entityBrokers: L[],
  brokers: B[],
): ResolvedRecipient<B, L> {
  const entityBroker = entityBrokers.find(eb =>
    eb.entity_id === transaction.entity_id && (
      (transaction.broker_id && eb.broker_id === transaction.broker_id) ||
      (transaction.cds_account_id && (
        eb.broker_account_number === transaction.cds_account_id ||
        eb.custodian_account_number === transaction.cds_account_id
      ))
    )
  ) ?? null;

  const fallbackEntityBroker = !transaction.broker_id && !entityBroker?.broker_id
    ? entityBrokers.find(eb => eb.entity_id === transaction.entity_id && eb.broker_id) ?? null
    : null;

  const candidates = Array.from(new Set(
    entityBrokers
      .filter(eb => eb.entity_id === transaction.entity_id && eb.broker_id)
      .map(eb => eb.broker_id),
  ))
    .map(id => brokers.find(b => b.id === id))
    .filter((b): b is B => Boolean(b))
    .sort((a, b) => a.broker_name.localeCompare(b.broker_name));

  const exactId = transaction.broker_id || entityBroker?.broker_id || null;
  const exact = exactId ? brokers.find(b => b.id === exactId) ?? null : null;

  const broker = exact ?? (candidates.length === 1 ? candidates[0] : null);

  /*
    Once the broker is known, listing the entity's others reads as though the
    choice were still open — the symptom reported as "multiple brokers shown in
    the CC options after one is selected".
  */
  const recipientOptions = exact ? [exact] : candidates;

  return {
    broker,
    candidates,
    recipientOptions,
    ambiguous: !exact && candidates.length > 1,
    entityBroker: entityBroker ?? fallbackEntityBroker,
  };
}

/**
 * The CC list as the send path should carry it.
 *
 * Three senders each trimmed their own way, and none of them checked the CC list
 * against the To address. Nothing stops a user pasting the broker's address into
 * CC — or the entity holding it in a CC slot — and the recipient then gets the
 * same email twice, which reads as a system fault rather than a data one.
 *
 * Blank entries are dropped for the reason `entityCcAddresses` drops blank
 * slots: an empty recipient reaching Brevo is a bounce, not a CC. Duplicates
 * within the list go too, keeping the first spelling seen.
 */
export function ccForSend(to: string | null | undefined, cc: string[]): string[] {
  const primary = (to ?? '').trim().toLowerCase();
  const out: string[] = [];
  const seen = new Set<string>();

  for (const entry of cc) {
    if (typeof entry !== 'string') continue;
    const address = entry.trim();
    if (!address) continue;
    const key = address.toLowerCase();
    if (key === primary || seen.has(key)) continue;
    seen.add(key);
    out.push(address);
  }

  return out;
}
