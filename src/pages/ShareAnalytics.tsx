import React, { useState, useEffect, useCallback } from 'react';
import { TrendingUp, TrendingDown, BarChart2, X, Search, FileText, ChevronDown, ChevronUp, Download } from 'lucide-react';
import { supabase } from '../lib/supabase';

function exportCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const escape = (v: string | number) => {
    const s = String(v ?? '');
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [headers, ...rows].map(r => r.map(escape).join(',')).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ── Types ────────────────────────────────────────────────────────────────────

interface Entity { id: string; name: string; }

interface OpeningBalance {
  entity_id: string;
  share_id: string;
  opening_shares: number;
  average_purchase_cost: number;
  effective_date: string;
}

interface DividendRecord {
  entity_id: string;
  share_id: string;
  payment_date: string | null;
  amount_net: number;
}

interface RawNote {
  id: string;
  note_type: string;
  trade_date: string | null;
  no_of_shares: number;
  price_avg: number | null;
  gross_amount: number;
  entity_id: string;
  entity_name: string;
  share_id: string;
  share_ticker: string;
  share_name: string;
}

interface ComputedRow extends RawNote {
  row_type: 'opening' | 'buy' | 'sell' | 'dividend';
  purchase_cost: number;
  sale_value: number;
  dividend: number;
  share_cum_bal: number;
  av_cost: number;
  av_price: number;
  cum_purchase_cost: number;
  cum_sale_value: number;
  cum_dividend: number;
  cum_surplus: number;   // (cum_sale_value + cum_dividend) - cum_purchase_cost (realized only)
  market_value: number;
  cash_flow: number;
  total_surplus: number; // (market_value + cum_sale_value + cum_dividend) - cum_purchase_cost
}

interface ShareGroup {
  share_id: string;
  share_ticker: string;
  share_name: string;
  entity_id: string;
  entity_name: string;
  market_price: number;
  cds_account: string;
  rows: ComputedRow[];
}

// ── Core calculation ─────────────────────────────────────────────────────────

function computeRows(
  notes: RawNote[],
  opening: OpeningBalance | null,
  dividends: DividendRecord[],
  marketPrice: number,
): ComputedRow[] {
  const sorted     = [...notes].sort((a, b) => (a.trade_date ?? '') < (b.trade_date ?? '') ? -1 : 1);
  const sortedDivs = [...dividends].sort((a, b) => (a.payment_date ?? '') < (b.payment_date ?? '') ? -1 : 1);

  type Ev = { date: string } & (
    | { kind: 'note'; note: RawNote }
    | { kind: 'dividend'; div: DividendRecord }
  );
  const events: Ev[] = [
    ...sorted.map(n => ({ date: n.trade_date ?? '', kind: 'note' as const, note: n })),
    ...sortedDivs.map(d => ({ date: d.payment_date ?? '', kind: 'dividend' as const, div: d })),
  ].sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);

  let heldShares  = opening ? opening.opening_shares : 0;
  let heldCost    = opening ? opening.opening_shares * opening.average_purchase_cost : 0;
  let cumPurchase = heldCost;
  let cumSale     = 0;
  let cumDividend = 0;

  const snap = () => {
    const av_price     = heldShares > 0 ? heldCost / heldShares : 0;
    const market_value = heldShares * marketPrice;
    const cum_surplus  = (cumSale + cumDividend) - cumPurchase;
    return {
      share_cum_bal: heldShares, av_cost: heldCost, av_price,
      cum_purchase_cost: cumPurchase, cum_sale_value: cumSale, cum_dividend: cumDividend,
      cum_surplus, market_value,
      total_surplus: (market_value + cumSale + cumDividend) - cumPurchase,
    };
  };

  const rows: ComputedRow[] = [];

  if (opening) {
    const s = snap();
    rows.push({
      id: `ob-${opening.entity_id}-${opening.share_id}`,
      note_type: 'Opening', trade_date: opening.effective_date,
      no_of_shares: opening.opening_shares, price_avg: opening.average_purchase_cost,
      gross_amount: heldCost,
      entity_id: opening.entity_id, entity_name: '', share_id: opening.share_id,
      share_ticker: '', share_name: '',
      row_type: 'opening',
      purchase_cost: heldCost, sale_value: 0, dividend: 0,
      cash_flow: -heldCost, ...s,
    });
  }

  for (const ev of events) {
    if (ev.kind === 'note') {
      const n    = ev.note;
      const qty  = n.no_of_shares;
      const gross = n.gross_amount;
      const isBuy = n.note_type === 'Buy' || n.note_type === 'BUY';
      let purchase_cost = 0, sale_value = 0;

      if (isBuy) {
        purchase_cost = gross; heldShares += qty; heldCost += gross; cumPurchase += gross;
      } else {
        sale_value = gross;
        const avgCPS = heldShares > 0 ? heldCost / heldShares : 0;
        const remove = avgCPS * qty;
        heldShares = Math.max(0, heldShares - qty);
        heldCost   = Math.max(0, heldCost - remove);
        cumSale   += gross;
      }
      const s = snap();
      rows.push({ ...n, row_type: isBuy ? 'buy' : 'sell', purchase_cost, sale_value, dividend: 0, cash_flow: sale_value - purchase_cost, ...s });
    } else {
      const d = ev.div;
      cumDividend += d.amount_net;
      const s = snap();
      rows.push({
        id: `div-${d.entity_id}-${d.share_id}-${d.payment_date}`,
        note_type: 'Dividend', trade_date: d.payment_date,
        no_of_shares: 0, price_avg: null, gross_amount: d.amount_net,
        entity_id: d.entity_id, entity_name: '', share_id: d.share_id,
        share_ticker: '', share_name: '',
        row_type: 'dividend',
        purchase_cost: 0, sale_value: 0, dividend: d.amount_net,
        cash_flow: d.amount_net, ...s,
      });
    }
  }
  return rows;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const fmt     = (v: number, d = 2) => v.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });
