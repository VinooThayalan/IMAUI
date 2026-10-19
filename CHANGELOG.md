# Changelog

Every released version, newest first. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

How a release is cut is in [`docs/RELEASING.md`](docs/RELEASING.md).

Entries are written for the people who use the system, not for the people who
wrote it. A figure that changed on screen says so, and says what it changed
from — a reader comparing this release against their own records needs to know
which number moved and why, not which function was renamed.

## [1.1.0] — 2026-10-19

Fixes reported as bug-53 to bug-61, contract notes read as the broker printed
them, and the Reports screen brought into line with Share Analytics. Several
figures move; each is named below with what it read before.

If you import the Share Analytics holdings export into a spreadsheet, read the
first section: two of its columns changed.

### Share Analytics — holdings list columns

- **Cum Surplus is now "Realised Gains/Loss"** in the holdings list, its
  summary card and the holdings export. Same figure; only the name changed. A
  spreadsheet that finds the column by its heading needs updating.
- **The Cash Flow column and the Total Cash Flow card are removed** from the
  holdings list and the holdings export.
- A holding's breakdown, and its export, are unchanged: they still show Cum
  Surplus and Cash Flow +/-.
- Exports can be downloaded as **Excel (.xlsx)** as well as CSV. A holding's
  export opens with the figures shown across the top of its breakdown — shares
  held, average price, market price and its date, market value after fees per
  share, Cum Surplus, AER — above the table.
- **A holding's breakdown could list every event twice** when two rebuilds of
  its figures overlapped (two tabs or two users at once). ALUM.N0000's Cost per
  share row then read a cash flow of 1,151,593.90 where it should read
  881,163.80, and an AER of 3.40% where it should read 4.99%. The duplicates
  are removed and can no longer be stored.

### Reports — the same figures as Share Analytics (#138)

The Share Analytics Report and the Detailed Share Report computed their own
figures, leaving out scrip, valuing holdings before fees, leaving dividends out
of cash flow, and — in the detailed report — running one Cum Surplus across
every holding in the book. All 36 holdings disagreed with Share Analytics. Both
reports now read the same ledger. Metrocorp (Private) Limited:

- **HNB.X0000** Cum Surplus **519,220,201.41**, was 520,792,567.99.
- **NDB.N0000** Cum Surplus **165,493,786.08**, was 4,199,323.09 (about
  1.69 million scrip shares had been left out).
- **TKYO.X0000** share balance **41,297**, was -10,002.
- **Mr. DJ Ambani, NDB.N0000** (held through scrip only) is now listed.
- **Detailed report, HNB.X0000** opens at -563,937,500.00, not 219,216,509.16
  carried in from other shares.

Share Analytics also applies the entity filter when it rebuilds its figures; it
used to ignore it.

### Cash Balance — trade date and settlement date (bug-61)

- **A trade's cash is posted on its settlement date.** It used to depend on the
  screen: approving a pending note posted on the trade date, uploading and
  approving directly on the settlement date, manual entry on its single date.
- Buy & Sell Notes manual entry has separate **Trade Date** and **Settlement
  Date** fields, both required, neither defaulting to today. A settlement
  before the trade is refused there and on upload, note edit and approval.
- Transactions bulk entry labels its date **Trade Date**, required, with no
  default.
- Trades awaiting approval are dated and filtered by the day they will post.
- **Existing ledger entries are not re-dated.** All but 3 fall on a day where
  the trade and settlement dates are the same.

### Buy & Sell Notes — contract notes read as printed (bug-56)

- **Broker.** A note's broker is the one printed on it. The upload used to take
  any shared word, so "NDB SECURITIES (PVT) LTD." was saved as ACS Capital, the
  first broker alphabetically — as were Ambeon, Capital Alliance, Softlogic and
  Capital Trust notes. LOLC, which prints its name at the foot of its bought and
  sold notes, is now read rather than left blank. Where the mapped transaction
  is with a different broker, the upload screen and Buy & Sell Note Approvals
  say so.
- **Trade and settlement dates** are read from Trade Confirmations (NDB, Lanka
  Securities, Capital Trust, Enterprise Ceylon). They used to come through
  blank, and until 16 Oct the upload filled in the upload day: JKH.N0000's note
  2026199310 was saved as 07/10/2026 against a confirmation dated 16/03/2026.
  Both dates are now required and never default to today.
