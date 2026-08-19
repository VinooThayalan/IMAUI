import { useState, useEffect } from 'react';
import { Search, TrendingUp, TrendingDown, Landmark, ChevronDown, ChevronUp, FileText, X, Download, CalendarRange } from 'lucide-react';
import { supabase } from '../lib/supabase';
import * as cashLedgerRepo from '../repositories/cashLedger.repo';
import { indexNoteDates, tradeDatesFor } from '../services/cashLedger.service';
import { exportData, type ExportColumn } from '../lib/exportData';

interface Entity {
  id: string;
  name: string;
}

interface Bank {
  id: string;
  name: string;
  account_number: string | null;
  entity_id: string;
  entity_name: string;
  is_active: boolean | null;
  current_balance: number;
}

interface LedgerEntry {
  id: string;
  date: string | null;
  type: string;
  description: string | null;
  code: string | null;
  amount: number;
  running_balance: number;
  reference_id: string | null;
  /** From the contract note this entry settles. Null for a manual entry. */
  tradeDate: string | null;
  settlementDate: string | null;
}

interface BuyAndSellNote {
  id: string;
  note_number: string;
  contract_no: string | null;
  note_type: string;
  trade_date: string | null;
  settlement_date: string | null;
  no_of_shares: number | null;
  price_avg: number | null;
  gross_amount: number | null;
  brokerage: number | null;
  sec: number | null;
  exchange: number | null;
  cds: number | null;
  gov_cess: number | null;
  clearing_fees: number | null;
  net_amount: number | null;
  foreign_brokerage: number | null;
  dealer_name: string | null;
  remarks: string | null;
  file_url: string | null;
  broker_name: string | null;
  ticker: string | null;
  share_name: string | null;
}

const fmt = (v: number) =>
  v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtDate = (d: string | null) =>
  d ? new Date(d + 'T00:00:00').toLocaleDateString('en-GB') : '—';