const fmtN    = (v: number)        => v.toLocaleString(undefined, { minimumFractionDigits: 0,  maximumFractionDigits: 0 });
const fmtDate = (d: string | null) => d ? new Date(d + 'T00:00:00').toLocaleDateString('en-GB') : '—';

const clsSurplus = (v: number) =>
  v > 0 ? 'text-green-700 font-semibold' : v < 0 ? 'text-red-600 font-semibold' : 'text-gray-400';

// ── Summary card (shown when entity selected) ────────────────────────────────

interface SummaryCardProps { label: string; value: string; sub?: string; color?: string; }
function SummaryCard({ label, value, sub, color = 'text-gray-900' }: SummaryCardProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 px-5 py-4 flex flex-col gap-1">
      <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{label}</div>
      <div className={`text-xl font-bold ${color}`}>{value}</div>
      {sub && <div className="text-xs text-gray-400">{sub}</div>}
    </div>
  );
}

// ── Note detail types ────────────────────────────────────────────────────────

interface NoteDetail {
  id: string;
  transaction_id: string | null;
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
  approval_document_url: string | null;
  approval_document_name: string | null;
}

// ── Breakdown modal ──────────────────────────────────────────────────────────

function BreakdownModal({ group, onClose }: { group: ShareGroup; onClose: () => void }) {
  const last = group.rows[group.rows.length - 1];
  const [expandedNoteId, setExpandedNoteId] = useState<string | null>(null);
  const [noteDetails, setNoteDetails]       = useState<Map<string, NoteDetail>>(new Map());
  const [noteLoading, setNoteLoading]       = useState<string | null>(null);

  function exportDetail() {
    const headers = ['Date','Type','Price','No. Shares','Share Cum Bal','Purchase Cost','Sale Value','Av Cost','Av Price','Dividend','Cum Surplus','Market Value','Cash Flow','Total Surplus'];
    const rows = group.rows.map(r => [
      r.trade_date ?? '',
      r.note_type,
      r.price_avg ?? '',
      r.no_of_shares > 0 ? r.no_of_shares : '',
      r.share_cum_bal,
      r.purchase_cost > 0 ? r.purchase_cost.toFixed(2) : '',
      r.sale_value > 0 ? r.sale_value.toFixed(2) : '',
      r.av_cost.toFixed(2),
      r.av_price.toFixed(2),
      r.dividend > 0 ? r.dividend.toFixed(2) : '',
      r.cum_surplus.toFixed(2),
      group.market_price > 0 ? r.market_value.toFixed(2) : '',
      r.cash_flow !== 0 ? r.cash_flow.toFixed(2) : '',
      group.market_price > 0 ? r.total_surplus.toFixed(2) : '',
    ]);
    const date = new Date().toISOString().split('T')[0];
    exportCsv(`${group.share_ticker}_${group.entity_name}_analytics_${date}.csv`, headers, rows);
  }

  async function resolveFileUrl(fileUrl: string) {
    if (fileUrl.startsWith('http')) return fileUrl;

    const { data, error } = await supabase.storage
      .from('transaction-documents')
      .createSignedUrl(fileUrl, 3600);

    if (error || !data?.signedUrl) {
      throw new Error('Could not create a file link.');
    }

    return data.signedUrl;
  }

  function pickDownloadName(source: string, fallback: string) {
    const fileName = source.split('/').pop();
    return fileName || fallback;
  }

  async function openFile(fileUrl: string) {
    const resolvedUrl = await resolveFileUrl(fileUrl);
    window.open(resolvedUrl, '_blank', 'noopener,noreferrer');
  }

  async function downloadFile(fileUrl: string, fileName: string) {
    const resolvedUrl = await resolveFileUrl(fileUrl);
    const response = await fetch(resolvedUrl);
    if (!response.ok) {
      throw new Error('Could not download the file.');
    }

    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(objectUrl);
  }

  async function toggleNote(noteId: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (expandedNoteId === noteId) {
      setExpandedNoteId(null);
      return;
    }
    setExpandedNoteId(noteId);
    if (noteDetails.has(noteId)) return;

    setNoteLoading(noteId);
    try {
      const { data } = await supabase
        .from('buy_sell_notes')
        .select(`
          id, note_number, contract_no, note_type, trade_date, settlement_date,
          no_of_shares, price_avg, gross_amount, brokerage, sec, exchange,
          cds, gov_cess, clearing_fees, net_amount, foreign_brokerage,
          dealer_name, remarks, file_url, transaction_id,
          broker:brokers(broker_name)
        `)
        .eq('id', noteId)
        .maybeSingle();

      if (data) {
        // Fetch approval document from the linked transaction in parallel
        let approvalDocUrl: string | null = null;
        let approvalDocName: string | null = null;
        if (data.transaction_id) {
          const { data: txn } = await supabase
            .from('transactions')
            .select('approval_document_url, approval_document_name')
            .eq('id', data.transaction_id)
            .maybeSingle();
          approvalDocUrl  = txn?.approval_document_url  ?? null;
          approvalDocName = txn?.approval_document_name ?? null;
        }

        setNoteDetails(prev => new Map(prev).set(noteId, {
          id: data.id,
          transaction_id: data.transaction_id ?? null,
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
          approval_document_url: approvalDocUrl,
          approval_document_name: approvalDocName,
        }));
      }
    } finally {
      setNoteLoading(null);
    }
  }

  const badge = (type: string) => {
    if (type === 'Opening')
      return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">Opening</span>;
    if (type === 'Dividend')
      return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800">Dividend</span>;
    const isBuy = type === 'Buy' || type === 'BUY';
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${isBuy ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
        {isBuy ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
        {isBuy ? 'Buy' : 'Sell'}
      </span>
    );
  };

  const COLS = ['Date','Status','Price','No. Shares','Share Cum Bal','Purchase Cost','Sale Value','Av Cost','Av Price','Dividend','Cum Surplus','Market Value','Cash Flow','Total Surplus','Note'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-[96vw] max-h-[92vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0 bg-white">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-gray-900">{group.share_ticker}</h2>
              <span className="text-sm text-gray-500">{group.share_name}</span>
            </div>
            <div className="flex items-center gap-4 mt-0.5">
              <p className="text-sm text-gray-400">{group.entity_name}</p>
              {group.cds_account && (
                <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md">
                  CDS: {group.cds_account}
                </span>
              )}
            </div>
          </div>

          {/* Summary pills */}
          <div className="flex items-center gap-5 mr-6 text-sm">
            <div className="text-center">
              <div className="text-xs text-gray-400">Shares Held</div>
              <div className="font-bold text-gray-900">{fmtN(last.share_cum_bal)}</div>
            </div>
            <div className="text-center">
              <div className="text-xs text-gray-400">Av Price</div>
              <div className="font-bold text-gray-900">Rs. {fmt(last.av_price)}</div>
            </div>
            {group.market_price > 0 && (
              <div className="text-center">
                <div className="text-xs text-gray-400">Market Price</div>
                <div className="font-bold text-gray-900">Rs. {fmt(group.market_price)}</div>
              </div>
            )}
            <div className="text-center">
              <div className="text-xs text-gray-400">Market Value</div>
              <div className="font-bold text-blue-700">Rs. {fmt(last.market_value)}</div>
            </div>
            <div className="text-center">
              <div className="text-xs text-gray-400">Cum Surplus</div>
              <div className={clsSurplus(last.cum_surplus)}>Rs. {fmt(last.cum_surplus)}</div>
            </div>
            <div className="text-center">
              <div className="text-xs text-gray-400">Total Surplus</div>
              <div className={clsSurplus(last.total_surplus)}>Rs. {fmt(last.total_surplus)}</div>
            </div>
          </div>

          <button onClick={exportDetail} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-500 flex-shrink-0" title="Export to CSV">
            <Download className="w-5 h-5" />
          </button>
          <button onClick={onClose} title="Close" aria-label="Close" className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-500 flex-shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Table */}
        <div className="overflow-auto flex-1">
          <table className="w-full text-sm whitespace-nowrap">
            <thead className="sticky top-0 bg-gray-50 border-b border-gray-200 z-10">
              <tr>
                {COLS.map(h => (
                  <th key={h} className={`px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide ${h === 'Date' || h === 'Status' ? 'text-left' : 'text-right'}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {group.rows.map((row, idx) => {
                const isOp    = row.row_type === 'opening';
                const isDiv   = row.row_type === 'dividend';
                const isNote  = row.row_type === 'buy' || row.row_type === 'sell';
                const bg      = isOp ? 'bg-blue-50/70' : isDiv ? 'bg-yellow-50/60' : idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50';
                const isExpanded = expandedNoteId === row.id;
                const detail     = noteDetails.get(row.id);
                const isLoading  = noteLoading === row.id;

                const feeRow = (label: string, val: number | null) => val ? (
                  <div key={label} className="flex justify-between py-1 border-b border-gray-100 last:border-0">
                    <span className="text-xs text-gray-500">{label}</span>
                    <span className="text-xs font-mono text-gray-800">Rs. {fmt(val)}</span>
                  </div>
                ) : null;

                return (
                  <>
                    <tr key={row.id} className={`${bg} border-b border-gray-50 hover:bg-blue-50/30 transition-colors`}>
                      <td className="px-3 py-2 text-gray-700">{fmtDate(row.trade_date)}</td>
                      <td className="px-3 py-2">{badge(row.note_type)}</td>
                      <td className="px-3 py-2 text-right font-mono text-gray-700">{row.price_avg != null ? fmt(row.price_avg) : '—'}</td>
                      <td className="px-3 py-2 text-right font-mono text-gray-700">{row.no_of_shares > 0 ? fmtN(row.no_of_shares) : '—'}</td>
                      <td className="px-3 py-2 text-right font-mono font-semibold text-gray-900">{fmtN(row.share_cum_bal)}</td>
                      <td className="px-3 py-2 text-right font-mono">{row.purchase_cost > 0 ? fmt(row.purchase_cost) : <span className="text-gray-300">—</span>}</td>
                      <td className="px-3 py-2 text-right font-mono">{row.sale_value > 0 ? fmt(row.sale_value) : <span className="text-gray-300">—</span>}</td>
                      <td className="px-3 py-2 text-right font-mono font-semibold text-blue-700">{fmt(row.av_cost)}</td>
                      <td className="px-3 py-2 text-right font-mono font-semibold text-gray-900">{fmt(row.av_price)}</td>
                      <td className="px-3 py-2 text-right font-mono">{row.dividend > 0 ? <span className="text-yellow-700 font-semibold">{fmt(row.dividend)}</span> : <span className="text-gray-300">—</span>}</td>
                      <td className="px-3 py-2 text-right font-mono"><span className={clsSurplus(row.cum_surplus)}>{fmt(row.cum_surplus)}</span></td>
                      <td className="px-3 py-2 text-right font-mono text-blue-600">{group.market_price > 0 ? fmt(row.market_value) : <span className="text-gray-300">—</span>}</td>
                      <td className="px-3 py-2 text-right font-mono">
                        <span className={row.cash_flow > 0 ? 'text-green-700 font-semibold' : row.cash_flow < 0 ? 'text-red-600 font-semibold' : 'text-gray-300'}>
                          {row.cash_flow !== 0 ? fmt(row.cash_flow) : '—'}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right font-mono">
                        {group.market_price > 0 ? <span className={clsSurplus(row.total_surplus)}>{fmt(row.total_surplus)}</span> : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {isNote ? (
                          <button
                            onClick={e => toggleNote(row.id, e)}
                            disabled={isLoading}
                            className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 ${
                              isExpanded ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                            }`}
                          >
                            {isLoading
                              ? <span className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                              : <FileText className="w-3 h-3" />}
                            {isExpanded
                              ? <ChevronUp className="w-3 h-3" />
                              : <ChevronDown className="w-3 h-3" />}
                          </button>
                        ) : (
                          <span className="text-gray-300 text-xs">—</span>
                        )}
                      </td>
                    </tr>

                    {/* Inline note detail expansion */}
                    {isExpanded && (
                      <tr key={`detail-${row.id}`} className="bg-blue-50/40 border-b border-blue-100">
                        <td colSpan={15} className="px-6 py-4">
                          {!detail ? (
                            <div className="flex items-center justify-center py-4">
                              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600" />
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                              {/* Identity */}
                              <div className="bg-white rounded-xl border border-gray-100 px-4 py-3 space-y-1.5">
                                <div className="text-xs font-bold text-gray-400 uppercase mb-2">Note Info</div>
                                <div className="flex justify-between">
                                  <span className="text-xs text-gray-500">Contract / Note No.</span>
                                  <span className="text-xs font-mono font-semibold text-gray-800">{detail.contract_no || detail.note_number}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-xs text-gray-500">Trade Date</span>
                                  <span className="text-xs font-semibold text-gray-800">{fmtDate(detail.trade_date)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-xs text-gray-500">Settlement Date</span>
                                  <span className="text-xs font-semibold text-gray-800">{fmtDate(detail.settlement_date)}</span>
                                </div>
                                {detail.broker_name && (
                                  <div className="flex justify-between">
                                    <span className="text-xs text-gray-500">Broker</span>
                                    <span className="text-xs font-semibold text-gray-800">{detail.broker_name}</span>
                                  </div>
                                )}
                                {detail.dealer_name && (
                                  <div className="flex justify-between">
                                    <span className="text-xs text-gray-500">Dealer</span>
                                    <span className="text-xs font-semibold text-gray-800">{detail.dealer_name}</span>
                                  </div>
                                )}
                                {(detail.file_url || detail.approval_document_url) && (
                                  <div className="pt-1 flex flex-col gap-1.5">
                                    {detail.file_url && (
                                      <div className="flex flex-wrap gap-2">
                                        <button
                                          onClick={() => void openFile(detail.file_url!)}
                                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition-colors"
                                        >
                                          <FileText className="w-3.5 h-3.5 flex-shrink-0" />
                                          View Contract Note
                                        </button>
                                        <button
                                          onClick={() => void downloadFile(detail.file_url!, pickDownloadName(detail.file_url!, `${detail.contract_no || detail.note_number || 'contract-note'}.pdf`))}
                                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 transition-colors"
                                        >
                                          <Download className="w-3.5 h-3.5 flex-shrink-0" />
                                          Download Contract Note
                                        </button>
                                      </div>
                                    )}
                                    {detail.approval_document_url && (
                                      <div className="flex flex-wrap gap-2">
                                        <button
                                          onClick={() => void openFile(detail.approval_document_url!)}
                                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white text-xs font-semibold rounded-lg hover:bg-emerald-700 transition-colors"
                                        >
                                          <FileText className="w-3.5 h-3.5 flex-shrink-0" />
                                          {detail.approval_document_name || 'View Approval Document'}
                                        </button>
                                        <button
                                          onClick={() => void downloadFile(detail.approval_document_url!, pickDownloadName(detail.approval_document_url!, detail.approval_document_name || 'approval-document.pdf'))}
                                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 transition-colors"
                                        >
                                          <Download className="w-3.5 h-3.5 flex-shrink-0" />
                                          Download Approval Document
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>

                              {/* Volume & price */}
                              <div className="bg-white rounded-xl border border-gray-100 px-4 py-3 space-y-1.5">
                                <div className="text-xs font-bold text-gray-400 uppercase mb-2">Volume & Price</div>
                                {feeRow('No. of Shares', detail.no_of_shares)}
                                {feeRow('Avg Price', detail.price_avg)}
                                {feeRow('Gross Amount', detail.gross_amount)}
                                {feeRow('Net Amount', detail.net_amount)}
                              </div>

                              {/* Fee breakdown */}
                              <div className="bg-white rounded-xl border border-gray-100 px-4 py-3 space-y-1.5">
                                <div className="text-xs font-bold text-gray-400 uppercase mb-2">Fee Breakdown</div>
                                {detail.brokerage || detail.sec || detail.exchange || detail.cds || detail.gov_cess || detail.clearing_fees || detail.foreign_brokerage ? (
                                  <>
                                    {feeRow('Brokerage', detail.brokerage)}
                                    {feeRow('SEC', detail.sec)}
                                    {feeRow('Exchange (CSE)', detail.exchange)}
                                    {feeRow('CDS', detail.cds)}
                                    {feeRow('Govt. Cess / STL', detail.gov_cess)}
                                    {feeRow('Clearing Fees', detail.clearing_fees)}
                                    {feeRow('Foreign Brokerage', detail.foreign_brokerage)}
                                    {/* Total fees */}
                                    <div className="flex justify-between pt-1.5 mt-1 border-t border-gray-200">
                                      <span className="text-xs font-bold text-gray-600">Total Fees</span>
                                      <span className="text-xs font-mono font-bold text-red-600">
                                        Rs. {fmt(
                                          (detail.brokerage ?? 0) + (detail.sec ?? 0) + (detail.exchange ?? 0) +
                                          (detail.cds ?? 0) + (detail.gov_cess ?? 0) + (detail.clearing_fees ?? 0) +
                                          (detail.foreign_brokerage ?? 0)
                                        )}
                                      </span>
                                    </div>
                                  </>
                                ) : (
                                  <span className="text-xs text-gray-400 italic">No fee breakdown extracted</span>
                                )}
                                {detail.remarks && (
                                  <div className="mt-2 pt-2 border-t border-gray-100">
                                    <div className="text-xs font-bold text-amber-600 mb-0.5">Remarks</div>
                                    <p className="text-xs text-gray-600">{detail.remarks}</p>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
            <tfoot className="sticky bottom-0 bg-gray-100 border-t-2 border-gray-300 text-xs font-bold">
              <tr>
                <td colSpan={5} className="px-3 py-2.5 text-gray-500 uppercase">Totals / Final</td>
                <td className="px-3 py-2.5 text-right font-mono text-gray-900">{fmt(group.rows.reduce((s, r) => s + r.purchase_cost, 0))}</td>
                <td className="px-3 py-2.5 text-right font-mono text-gray-900">{fmt(group.rows.reduce((s, r) => s + r.sale_value, 0))}</td>
                <td className="px-3 py-2.5 text-right font-mono text-blue-700">{fmt(last.av_cost)}</td>
                <td className="px-3 py-2.5 text-right font-mono text-gray-900">{fmt(last.av_price)}</td>
                <td className="px-3 py-2.5 text-right font-mono text-yellow-700">{fmt(group.rows.reduce((s, r) => s + r.dividend, 0))}</td>
                <td className="px-3 py-2.5 text-right font-mono"><span className={clsSurplus(last.cum_surplus)}>{fmt(last.cum_surplus)}</span></td>
                <td className="px-3 py-2.5 text-right font-mono text-blue-600">{group.market_price > 0 ? fmt(last.market_value) : '—'}</td>
                <td className="px-3 py-2.5 text-right font-mono">
                  <span className={clsSurplus(group.rows.reduce((s, r) => s + r.cash_flow, 0))}>
                    {fmt(group.rows.reduce((s, r) => s + r.cash_flow, 0))}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-right font-mono">
                  {group.market_price > 0 ? <span className={clsSurplus(last.total_surplus)}>{fmt(last.total_surplus)}</span> : '—'}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}


// ── Main component ───────────────────────────────────────────────────────────

export function ShareAnalytics() {
  const activeTab = 'portfolio';
  const [entities, setEntities]                   = useState<Entity[]>([]);
  const [selectedEntityId, setSelectedEntityId]   = useState('');
  const [search, setSearch]                       = useState('');
  const [loading, setLoading]                     = useState(false);
  const [groups, setGroups]                       = useState<ShareGroup[]>([]);
  const [activeGroup, setActiveGroup]             = useState<ShareGroup | null>(null);

  useEffect(() => {
    supabase.from('entities').select('id, name').order('name').then(({ data }) => setEntities(data || []));
  }, []);

  useEffect(() => { fetchData(); }, [selectedEntityId]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [entitiesRes, sharesRes, txnsRes, openingRes, dividendsRes, pricesRes] = await Promise.all([
        supabase.from('entities').select('id, name'),
        supabase.from('shares').select('id, ticker, share_name'),
        supabase.from('transactions').select('id, entity_id, share_id, cds_account_id'),
        supabase.from('entity_share_opening_balances').select('entity_id, share_id, opening_shares, average_purchase_cost, effective_date'),
        supabase.from('dividends').select('entity_id, share_id, payment_date, amount_net'),
        supabase.from('daily_share_prices').select('share_id, share_price, effective_date').order('effective_date', { ascending: false }),
      ]);

      const entityMap = new Map<string, string>((entitiesRes.data || []).map((e: any) => [e.id, e.name]));
      const shareMap  = new Map<string, { ticker: string; name: string }>((sharesRes.data || []).map((s: any) => [s.id, { ticker: s.ticker || '—', name: s.share_name || '—' }]));

      // Build txn map; also capture CDS account per entity+share (first non-null wins)
      const txnMap    = new Map<string, { entity_id: string; share_id: string }>();
      const cdsMap    = new Map<string, string>(); // key: entity_id__share_id
      for (const t of (txnsRes.data || [])) {
        txnMap.set(t.id, { entity_id: t.entity_id, share_id: t.share_id });
        const k = `${t.entity_id}__${t.share_id}`;
        if (!cdsMap.has(k) && t.cds_account_id) cdsMap.set(k, t.cds_account_id);
      }

      const openingMap = new Map<string, OpeningBalance>();
      for (const ob of (openingRes.data || [])) {
        openingMap.set(`${ob.entity_id}__${ob.share_id}`, {
          entity_id: ob.entity_id, share_id: ob.share_id,
          opening_shares: Number(ob.opening_shares),
          average_purchase_cost: Number(ob.average_purchase_cost),
          effective_date: ob.effective_date,
        });
      }

      const dividendMap = new Map<string, DividendRecord[]>();
      for (const d of (dividendsRes.data || [])) {
        const k = `${d.entity_id}__${d.share_id}`;
        if (!dividendMap.has(k)) dividendMap.set(k, []);
        dividendMap.get(k)!.push({ entity_id: d.entity_id, share_id: d.share_id, payment_date: d.payment_date, amount_net: Number(d.amount_net) || 0 });
      }

      const priceMap = new Map<string, number>();
      for (const p of (pricesRes.data || [])) {
        if (!priceMap.has(p.share_id)) priceMap.set(p.share_id, Number(p.share_price) || 0);
      }

      const { data: notesData, error: notesError } = await supabase
        .from('buy_sell_notes')
        .select('id, note_type, trade_date, no_of_shares, price_avg, gross_amount, transaction_id')
        .order('trade_date', { ascending: true });
      if (notesError) throw notesError;

      const raw: RawNote[] = (notesData || [])
        .filter((n: any) => txnMap.has(n.transaction_id))
        .map((n: any) => {
          const txn   = txnMap.get(n.transaction_id)!;
          const share = shareMap.get(txn.share_id) ?? { ticker: '—', name: '—' };
          return {
            id: n.id, note_type: n.note_type, trade_date: n.trade_date,
            no_of_shares: Number(n.no_of_shares) || 0,
            price_avg: n.price_avg != null ? Number(n.price_avg) : null,
            gross_amount: Number(n.gross_amount) || 0,
            entity_id: txn.entity_id, entity_name: entityMap.get(txn.entity_id) ?? '—',
            share_id: txn.share_id, share_ticker: share.ticker, share_name: share.name,
          };
        })
        .filter((n: RawNote) => !selectedEntityId || n.entity_id === selectedEntityId);

      const groupKeys = new Set<string>();
      for (const n of raw) groupKeys.add(`${n.entity_id}__${n.share_id}`);
      for (const [k] of openingMap) {
        if (!selectedEntityId || k.startsWith(selectedEntityId)) groupKeys.add(k);
      }

      const notesByGroup = new Map<string, RawNote[]>();
      for (const n of raw) {
        const k = `${n.entity_id}__${n.share_id}`;
        if (!notesByGroup.has(k)) notesByGroup.set(k, []);
        notesByGroup.get(k)!.push(n);
      }

      const result: ShareGroup[] = [];
      for (const key of groupKeys) {
        const notes   = notesByGroup.get(key) ?? [];
        const opening = openingMap.get(key) ?? null;
        const divs    = dividendMap.get(key) ?? [];
        if (notes.length === 0 && !opening) continue;

        const [entityId, shareId] = key.split('__');
        const share       = shareMap.get(shareId) ?? { ticker: '—', name: '—' };
        const entityName  = entityMap.get(entityId) ?? '—';
        const marketPrice = priceMap.get(shareId) ?? 0;
        const cdsAccount  = cdsMap.get(key) ?? '';

        const computed = computeRows(notes, opening, divs, marketPrice);
        for (const row of computed) {
          if (!row.entity_name) row.entity_name = entityName;
          if (!row.share_ticker) row.share_ticker = share.ticker;
          if (!row.share_name) row.share_name = share.name;
        }
        if (computed.length === 0) continue;

        result.push({ share_id: shareId, share_ticker: share.ticker, share_name: share.name, entity_id: entityId, entity_name: entityName, market_price: marketPrice, cds_account: cdsAccount, rows: computed });
      }

      result.sort((a, b) => a.entity_name.localeCompare(b.entity_name) || a.share_ticker.localeCompare(b.share_ticker));
      setGroups(result);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [selectedEntityId]);

  const filtered = groups.filter(g => {
    if (!search) return true;
    const q = search.toLowerCase();
    return g.share_ticker.toLowerCase().includes(q) || g.share_name.toLowerCase().includes(q) || g.entity_name.toLowerCase().includes(q);
  });

  // Aggregate totals across filtered groups
  const totals = filtered.reduce((acc, g) => {
    const last = g.rows[g.rows.length - 1];
    return {
      share_cum_bal:   acc.share_cum_bal   + last.share_cum_bal,
      purchase_cost:   acc.purchase_cost   + g.rows.reduce((s, r) => s + r.purchase_cost, 0),
      sale_value:      acc.sale_value      + g.rows.reduce((s, r) => s + r.sale_value, 0),
      av_cost:         acc.av_cost         + last.av_cost,
      dividend:        acc.dividend        + g.rows.reduce((s, r) => s + r.dividend, 0),
      cum_surplus:     acc.cum_surplus     + last.cum_surplus,
      market_value:    acc.market_value    + last.market_value,
      cash_flow:       acc.cash_flow       + g.rows.reduce((s, r) => s + r.cash_flow, 0),
      total_surplus:   acc.total_surplus   + last.total_surplus,
    };
  }, { share_cum_bal: 0, purchase_cost: 0, sale_value: 0, av_cost: 0, dividend: 0, cum_surplus: 0, market_value: 0, cash_flow: 0, total_surplus: 0 });

  const entityName = selectedEntityId ? (entities.find(e => e.id === selectedEntityId)?.name ?? '') : '';

  function exportSummary() {
    const headers = ['Share','Share Name','Entity','CDS Account','Share Cum Bal','Purchase Cost','Sale Value','Av Cost','Av Price','Dividend','Cum Surplus','Market Value','Cash Flow','Total Surplus'];
    const rows = filtered.map(g => {
      const last = g.rows[g.rows.length - 1];
      return [
        g.share_ticker,
        g.share_name,
        g.entity_name,
        g.cds_account,
        last.share_cum_bal,
        g.rows.reduce((s, r) => s + r.purchase_cost, 0).toFixed(2),
        g.rows.reduce((s, r) => s + r.sale_value, 0).toFixed(2),
        last.av_cost.toFixed(2),
        last.av_price.toFixed(2),
        g.rows.reduce((s, r) => s + r.dividend, 0).toFixed(2),
        last.cum_surplus.toFixed(2),
        g.market_price > 0 ? last.market_value.toFixed(2) : '',
        g.rows.reduce((s, r) => s + r.cash_flow, 0).toFixed(2),
        g.market_price > 0 ? last.total_surplus.toFixed(2) : '',
      ];
    });
    const date = new Date().toISOString().split('T')[0];
    const label = selectedEntityId ? (entities.find(e => e.id === selectedEntityId)?.name ?? 'all') : 'all';
    exportCsv(`share_analytics_${label}_${date}.csv`, headers, rows);
  }

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Share Analytics</h1>
        <p className="text-gray-500 mt-1">Portfolio analysis, market data, and fundamental metrics.</p>
      </div>

      {activeTab === 'portfolio' && <>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-gray-500 uppercase">Entity</label>
            <select
              value={selectedEntityId}
              onChange={e => setSelectedEntityId(e.target.value)}
              aria-label="Select entity"
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
                placeholder="Ticker, name…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-52"
              />
            </div>
          </div>
          <div className="ml-auto flex items-center gap-3 self-end pb-2">
            <span className="text-sm text-gray-500">{filtered.length} share{filtered.length !== 1 ? 's' : ''}</span>
            {filtered.length > 0 && (
              <button
                onClick={exportSummary}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Download className="w-4 h-4" />
                Export
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Entity summary cards — only when an entity is selected */}
      {selectedEntityId && !loading && filtered.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 px-1">
            {entityName} — Portfolio Summary
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <SummaryCard label="Total Purchase Cost"  value={`Rs. ${fmt(totals.purchase_cost)}`} />
            <SummaryCard label="Total Sale Value"     value={`Rs. ${fmt(totals.sale_value)}`} />
            <SummaryCard label="Total Dividend"       value={`Rs. ${fmt(totals.dividend)}`}      color="text-yellow-700" />
            <SummaryCard label="Total Market Value"   value={`Rs. ${fmt(totals.market_value)}`}  color="text-blue-700" />
            <SummaryCard
              label="Cum Surplus (Realized)"
              value={`Rs. ${fmt(totals.cum_surplus)}`}
              color={totals.cum_surplus >= 0 ? 'text-green-700' : 'text-red-600'}
            />
            <SummaryCard label="Total Av Cost (Held)" value={`Rs. ${fmt(totals.av_cost)}`}      color="text-blue-700" />
            <SummaryCard label="Total Cash Flow"      value={`Rs. ${fmt(totals.cash_flow)}`}    color={totals.cash_flow >= 0 ? 'text-green-700' : 'text-red-600'} />
            <SummaryCard
              label="Total Surplus (incl. MV)"
              value={`Rs. ${fmt(totals.total_surplus)}`}
              color={totals.total_surplus >= 0 ? 'text-green-700' : 'text-red-600'}
              sub={`Across ${filtered.length} share${filtered.length !== 1 ? 's' : ''}`}
            />
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
          <BarChart2 className="w-12 h-12 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400 font-medium">No data found</p>
          <p className="text-gray-300 text-sm mt-1">Adjust your filters to see results</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm whitespace-nowrap">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Share','Entity','CDS Account','Share Cum Bal','Purchase Cost','Sale Value','Av Cost','Av Price','Dividend','Cum Surplus','Market Value','Cash Flow','Total Surplus','Txns'].map(h => (
                    <th key={h} className={`px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide ${h === 'Share' || h === 'Entity' || h === 'CDS Account' ? 'text-left' : 'text-right'}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((group, idx) => {
                  const last     = group.rows[group.rows.length - 1];
                  const totalPC  = group.rows.reduce((s, r) => s + r.purchase_cost, 0);
                  const totalSV  = group.rows.reduce((s, r) => s + r.sale_value, 0);
                  const totalDiv = group.rows.reduce((s, r) => s + r.dividend, 0);
                  const totalCF  = group.rows.reduce((s, r) => s + r.cash_flow, 0);
                  const txnCount = group.rows.filter(r => r.row_type === 'buy' || r.row_type === 'sell').length;

                  return (
                    <tr
                      key={`${group.entity_id}__${group.share_id}`}
                      onClick={() => setActiveGroup(group)}
                      className={`cursor-pointer transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'} hover:bg-blue-50/60`}
                    >
                      <td className="px-4 py-3">
                        <div className="font-bold text-gray-900">{group.share_ticker}</div>
                        <div className="text-xs text-gray-400 mt-0.5">{group.share_name}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-sm">{group.entity_name}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs font-mono">{group.cds_account || <span className="text-gray-300">—</span>}</td>
                      <td className="px-4 py-3 text-right font-mono font-semibold text-gray-900">{fmtN(last.share_cum_bal)}</td>
                      <td className="px-4 py-3 text-right font-mono text-gray-800">{fmt(totalPC)}</td>
                      <td className="px-4 py-3 text-right font-mono text-gray-800">{totalSV > 0 ? fmt(totalSV) : <span className="text-gray-300">—</span>}</td>
                      <td className="px-4 py-3 text-right font-mono font-semibold text-blue-700">{fmt(last.av_cost)}</td>
                      <td className="px-4 py-3 text-right font-mono text-gray-800">{fmt(last.av_price)}</td>
                      <td className="px-4 py-3 text-right font-mono">{totalDiv > 0 ? <span className="text-yellow-700 font-semibold">{fmt(totalDiv)}</span> : <span className="text-gray-300">—</span>}</td>
                      <td className="px-4 py-3 text-right font-mono"><span className={clsSurplus(last.cum_surplus)}>{fmt(last.cum_surplus)}</span></td>
                      <td className="px-4 py-3 text-right font-mono text-blue-600 font-semibold">{group.market_price > 0 ? fmt(last.market_value) : <span className="text-gray-300">—</span>}</td>
                      <td className="px-4 py-3 text-right font-mono">
                        <span className={totalCF > 0 ? 'text-green-700 font-semibold' : totalCF < 0 ? 'text-red-600 font-semibold' : 'text-gray-300'}>
                          {fmt(totalCF)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        {group.market_price > 0
                          ? <span className={clsSurplus(last.total_surplus)}>{fmt(last.total_surplus)}</span>
                          : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="inline-block bg-gray-100 text-gray-600 text-xs font-semibold px-2 py-0.5 rounded-full">{txnCount}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>

              {/* Grand totals footer */}
              <tfoot className="bg-gray-100 border-t-2 border-gray-300 text-xs font-bold">
                <tr>
                  <td colSpan={3} className="px-4 py-3 text-gray-500 uppercase">Grand Total ({filtered.length} shares)</td>
                  <td className="px-4 py-3 text-right font-mono text-gray-900">{fmtN(totals.share_cum_bal)}</td>
                  <td className="px-4 py-3 text-right font-mono text-gray-900">{fmt(totals.purchase_cost)}</td>
                  <td className="px-4 py-3 text-right font-mono text-gray-900">{fmt(totals.sale_value)}</td>
                  <td className="px-4 py-3 text-right font-mono text-blue-700">{fmt(totals.av_cost)}</td>
                  <td className="px-4 py-3" />
                  <td className="px-4 py-3 text-right font-mono text-yellow-700">{fmt(totals.dividend)}</td>
                  <td className="px-4 py-3 text-right font-mono"><span className={clsSurplus(totals.cum_surplus)}>{fmt(totals.cum_surplus)}</span></td>
                  <td className="px-4 py-3 text-right font-mono text-blue-600">{fmt(totals.market_value)}</td>
                  <td className="px-4 py-3 text-right font-mono"><span className={clsSurplus(totals.cash_flow)}>{fmt(totals.cash_flow)}</span></td>
                  <td className="px-4 py-3 text-right font-mono"><span className={clsSurplus(totals.total_surplus)}>{fmt(totals.total_surplus)}</span></td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Breakdown modal */}
      {activeGroup && <BreakdownModal group={activeGroup} onClose={() => setActiveGroup(null)} />}
      </>}
    </div>
  );
}