- **Fees are saved as printed, whatever transaction the note is mapped to.** The
  upload rearranged SEC, Exchange, CDS, GOV CESS, Clearing and on some notes
  Brokerage to resemble the mapped transaction. NDB's note 2026199310, mapped to
  a 670-share transaction, was saved as SEC 228.00, Exchange 1,368.00, CDS
  1,596.00, GOV CESS 228.00, Clearing 5,700.00 against a printed 1,368.00,
  1,596.00, 228.00, 5,700.00 and 228.00. Gross, net and total fees were not
  affected.
- **A note is linked to a transaction automatically only when exactly one fits**
  — same share, side, quantity, trade date and CDS account. The automatic link
  never matched a share before, so every link was picked by hand.
- The client account is read from Bought and Sold notes (it read "Name").
- **Client Account** on Buy & Sell Note Approvals shows the CDS account the
  trade was booked to, with the account's recorded name and bank. It showed
  nothing on all 488 notes.
- Trade and settlement dates in the list, and dates in the transaction picker,
  are shown as dd/mm/yyyy rather than in the browser's order (10/19/2026).
- The parser trace is no longer shown on the upload screen.

### Transactions — approvals recorded and shown (bug-53, bug-54, bug-55)

- **Print Transaction** shows the drafted, approved and broker-confirmed figures
  side by side with the differences highlighted, the approver, every amendment
  and each contract note's status. It showed only the approved figures:
  JKH.N0000 (Test) was drafted at 99,000 @ 20.00 (2,002,176.00), approved at
  100,000 @ 20.00 (2,022,400.00) and confirmed by the broker at 100,000 @ 19.00
  (1,921,280.00).
- Every approval keeps the figures the transaction was submitted with. The
  Approve dialog shows edited figures with "was …".
- **Transaction Details** shows the broker; an approval trail — submitted,
  approved, rejected, on hold — with who and when; and each field changed at
  approval marked in place ("Changed · was 99,000"). "Brokerage Fee" is
  relabelled **Total Fees**: it was always the sum of all six components.
- Transaction Approvals shows "Not recorded" (459 transactions) or "—" (24)
  where it showed "N/A" for a broker.
- **Net price per share** is kept to full precision; it was cut to two places
  (20.2240 stored as 20.22).
- The fee components of 3 Test transactions amended at approval (JKH, SAMP,
  AHUN) did not add up to their total fees and are rescaled to the approved
  figures. JKH's added to 22,176.00 against 22,400.00.
- Email button on Pending and On Hold rows.
- Dates on Transactions, Transaction Details and Transaction Approvals, and in
  the transaction email, are dd/mm/yyyy; a broker could receive 3/16/2026.

### Email (#158)

- Logging out on one device no longer ends the session on the others. It did,
  and their email sends were then refused ("Failed to send email") for up to an
  hour. A refused sign-in is now refreshed and retried once; a send the mail
  server refuses is no longer reported as sent.
- A transaction email can be previewed before sending, and Transactions,
  Transaction Approvals and Buy & Sell Approvals send the same email.

### Entities (bug-60)

- The custodian's "Account Fee %" is now **Applicable Facility Interest Rate**,
  written as text ("AWPLR + 2%"). The 3 existing values, all on Test, carry
  over as 9.9999%, -0.0001% and 1%.

### Screens

