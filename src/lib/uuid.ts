/**
 * A v4 UUID generated in the browser.
 *
 * `crypto.randomUUID()` is the obvious call and cannot be used here: it is
 * gated on a secure context, and this app is served over plain http, so it is
 * `undefined` in deployment. `crypto.getRandomValues()` carries no such gate —
 * it is available in insecure contexts — so the bytes are drawn from it and
 * laid out by hand.
 *
 * Why generate an id at all, when `entities.id` is `uuid PRIMARY KEY DEFAULT
 * gen_random_uuid()` and the database will happily make one?
 *
 * Because the database making it and the client *learning* it are different
 * problems. The only way to read back a generated id is `INSERT ... RETURNING`,
 * and Postgres applies the table's SELECT policy to the row it returns. On
 * `entities` that policy is `has_entity_access(id)` — a grant naming an id that
 * already exists — so a row created a moment ago can never satisfy it. Checked
 * against production: of the six users who can reach the Entities form, the two
 * admins can read a new row back and the four non-admins cannot.
 *
 * And the id is genuinely needed, not merely convenient: `audit_logs` accepts
 * inserts from anyone (`WITH CHECK (true)`), so every creator writes an audit
 * row, and `record_id` is populated on all six existing `entities` audit rows.
 * Dropping the id would break that trail for admins too.
 *
 * So either the client supplies the id, or a SECURITY DEFINER function hands it
 * back. Supplying it is the smaller change — the column default simply goes
 * unused, and no new database surface has to be maintained in lockstep with the
 * column list. See `createEntity` in `src/services/entities.service.ts`.
 */
export function newUuidV4(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);

  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10xx

  const hex: string[] = [];
  for (let i = 0; i < 16; i++) hex.push(bytes[i].toString(16).padStart(2, '0'));

  return (
    hex.slice(0, 4).join('') +
    '-' +
    hex.slice(4, 6).join('') +
    '-' +
    hex.slice(6, 8).join('') +
    '-' +
    hex.slice(8, 10).join('') +
    '-' +
    hex.slice(10, 16).join('')
  );
}
