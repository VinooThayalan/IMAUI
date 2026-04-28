import { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight, FileText, Search, TrendingUp, TrendingDown } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Entity {
  id: string;
  name: string;
}

interface Share {
  id: string;
  ticker: string;
  name: string;
}

interface NoteRow {
  id: string;
  transaction_id: string;
  note_type: string;
  note_number: string | null;
  contract_no: string | null;
  broker: string | null;
  dealer_name: string | null;
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
  foreign_brokerage: number | null;
  net_amount: number | null;
  file_url: string | null;
  // from joined transaction
  transaction_type: string;
  transaction_date: string;
  price_per_share: number;
  total_amount: number;
  entity_id: string;
  entity_name: string;
  share_ticker: string;
  share_name: string;
}

export function ShareAnalytics() {
  const [entities, setEntities] = useState<Entity[]>([]);
  const [selectedEntityId, setSelectedEntityId] = useState<string>('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [search, setSearch] = useState('');
  const [notes, setNotes] = useState<NoteRow[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.from('entities').select('id, name').order('name').then(({ data }) => {
      setEntities(data || []);
    });
  }, []);

  useEffect(() => {
    fetchNotes();
  }, [selectedEntityId, fromDate, toDate]);

  async function fetchNotes() {
    setLoading(true);
    try {
      let query = supabase
        .from('buy_sell_notes')
        .select(`
          id, transaction_id, note_type, note_number, contract_no, broker,
          dealer_name, trade_date, settlement_date, no_of_shares, price_avg,
          gross_amount, brokerage, sec, exchange, cds, gov_cess,
          clearing_fees, foreign_brokerage, net_amount, file_url,
          transactions (
            transaction_type, transaction_date, price_per_share, total_amount,
            entity_id,
            entities ( name ),
            shares ( ticker, name )
          )
        `)
        .order('trade_date', { ascending: false });

      if (fromDate) query = query.gte('trade_date', fromDate);
      if (toDate) query = query.lte('trade_date', toDate);

      const { data, error } = await query;
      if (error) throw error;

      let rows: NoteRow[] = (data || [])
        .filter((n: any) => n.transactions)
        .map((n: any) => ({
          id: n.id,
          transaction_id: n.transaction_id,
          note_type: n.note_type,
          note_number: n.note_number,
          contract_no: n.contract_no,
          broker: n.broker,
          dealer_name: n.dealer_name,
          trade_date: n.trade_date,
          settlement_date: n.settlement_date,
          no_of_shares: n.no_of_shares != null ? Number(n.no_of_shares) : null,
          price_avg: n.price_avg != null ? Number(n.price_avg) : null,
          gross_amount: n.gross_amount != null ? Number(n.gross_amount) : null,
          brokerage: n.brokerage != null ? Number(n.brokerage) : null,
          sec: n.sec != null ? Number(n.sec) : null,
          exchange: n.exchange != null ? Number(n.exchange) : null,
          cds: n.cds != null ? Number(n.cds) : null,
          gov_cess: n.gov_cess != null ? Number(n.gov_cess) : null,
          clearing_fees: n.clearing_fees != null ? Number(n.clearing_fees) : null,
          foreign_brokerage: n.foreign_brokerage != null ? Number(n.foreign_brokerage) : null,
          net_amount: n.net_amount != null ? Number(n.net_amount) : null,
          file_url: n.file_url,
          transaction_type: n.transactions.transaction_type,
          transaction_date: n.transactions.transaction_date,
          price_per_share: Number(n.transactions.price_per_share),
          total_amount: Number(n.transactions.total_amount),
          entity_id: n.transactions.entity_id,
          entity_name: n.transactions.entities?.name || '—',
          share_ticker: n.transactions.shares?.ticker || '—',
          share_name: n.transactions.shares?.name || '—',
        }));

      if (selectedEntityId) {
        rows = rows.filter(r => r.entity_id === selectedEntityId);
      }

      setNotes(rows);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const filtered = notes.filter(n => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      n.share_ticker.toLowerCase().includes(q) ||
      n.share_name.toLowerCase().includes(q) ||
      (n.note_number || '').toLowerCase().includes(q) ||
      (n.contract_no || '').toLowerCase().includes(q) ||
      (n.broker || '').toLowerCase().includes(q)
    );
  });

  const isBuy = (type: string) => type === 'BUY' || type === 'Buy';

  function fmt(val: number | null, decimals = 2) {
    if (val == null) return '—';
    return `Rs. ${val.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
  }

  function fmtDate(d: string | null) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString();
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Share Analytics</h1>
        <p className="text-gray-500 mt-1">Buy and sell notes filtered by entity and date</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-gray-500 uppercase">Entity</label>
            <select
              value={selectedEntityId}
              onChange={e => setSelectedEntityId(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[220px]"
            >
              <option value="">All Entities</option>
              {entities.map(e => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-gray-500 uppercase">From</label>
            <input
              type="date"
              value={fromDate}
              onChange={e => setFromDate(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-gray-500 uppercase">To</label>
            <input
              type="date"
              value={toDate}
              onChange={e => setToDate(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
            <label className="text-xs font-semibold text-gray-500 uppercase">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Ticker, note no., broker..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <FileText className="w-5 h-5 text-blue-600" />
            <span className="font-semibold text-gray-900">Buy / Sell Notes</span>
          </div>
          <span className="text-sm text-gray-500">{filtered.length} record{filtered.length !== 1 ? 's' : ''}</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="w-10 px-4 py-3"></th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Trade Date</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Entity</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Share</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Note No.</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Broker</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">No. of Shares</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Avg Price</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Gross Amount</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Net Amount</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Settlement</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(note => {
                  const isOpen = expandedId === note.id;
                  const buy = isBuy(note.note_type);
                  return (
                    <>
                      <tr
                        key={note.id}
                        onClick={() => setExpandedId(isOpen ? null : note.id)}
                        className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors"
                      >
                        <td className="px-4 py-3 text-center">
                          {isOpen
                            ? <ChevronDown className="w-4 h-4 text-blue-500 mx-auto" />
                            : <ChevronRight className="w-4 h-4 text-gray-400 mx-auto" />
                          }
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">{fmtDate(note.trade_date)}</td>
                        <td className="px-4 py-3 text-sm text-gray-900 font-medium">{note.entity_name}</td>
                        <td className="px-4 py-3">
                          <div className="text-sm font-bold text-gray-900">{note.share_ticker}</div>
                          <div className="text-xs text-gray-500">{note.share_name}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                            buy ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {note.note_type}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 font-mono">{note.note_number || note.contract_no || '—'}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">{note.broker || '—'}</td>
                        <td className="px-4 py-3 text-sm text-right text-gray-900 font-medium">
                          {note.no_of_shares != null ? Number(note.no_of_shares).toLocaleString() : '—'}
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-gray-900">
                          {note.price_avg != null ? `Rs. ${Number(note.price_avg).toFixed(2)}` : '—'}
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-gray-900">
                          {note.gross_amount != null ? `Rs. ${Number(note.gross_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '—'}
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-semibold text-blue-700">
                          {note.net_amount != null ? `Rs. ${Number(note.net_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '—'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">{fmtDate(note.settlement_date)}</td>
                      </tr>

                      {isOpen && (
                        <tr key={`${note.id}-detail`} className="bg-blue-50/30 border-b border-blue-100">
                          <td></td>
                          <td colSpan={11} className="px-4 py-4">
                            <div className="rounded-xl border border-blue-200 bg-white shadow-sm overflow-hidden">
                              {/* Detail header */}
                              <div className="flex items-center justify-between px-5 py-3 bg-gradient-to-r from-blue-700 to-blue-600 text-white">
                                <div className="flex items-center space-x-3">
                                  {buy ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
                                  <div>
                                    <div className="font-bold text-base">{note.note_type} Note — {note.note_number || note.contract_no || 'N/A'}</div>
                                    <div className="text-blue-200 text-xs">{note.share_ticker} · {note.entity_name}</div>
                                  </div>
                                </div>
                                <div className="flex items-center space-x-4">
                                  {note.dealer_name && (
                                    <div className="text-right">
                                      <div className="text-xs text-blue-300">Dealer</div>
                                      <div className="text-sm font-medium">{note.dealer_name}</div>
                                    </div>
                                  )}
                                  {note.file_url && (
                                    <a
                                      href={note.file_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      onClick={e => e.stopPropagation()}
                                      className="flex items-center space-x-1 px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors"
                                    >
                                      <FileText className="w-4 h-4" />
                                      <span>View PDF</span>
                                    </a>
                                  )}
                                </div>
                              </div>

                              {/* Fee breakdown grid */}
                              <div className="p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                                {[
                                  { label: 'Trade Date', value: fmtDate(note.trade_date) },
                                  { label: 'Settlement Date', value: fmtDate(note.settlement_date) },
                                  { label: 'Contract No.', value: note.contract_no || '—' },
                                  { label: 'No. of Shares', value: note.no_of_shares != null ? note.no_of_shares.toLocaleString() : '—' },
                                  { label: 'Avg Price', value: note.price_avg != null ? `Rs. ${note.price_avg.toFixed(2)}` : '—' },
                                ].map(({ label, value }) => (
                                  <div key={label} className="bg-gray-50 rounded-lg px-3 py-2.5">
                                    <div className="text-xs text-gray-400 font-medium mb-0.5">{label}</div>
                                    <div className="text-sm font-semibold text-gray-800">{value}</div>
                                  </div>
                                ))}
                              </div>

                              <div className="px-4 pb-4">
                                <div className="text-xs font-semibold text-gray-400 uppercase mb-2">Fee Breakdown</div>
                                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-px bg-gray-200 rounded-lg overflow-hidden border border-gray-200">
                                  {[
                                    { label: 'Gross Amount', value: fmt(note.gross_amount), highlight: false },
                                    { label: 'Brokerage', value: fmt(note.brokerage) },
                                    { label: 'SEC', value: fmt(note.sec) },
                                    { label: 'Exchange', value: fmt(note.exchange) },
                                    { label: 'CDS', value: fmt(note.cds) },
                                    { label: 'Gov Cess', value: fmt(note.gov_cess) },
                                    { label: 'Clearing Fees', value: fmt(note.clearing_fees) },
                                    { label: 'Foreign Brokerage', value: fmt(note.foreign_brokerage) },
                                    { label: 'Net Amount', value: fmt(note.net_amount), highlight: true },
                                  ].map(({ label, value, highlight }) => (
                                    <div key={label} className={`px-3 py-2.5 ${highlight ? 'bg-blue-50' : 'bg-white'}`}>
                                      <div className="text-xs text-gray-400 font-medium mb-0.5">{label}</div>
                                      <div className={`text-sm font-semibold ${highlight ? 'text-blue-700' : 'text-gray-800'}`}>{value}</div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}

                {filtered.length === 0 && !loading && (
                  <tr>
                    <td colSpan={12} className="py-16 text-center">
                      <FileText className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                      <p className="text-gray-400 font-medium">No buy/sell notes found</p>
                      <p className="text-gray-300 text-sm mt-1">Adjust your filters to see results</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