- One loading indicator on every screen (#140). Transaction Approvals and Buy &
  Sell Notes are aligned with the other pages (#143).

### Migrations

All applied to the live database before this release:

- `20261012060001_unique_positions_in_analytics_caches.sql`
- `20261016060001_widen_transactions_net_price_per_share.sql`
- `20261016060002_add_transactions_submitted_figures.sql`
- `20261016060003_add_entity_brokers_facility_interest_rate.sql`
- `20261016060004_rescale_fee_components_amended_at_approval.sql`

None loses data on rollback: the first removes duplicates from caches that are
rebuilt anyway, the fourth keeps `custodian_account_fee`, and the fifth's
previous values are in the audit log.

### Not corrected in this release

- **Six contract notes on the Test entity** saved by the old upload keep what
  it wrote: ACS Capital as broker on `3f8dfa6e` and `ee95306a` (printed NDB
  Securities) and `b370a139` (printed Capital Trust); rearranged fees on
  `ee95306a`, `78d0687c`, `ea7d6116` and `c921efe7`, and mis-split fees on
  `b370a139`; the upload day as trade date on `3f8dfa6e`, `ee95306a`,
  `78d0687c` and `b370a139`. Their cash ledger entries are dated from them.
- **Client accounts with no account record** (listed on #163): Metrocorp's
  custodian account is recorded as "CMB - 5826 - LC/000" while its trades use
  "LC/00", and SBK-40743-LC/00 is not recorded. Correct them in Entities →
  Broker/Custodian.
- `custodian_account_fee` is still in the table; a later migration drops it.

### Verified, and not

- Typecheck, build and CI on `main`; the migration runner's dry run reports all
  154 migrations applied; the live site served this build on 19 Oct.
- Contract notes: the NDB note and six sample notes run through the page's own
  reader outside a browser. Every printed fee came through in its column with no
  transaction mapped and with each of three wrong transactions mapped, before
  and after upload (25 of 25). 66 assertions on the matching rules. The linking
  rule replayed over the 488 linked notes agrees with the person's choice on 448
  and never picks a different transaction.
- Earlier fixes as recorded on their issues, several checked on the real page in
  headless Chrome.
- **Not verified:** a contract note uploaded in the live app since this build;
  a real two-device logout; sending email as a non-admin.

## [1.0.0] — 2026-09-22

First tagged release. The system has been in production use before this point;
this establishes a version number to deploy, report against and roll back to,
and the 697 commits before it are history rather than release notes.

### Share Analytics — same-day trade order

- A holding's trades on one date can now be put in the order they happened,
  from **Same-day order** in the breakdown header. Contract notes carry a trade
  date and no trade time, so the ledger previously replayed same-day trades in
  the order the database returned them — effectively at random, since the tie
  broke on a uuid.
- Only days mixing a buy with a sell can change the result; a day of only buys,
  or only sells, closes on the same average either way round. The panel says
  which is which so a day of 55 sells does not look like it needs a decision.
- Measured on Metrocorp / NDB.N0000, 2026-04-08: the two orders leave average
  cost **Rs. 401,154.28** apart on the same 21,543,115 shares.
- Requires migration `20260921060001_add_intraday_seq_to_buy_sell_notes.sql`.

### Share Analytics — breakdown and exports

Six reports with one cause: the screen drew its Market Value and Cost per share
rows, and the CSV export rebuilt the same two rows separately. Both now read one
computation, so they cannot disagree again.

- **Market Value row, Cum Surplus** now shows realised surplus plus what is
  still held. It repeated the after-fee market value, contradicting the Cum
  Surplus in the header directly above it. BIL.N0000 reads **-89,852,215.05**
  where it read 107,006,545.75.
- **Cost per share row** gained **Total Sale Cost** and **Total Dividend**,
  which were blank on screen and in the file.
- **Cost per share row, Sale Value** in the export was realised sales alone
  where the screen showed realised sales plus what selling the rest would fetch.
  BIL.N0000 reads **414,003,674.75**.
- **Cost per share row, Cash Flow +/- and Total Surplus** in the export were
  both written as the after-fee market value. They now match the screen.
- **Closing-row totals** for Av Cost, Av Price and Dividend sat one column away
  from their headings in the export.
- **Market value per transaction** is gone from the export. It restated today's
  price against a historic balance, so a 2021 row read as though it were worth
  that on the day. The screen never showed it.

### Share Analytics — export contents

- Both exports gained **Entity Name**, **Share Name**, **Mkt Price per Share**,
  **Mkt Price after Fees per Share** and **AER (XIRR) %**. The whole-list export
  had carried MV after Fees as a total with no per-share price to check it
  against, and no AER at all.
- **Mkt Price Date** was added alongside the price: a price without its as-of
  date cannot be reconciled later.
- Amounts, prices and share counts are written comma-grouped — `270,430.10`
  rather than `270430.10` — pinned to `en-US` so an export does not vary by who
  downloaded it.
- Files are written with a UTF-8 BOM so Excel does not read a non-ASCII entity
  or share name as the system codepage.

### Sign-in

- A failed account read no longer signs someone in as a different person. It
  used to invent an identity on any failure — an administrator became a user
  with no name and no menu access, saw **Access Denied** on every page with
  their own email still in the menu, and stayed that way until they reloaded.
  Waking a sleeping tab was enough to trigger it.
- A load that fails now says so, names the underlying error, and offers **Try
  again**. An account with no profile in the application is told that, by name,
  rather than being denied.

### Interface

- The sidebar's brand block and the page header are now the same height, so the
  border across the top of the app no longer steps down 4px at the sidebar edge.

### Internal

- Share Analytics' ledger, exports, permissions and same-day ordering moved into
  the repository/service layers described in
  [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).
- A holding's AER, its after-fee price per share and its two closing rows each
  have one definition, reached by every screen and both exports.
- 41 assertions across four suites cover the share ledger, the closing rows, the
  exports and the permission verdicts. They need no browser and no database.

[1.0.0]: https://github.com/VinooThayalan/IMAUI/releases/tag/v1.0.0