function NoteModal({ note, onClose }: { note: BuyAndSellNote; onClose: () => void }) {
  const isBuy = note.note_type === 'Buy';

  const feeRow = (label: string, val: number | null) => {
    if (!val) return null;
    return (
      <div className="flex justify-between py-1.5 border-b border-gray-100 last:border-0">
        <span className="text-sm text-gray-500">{label}</span>
        <span className="text-sm font-mono text-gray-800">Rs. {fmt(val)}</span>
      </div>
    );
  };

  const hasFees = note.brokerage || note.sec || note.exchange || note.cds || note.gov_cess || note.clearing_fees || note.foreign_brokerage;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`rounded-t-2xl px-6 py-4 flex items-start justify-between ${isBuy ? 'bg-green-50 border-b border-green-100' : 'bg-red-50 border-b border-red-100'}`}>
          <div>
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${isBuy ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'}`}>
                {note.note_type}
              </span>
              {note.ticker && (
                <span className="font-bold text-gray-900 text-lg font-mono">{note.ticker}</span>
              )}
            </div>
            {note.share_name && <p className="text-sm text-gray-500 mt-0.5">{note.share_name}</p>}
            <p className="text-xs text-gray-400 mt-1 font-mono">
              {note.contract_no || note.note_number}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-4 space-y-4">
          {/* Key figures */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-gray-50 rounded-xl px-3 py-3 text-center">
              <div className="text-xs text-gray-400 uppercase font-semibold">Shares</div>
              <div className="text-lg font-bold text-gray-900 mt-0.5">
                {note.no_of_shares != null ? Number(note.no_of_shares).toLocaleString() : '—'}
              </div>
            </div>
            <div className="bg-gray-50 rounded-xl px-3 py-3 text-center">
              <div className="text-xs text-gray-400 uppercase font-semibold">Avg Price</div>
              <div className="text-lg font-bold text-gray-900 mt-0.5">
                {note.price_avg != null ? fmt(Number(note.price_avg)) : '—'}
              </div>
            </div>
            <div className={`rounded-xl px-3 py-3 text-center ${isBuy ? 'bg-green-50' : 'bg-red-50'}`}>
              <div className="text-xs text-gray-400 uppercase font-semibold">Net Amount</div>
              <div className={`text-lg font-bold mt-0.5 ${isBuy ? 'text-green-700' : 'text-red-600'}`}>
                {note.net_amount != null ? `Rs. ${fmt(Number(note.net_amount))}` : '—'}
              </div>
            </div>
          </div>

          {/* Dates & parties */}
          <div className="bg-gray-50 rounded-xl px-4 py-3 space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Trade Date</span>
              <span className="text-sm font-semibold text-gray-800">{fmtDate(note.trade_date)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Settlement Date</span>
              <span className="text-sm font-semibold text-gray-800">{fmtDate(note.settlement_date)}</span>
            </div>
            {note.broker_name && (
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Broker</span>
                <span className="text-sm font-semibold text-gray-800">{note.broker_name}</span>
              </div>
            )}
            {note.dealer_name && (
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Dealer</span>
                <span className="text-sm font-semibold text-gray-800">{note.dealer_name}</span>
              </div>
            )}
          </div>

          {/* Fee breakdown */}
          {hasFees && (
            <div>
              <div className="text-xs font-semibold text-gray-400 uppercase mb-2">Fee Breakdown</div>
              <div className="bg-gray-50 rounded-xl px-4 py-2">
                {feeRow('Gross Amount', note.gross_amount)}
                {feeRow('Brokerage', note.brokerage)}
                {feeRow('SEC', note.sec)}
                {feeRow('Exchange', note.exchange)}
                {feeRow('CDS', note.cds)}
                {feeRow('Govt. Cess / STL', note.gov_cess)}
                {feeRow('Clearing Fees', note.clearing_fees)}
                {feeRow('Foreign Brokerage', note.foreign_brokerage)}
              </div>
            </div>
          )}

          {/* Remarks */}
          {note.remarks && (
            <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
              <div className="text-xs font-semibold text-amber-600 uppercase mb-1">Remarks</div>
              <p className="text-sm text-gray-700">{note.remarks}</p>
            </div>
          )}

          {/* File */}
          {note.file_url && (
            <div className="flex items-center gap-2 text-sm text-blue-600 bg-blue-50 rounded-xl px-4 py-3">
              <FileText className="w-4 h-4 flex-shrink-0" />
              <span className="truncate">{note.file_url}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function BankTransactionHistory() {
  const [entities, setEntities]               = useState<Entity[]>([]);
  const [selectedEntityId, setSelectedEntityId] = useState('');
  const [search, setSearch]                   = useState('');
  const [loading, setLoading]                 = useState(false);
  const [banks, setBanks]                     = useState<Bank[]>([]);
  const [expandedBankId, setExpandedBankId]   = useState<string | null>(null);
  const [ledger, setLedger]                   = useState<LedgerEntry[]>([]);
  const [ledgerLoading, setLedgerLoading]     = useState(false);
  const [sortAsc, setSortAsc]                 = useState(true);
  const [periodFrom, setPeriodFrom]           = useState('');
  const [periodTo, setPeriodTo]               = useState('');
  const [viewNote, setViewNote]               = useState<BuyAndSellNote | null>(null);
  const [noteLoading, setNoteLoading]         = useState<string | null>(null);

  useEffect(() => {
    supabase.from('entities').select('id, name').order('name').then(({ data }) =>
      setEntities(data || [])
    );
  }, []);

  useEffect(() => {
    loadBanks();
    setExpandedBankId(null);
    setLedger([]);
  }, [selectedEntityId]);

  async function loadBanks() {
    setLoading(true);
    try {
      let query = supabase
        .from('banks')
        .select('id, name, account_number, entity_id, is_active, entity:entities(name)')
        .order('name');

      if (selectedEntityId) query = query.eq('entity_id', selectedEntityId);

      const { data, error } = await query;
      if (error) throw error;

      const bankIds = (data || []).map((b: any) => b.id);
      const balanceMap = new Map<string, number>();

      if (bankIds.length > 0) {
        const { data: ledgerData } = await supabase
          .from('cash_balance_ledger')
          .select('bank_id, running_balance, date')
          .in('bank_id', bankIds)
          .order('date', { ascending: false });

        for (const row of (ledgerData || [])) {
          if (!balanceMap.has(row.bank_id)) {
            balanceMap.set(row.bank_id, Number(row.running_balance) || 0);
          }
        }
      }

      const result: Bank[] = (data || []).map((b: any) => ({
        id: b.id,
        name: b.name,
        account_number: b.account_number,
        entity_id: b.entity_id,
        entity_name: b.entity?.name ?? '—',
        is_active: b.is_active,
        current_balance: balanceMap.get(b.id) ?? 0,
      }));

      setBanks(result);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function loadLedger(bankId: string) {
    setLedgerLoading(true);
    try {
      // Only this bank's own entries. This used to also pull the entity's
      // entries with bank_id IS NULL, which meant a manual ledger entry saved
      // without a bank appeared under *every* bank belonging to that entity —
      // and was counted into each one's transaction count and net movement, so
      // an entity with three banks triple-counted it. Entries with no bank
      // remain visible on the Cash Balance screen, which shows them whenever no
      // bank filter is applied.
      //
      // Read and date resolution are shared with the Cash Balance ledger, which
      // needed the same two columns: same repository, same rule about where a
      // trade date may come from. The select here was also unpaged.
      const [bankRows, noteDateRows] = await Promise.all([
        cashLedgerRepo.listByBank(bankId),
        cashLedgerRepo.listNoteDates(),
      ]);
      const noteDates = indexNoteDates(noteDateRows);

      const allEntries = [...bankRows].sort((a, b) => {
        if (!a.date && !b.date) return 0;
        if (!a.date) return -1;
        if (!b.date) return 1;
        return a.date < b.date ? -1 : a.date > b.date ? 1 : 0;
      });

      setLedger(
        allEntries.map(r => {
          const dates = tradeDatesFor(r, noteDates);
          return {
            id: r.id,
            date: r.date,
            type: r.type,
            description: r.description,
            code: r.code,
            amount: Number(r.amount) || 0,
            running_balance: Number(r.running_balance) || 0,
            reference_id: r.reference_id || null,
            tradeDate: dates.tradeDate,
            settlementDate: dates.settlementDate,
          };
        })
      );
    } catch (err) {
      console.error(err);
    } finally {
      setLedgerLoading(false);
    }
  }

  async function handleViewNote(referenceId: string, e: React.MouseEvent) {
    e.stopPropagation();
    setNoteLoading(referenceId);
    try {
      const { data, error } = await supabase
        .from('buy_sell_notes')
        .select(`
          id, note_number, contract_no, note_type, trade_date, settlement_date,
          no_of_shares, price_avg, gross_amount, brokerage, sec, exchange,
          cds, gov_cess, clearing_fees, net_amount, foreign_brokerage,
          dealer_name, remarks, file_url,
          broker:brokers(broker_name),
          transaction:transactions(share:shares(ticker, share_name))
        `)
        .eq('id', referenceId)
        .maybeSingle();

      if (error) throw error;
      if (!data) return;

      setViewNote({
        id: data.id,
        note_number: data.note_number,
        contract_no: data.contract_no,
        note_type: data.note_type,
        trade_date: data.trade_date,
        settlement_date: data.settlement_date,
        no_of_shares: data.no_of_shares != null ? Number(data.no_of_shares) : null,
        price_avg: data.price_avg != null ? Number(data.price_avg) : null,
        gross_amount: data.gross_amount != null ? Number(data.gross_amount) : null,
        brokerage: data.brokerage != null ? Number(data.brokerage) : null,
        sec: data.sec != null ? Number(data.sec) : null,
        exchange: data.exchange != null ? Number(data.exchange) : null,
        cds: data.cds != null ? Number(data.cds) : null,
        gov_cess: data.gov_cess != null ? Number(data.gov_cess) : null,
        clearing_fees: data.clearing_fees != null ? Number(data.clearing_fees) : null,
        net_amount: data.net_amount != null ? Number(data.net_amount) : null,
        foreign_brokerage: data.foreign_brokerage != null ? Number(data.foreign_brokerage) : null,
        dealer_name: data.dealer_name,
        remarks: data.remarks,
        file_url: data.file_url,
        broker_name: (data.broker as any)?.broker_name ?? null,
        ticker: (data.transaction as any)?.share?.ticker ?? null,
        share_name: (data.transaction as any)?.share?.share_name ?? null,
      });
    } catch (err) {
      console.error(err);
    } finally {
      setNoteLoading(null);
    }
  }

  function toggleBank(bankId: string) {
    if (expandedBankId === bankId) {
      setExpandedBankId(null);
      setLedger([]);
    } else {
      setExpandedBankId(bankId);
      loadLedger(bankId);
    }
  }

  const filtered = banks.filter(b => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      b.name.toLowerCase().includes(q) ||
      (b.account_number ?? '').toLowerCase().includes(q) ||
      b.entity_name.toLowerCase().includes(q)
    );
  });

  const totalBalance = filtered.reduce((s, b) => s + b.current_balance, 0);
  const activeCount  = filtered.filter(b => b.is_active).length;

  // Period filter. Applied client-side on the already-loaded ledger rather than in
  // the query, so changing a date does not re-fetch and an entry with no date is
  // only dropped once a bound is actually set. `date` is a date column, so the
  // ISO strings the date inputs produce compare correctly as strings.
  const periodLedger = ledger.filter(r => {
    if (periodFrom && (!r.date || r.date < periodFrom)) return false;
    if (periodTo   && (!r.date || r.date > periodTo))   return false;
    return true;
  });
  const periodActive = Boolean(periodFrom || periodTo);
  const sortedLedger = sortAsc ? periodLedger : [...periodLedger].reverse();

  // Totals follow the same filtered set as the table, so the footer always
  // describes what is on screen rather than the whole ledger.
  const periodNet = periodLedger.reduce(
    (s, r) => s + (r.type === 'Addition' || r.type === 'addition' ? r.amount : -r.amount), 0);

  const expandedBank = expandedBankId ? banks.find(b => b.id === expandedBankId) : undefined;

  function handleExportLedger(format: 'csv' | 'excel') {
    if (!expandedBank) return;
    const columns: ExportColumn<LedgerEntry>[] = [
      { header: 'Date',            accessor: r => r.date || '' },
      // Present only for an entry raised by settling a contract note. Blank
      // rather than the posting date, which would read as a trade date.
      { header: 'Trade Date',      accessor: r => r.tradeDate || '' },
      { header: 'Settlement Date', accessor: r => r.settlementDate || '' },
      { header: 'Code',            accessor: r => r.code || '' },
      { header: 'Description',     accessor: r => r.description || '' },
      { header: 'Type',            accessor: r => (r.type === 'Addition' || r.type === 'addition' ? 'Credit' : 'Debit') },
      // Signed, so a spreadsheet can sum the column directly.
      { header: 'Amount',          accessor: r => (r.type === 'Addition' || r.type === 'addition' ? r.amount : -r.amount) },
      { header: 'Running Balance', accessor: r => r.running_balance },
    ];
    // Name the file after the account and the period, so exports taken for
    // different ranges do not overwrite one another in the downloads folder.
    const slug = (s: string) => s.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '');
    const period = periodActive ? `_${periodFrom || 'start'}_to_${periodTo || 'today'}` : '';
    exportData(
      `bank-transactions_${slug(expandedBank.entity_name)}_${slug(expandedBank.name)}${period}`,
      columns,
      sortedLedger,
      format,
    );
  }

  return (
    <div className="p-6 space-y-5">
      {viewNote && <NoteModal note={viewNote} onClose={() => setViewNote(null)} />}

      <div>
        <h1 className="text-3xl font-bold text-gray-900">Bank Transaction History</h1>
        <p className="text-gray-500 mt-1">Running balance per entity–bank account. Click a row to view the ledger.</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-gray-500 uppercase">Entity</label>
            <select
              value={selectedEntityId}
              onChange={e => setSelectedEntityId(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[240px]"
            >
              <option value="">All Entities</option>
              {entities.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-gray-500 uppercase">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Bank, account…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-52"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Summary cards */}
      {!loading && filtered.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="bg-white rounded-xl border border-gray-200 px-5 py-4">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Total Accounts</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">{filtered.length}</div>
            <div className="text-xs text-gray-400 mt-0.5">{activeCount} active</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 px-5 py-4">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Combined Balance</div>
            <div className={`text-2xl font-bold mt-1 ${totalBalance >= 0 ? 'text-green-700' : 'text-red-600'}`}>
              Rs. {fmt(totalBalance)}
            </div>
          </div>
        </div>
      )}

      {/* Main table */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 py-16 text-center">
          <Landmark className="w-12 h-12 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400 font-medium">No bank accounts found</p>
          <p className="text-gray-300 text-sm mt-1">Adjust your filters to see results</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Bank / Account</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Entity</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Running Balance</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Ledger</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((bank, idx) => {
                  const isExpanded = expandedBankId === bank.id;
                  return (
                    <>
                      <tr
                        key={bank.id}
                        onClick={() => toggleBank(bank.id)}
                        className={`cursor-pointer border-b border-gray-100 transition-colors ${
                          isExpanded ? 'bg-blue-50' : idx % 2 === 0 ? 'bg-white hover:bg-blue-50/40' : 'bg-gray-50/40 hover:bg-blue-50/40'
                        }`}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                              <Landmark className="w-4 h-4 text-blue-600" />
                            </div>
                            <div>
                              <div className="font-semibold text-gray-900">{bank.name}</div>
                              {bank.account_number && (
                                <div className="text-xs text-gray-400 font-mono">{bank.account_number}</div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-600 text-sm">{bank.entity_name}</td>
                        <td className="px-4 py-3 text-right font-mono font-semibold">
                          <span className={bank.current_balance >= 0 ? 'text-green-700' : 'text-red-600'}>
                            Rs. {fmt(bank.current_balance)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                            bank.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'
                          }`}>
                            {bank.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {isExpanded
                            ? <ChevronUp className="w-4 h-4 text-blue-500 mx-auto" />
                            : <ChevronDown className="w-4 h-4 text-gray-400 mx-auto" />}
                        </td>
                      </tr>

                      {/* Inline ledger */}
                      {isExpanded && (
                        <tr key={`ledger-${bank.id}`} className="bg-blue-50/30">
                          <td colSpan={5} className="p-0">
                            <div className="border-t border-blue-100">
                              {/* Period filter + export. One row above the table, and
                                  outside the loading/empty branches so the range can be
                                  cleared even when the current one matches nothing. */}
                              {!ledgerLoading && ledger.length > 0 && (
                                <div
                                  className="flex flex-wrap items-center gap-x-4 gap-y-2 px-6 py-2.5 bg-white border-b border-blue-100"
                                  onClick={e => e.stopPropagation()}
                                >
                                  {/* One line: label and field sit side by side rather than
                                      stacked, which is what let the row align on a single
                                      baseline with the export buttons opposite.

                                      htmlFor/id gives each input a real accessible name. The
                                      labels used to be <label> elements that neither wrapped
                                      the input nor carried htmlFor, so they were associated
                                      with nothing: clicking them did nothing and a screen
                                      reader announced a bare date field. The ids carry the
                                      bank id because this block renders inside a row and
                                      duplicate ids would point every label at the first
                                      input on the page. */}
                                  <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                                    <CalendarRange className="w-4 h-4 text-gray-400" />
                                    Period
                                  </div>

                                  <div className="flex items-center gap-2">
                                    <label
                                      htmlFor={`period-from-${bank.id}`}
                                      className="text-xs font-medium text-gray-500"
                                    >
                                      From
                                    </label>
                                    <input
                                      id={`period-from-${bank.id}`}
                                      type="date"
                                      value={periodFrom}
                                      max={periodTo || undefined}
                                      onChange={e => setPeriodFrom(e.target.value)}
                                      className="px-2.5 py-1.5 text-sm text-gray-700 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    />
                                    <label
                                      htmlFor={`period-to-${bank.id}`}
                                      className="text-xs font-medium text-gray-500 ml-1"
                                    >
                                      To
                                    </label>
                                    <input
                                      id={`period-to-${bank.id}`}
                                      type="date"
                                      value={periodTo}
                                      min={periodFrom || undefined}
                                      onChange={e => setPeriodTo(e.target.value)}
                                      className="px-2.5 py-1.5 text-sm text-gray-700 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    />
                                    {periodActive && (
                                      <button
                                        type="button"
                                        onClick={() => { setPeriodFrom(''); setPeriodTo(''); }}
                                        className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                                      >
                                        <X className="w-3 h-3" /> Clear
                                      </button>
                                    )}
                                  </div>

                                  <div className="ml-auto flex items-center gap-2">
                                    {/* aria-live so the count is announced when the range
                                        changes; without it the only feedback is visual. */}
                                    <span className="text-xs text-gray-500 tabular-nums" aria-live="polite">
                                      {periodLedger.length} of {ledger.length} shown
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => handleExportLedger('csv')}
                                      disabled={periodLedger.length === 0}
                                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                    >
                                      <Download className="w-3.5 h-3.5" /> CSV
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleExportLedger('excel')}
                                      disabled={periodLedger.length === 0}
                                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                    >
                                      <Download className="w-3.5 h-3.5" /> Excel
                                    </button>
                                  </div>
                                </div>
                              )}

                              {ledgerLoading ? (
                                <div className="flex items-center justify-center py-8">
                                  <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-blue-600" />
                                </div>
                              ) : ledger.length === 0 ? (
                                <div className="py-6 text-center text-gray-400 text-sm">No transactions recorded for this account.</div>
                              ) : periodLedger.length === 0 ? (
                                <div className="py-6 text-center text-gray-400 text-sm">
                                  No transactions in the selected period.
                                </div>
                              ) : (
                                <div className="overflow-x-auto">
                                  <table className="w-full text-sm whitespace-nowrap">
                                    <thead className="bg-gray-100 border-b border-gray-200">
                                      <tr>
                                        <th className="pl-12 pr-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                                          <button
                                            className="flex items-center gap-1 hover:text-gray-700 transition-colors"
                                            onClick={e => { e.stopPropagation(); setSortAsc(p => !p); }}
                                          >
                                            Date {sortAsc ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                          </button>
                                        </th>
                                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Trade Date</th>
                                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Settlement Date</th>
                                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Code</th>
                                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Description</th>
                                        <th className="px-3 py-2 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Type</th>
                                        <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Amount</th>
                                        <th className="pr-6 pl-3 py-2 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Running Balance</th>
                                        <th className="px-3 py-2 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Note</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {sortedLedger.map((entry, i) => {
                                        const isAdd = entry.type === 'Addition' || entry.type === 'addition';
                                        const isLoadingThis = noteLoading === entry.reference_id;
                                        return (
                                          <tr
                                            key={entry.id}
                                            className={`border-b border-gray-100 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'} hover:bg-blue-50/30 transition-colors`}
                                          >
                                            <td className="pl-12 pr-3 py-2 text-gray-600">{fmtDate(entry.date)}</td>
                                            {/* Only an entry raised by settling a contract note has these.
                                                A manual entry gets an em dash, not the posting date. */}
                                            <td className="px-3 py-2 text-gray-600">{fmtDate(entry.tradeDate)}</td>
                                            <td className="px-3 py-2 text-gray-600">{fmtDate(entry.settlementDate)}</td>
                                            <td className="px-3 py-2 text-gray-500 font-mono text-xs">{entry.code || '—'}</td>
                                            <td className="px-3 py-2 text-gray-700 max-w-xs truncate">{entry.description || '—'}</td>
                                            <td className="px-3 py-2 text-center">
                                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                                                isAdd ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                              }`}>
                                                {isAdd
                                                  ? <TrendingUp className="w-3 h-3" />
                                                  : <TrendingDown className="w-3 h-3" />}
                                                {isAdd ? 'Credit' : 'Debit'}
                                              </span>
                                            </td>
                                            <td className="px-3 py-2 text-right font-mono">
                                              <span className={isAdd ? 'text-green-700 font-semibold' : 'text-red-600 font-semibold'}>
                                                {isAdd ? '+' : '-'}{fmt(entry.amount)}
                                              </span>
                                            </td>
                                            <td className="pr-6 pl-3 py-2 text-right font-mono font-semibold">
                                              <span className={entry.running_balance >= 0 ? 'text-gray-900' : 'text-red-600'}>
                                                {fmt(entry.running_balance)}
                                              </span>
                                            </td>
                                            <td className="px-3 py-2 text-center">
                                              {entry.reference_id ? (
                                                <button
                                                  onClick={e => handleViewNote(entry.reference_id!, e)}
                                                  disabled={isLoadingThis}
                                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors disabled:opacity-50"
                                                >
                                                  {isLoadingThis
                                                    ? <span className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                                                    : <FileText className="w-3 h-3" />}
                                                  View
                                                </button>
                                              ) : (
                                                <span className="text-gray-300 text-xs">—</span>
                                              )}
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                    <tfoot className="bg-gray-100 border-t-2 border-gray-200 text-xs font-bold">
                                      <tr>
                                        <td colSpan={4} className="pl-12 pr-3 py-2 text-gray-500 uppercase">
                                          {periodLedger.length} transaction{periodLedger.length !== 1 ? 's' : ''}
                                          {periodActive && <span className="normal-case font-medium text-gray-400"> in period</span>}
                                        </td>
                                        <td className="px-3 py-2 text-right font-mono text-gray-700">
                                          Net: <span className={periodNet >= 0 ? 'text-green-700' : 'text-red-600'}>
                                            {fmt(periodNet)}
                                          </span>
                                        </td>
                                        <td className="pr-6 pl-3 py-2 text-right font-mono">
                                          <span className={bank.current_balance >= 0 ? 'text-green-700' : 'text-red-600'}>
                                            Rs. {fmt(bank.current_balance)}
                                          </span>
                                        </td>
                                        <td />
                                      </tr>
                                    </tfoot>
                                  </table>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>

              <tfoot className="bg-gray-100 border-t-2 border-gray-200 text-xs font-bold">
                <tr>
                  <td colSpan={2} className="px-4 py-3 text-gray-500 uppercase">
                    Grand Total ({filtered.length} account{filtered.length !== 1 ? 's' : ''})
                  </td>
                  <td className="px-4 py-3 text-right font-mono">
                    <span className={totalBalance >= 0 ? 'text-green-700' : 'text-red-600'}>
                      Rs. {fmt(totalBalance)}
                    </span>
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
