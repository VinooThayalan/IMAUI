# Changelog

Every released version, newest first. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

How a release is cut is in [`docs/RELEASING.md`](docs/RELEASING.md).

Entries are written for the people who use the system, not for the people who
wrote it. A figure that changed on screen says so, and says what it changed
from — a reader comparing this release against their own records needs to know
which number moved and why, not which function was renamed.

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
