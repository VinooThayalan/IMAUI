/**
 * The broker a contract note's printed name refers to, or null.
 *
 * Generic words (Pvt, Ltd, Securities, Capital…) are ignored: a broker matches
 * when every distinctive word of its name appears in the note's, and only an
 * unambiguous single match counts. A guessed broker is worse than none (bug-56).
 */

const GENERIC = new Set([
  'pvt', 'private', 'ltd', 'limited', 'plc', 'co', 'company', 'the', 'and', 'of',
  'securities', 'equities', 'capital', 'brokers', 'stockbrokers', 'stock', 'broking',
]);

const words = (name: string) =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(/\s+/).filter(Boolean);

const distinctive = (name: string) => words(name).filter(w => !GENERIC.has(w));

export function matchBrokerByName<B extends { broker_name: string }>(printedName: string | null | undefined, brokers: B[]): B | null {
  if (!printedName) return null;
  const printed = new Set(words(printedName));
  const matches = brokers.filter(b => {
    const own = distinctive(b.broker_name);
    return own.length > 0 && own.every(w => printed.has(w));
  });
  return matches.length === 1 ? matches[0] : null;
}

const COMPANY_WORD = /\b(securities|stockbrokers|brokers|equities|capital|limited|ltd|pvt|private)\b/i;

/**
 * The broker a note names anywhere on the page, for notes whose heading names none (LOLC
 * prints its name at the foot). Only company-name lines count: an address ending
 * "Sri Lanka" would otherwise name Lanka Securities. Null unless they all name one broker.
 */
export function matchBrokerOnPage<B extends { id: string; broker_name: string }>(lines: string[], brokers: B[]): { broker: B; line: string } | null {
  const named = lines
    .filter(line => COMPANY_WORD.test(line))
    .map(line => ({ line, broker: matchBrokerByName(line, brokers) }))
    .filter((n): n is { line: string; broker: B } => n.broker !== null);
  return new Set(named.map(n => n.broker.id)).size === 1 ? named[0] : null;
}
