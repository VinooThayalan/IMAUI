import React, { useState, useEffect, useCallback } from 'react';
import { TrendingUp, TrendingDown, BarChart2, X, Search, FileText, ChevronDown, ChevronUp, Download, ListOrdered } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { selectAll } from '../lib/selectAll';
import { DateRangeField } from '../components/DateField';
import * as sourceFingerprintRepo from '../repositories/sourceFingerprint.repo';
import { TradeOrderPanel } from '../components/TradeOrderPanel';
import { useTradeOrder } from '../hooks/useTradeOrder';
import { useShareLedger } from '../hooks/useShareLedger';
import { formatAer, netMarketValue, portfolioAer } from '../lib/aer';
import {
  type ComputedRow,
  type ShareGroup,
  groupAerPercent,
  groupCashFlows,
  closingRows,
  holdingSummary,
} from '../services/shareLedger.service';
import { undecidedDays } from '../services/tradeOrder.service';
import {
  detailExport,
  detailFilename,
  summaryExport,
} from '../services/shareAnalyticsExport.service';

function exportCsv(filename: string, headers: string[], rows: (string | number)[][], preamble: (string | number)[][] = []) {
  const escape = (v: string | number) => {
    const s = String(v ?? '');
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
  };
  // Leading BOM, matching lib/exportData.ts. Without it Excel reads the file as
  // the system codepage, and any non-ASCII character in an entity or share name
  // opens as mojibake.
  const csv = '﻿' + [...preamble, headers, ...rows].map(r => r.map(escape).join(',')).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ── Types ────────────────────────────────────────────────────────────────────

interface Entity { id: string; name: string; }


// ── AER ──────────────────────────────────────────────────────────────────────
// xirr / aerPercent / netMarketValue / portfolioAer now live in ../lib/aer so
// that this screen, Portfolio Summary, the Dashboard and Reports all answer the
// same question the same way.

/**
 * Everything an error actually carries, in one line.
 *
 * A Supabase/PostgREST failure is a plain object with code, details and hint
 * alongside message, and those are the parts that identify the cause — an RLS
 * refusal, a numeric overflow, a missing column all look alike by message. A
 * ReferenceError, meanwhile, only makes sense with its name. Reducing either to
 * `err.message` is how an error surfaces to a user as an unattributable fragment
 * that cannot be traced back to the call that produced it.
 */
function describeDbError(err: unknown): string {
  if (err && typeof err === 'object') {
    const e = err as { message?: unknown; code?: unknown; details?: unknown; hint?: unknown; name?: unknown };
    const parts = [
      typeof e.name === 'string' && e.name && e.name !== 'Error' ? e.name : null,
      typeof e.message === 'string' ? e.message : null,
      typeof e.code === 'string' && e.code ? `code ${e.code}` : null,
      typeof e.details === 'string' && e.details ? e.details : null,
      typeof e.hint === 'string' && e.hint ? `hint: ${e.hint}` : null,
    ].filter(Boolean);
    if (parts.length) return parts.join(' · ');
  }
  return String(err);
}

// ── Core calculation ─────────────────────────────────────────────────────────


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

function BreakdownModal({ group, onClose, fromDate, onOrderSaved }: {
  group: ShareGroup;
  onClose: () => void;
  fromDate: string;
  /** Run after a same-day order is written — the report has to be reread. */
  onOrderSaved: () => void;
}) {
  const last = group.rows[group.rows.length - 1];
  const [expandedNoteId, setExpandedNoteId] = useState<string | null>(null);
  const [noteDetails, setNoteDetails]       = useState<Map<string, NoteDetail>>(new Map());
  const [noteLoading, setNoteLoading]       = useState<string | null>(null);
  const [orderOpen, setOrderOpen]           = useState(false);

  const order    = useTradeOrder(group.rows, group.entity_id, onOrderSaved);
  const undecided = undecidedDays(order.groups);

  // Header figures — the same object the export's summary block reads.
  const summary  = holdingSummary(group, new Date());
  const groupAer = summary?.aerPercent ?? null;

  function exportDetail() {
    const asOf = new Date();
    const { preamble, headers, rows } = detailExport(group, asOf);
    exportCsv(detailFilename(group, asOf), headers, rows, preamble);
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
    if (type === 'Scrip')
      return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800">Scrip</span>;
    const isBuy = type === 'Buy' || type === 'BUY';
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${isBuy ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
        {isBuy ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
        {isBuy ? 'Buy' : 'Sell'}
      </span>
    );
  };

  const COLS = ['Date','Status','Unit Price','No. of shares','Share cum bal','purchase cost','sale value','Sale Cost','Av Cost','av price','Dividend','Market value','Cash flow +/-','Total Surplus','Cum surplus','CDS Account','Note'];

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
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <p className="text-sm text-gray-400">{group.entity_name}</p>
              {group.cds_accounts.length > 0 && group.cds_accounts.map(cds => (
                <span key={cds} className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md">
                  CDS: {cds}
                </span>
              ))}
            </div>
          </div>

          {/* Summary pills */}
          <div className="flex items-center gap-5 mr-6 text-sm flex-wrap">
            <div className="text-center">
              <div className="text-xs text-gray-400">Shares Held</div>
              <div className="font-bold text-gray-900">{fmtN(last.share_cum_bal)}</div>
            </div>
            <div className="text-center">
              <div className="text-xs text-gray-400">Av Price</div>
              <div className="font-bold text-gray-900">Rs. {fmt(last.av_price)}</div>
            </div>
            {summary?.marketPrice != null && (
              <>
                <div className="text-center">
                  <div className="text-xs text-gray-400">
                    Market Price
                    {summary.marketPriceDate && <span className="ml-1 text-gray-300">({fmtDate(summary.marketPriceDate)})</span>}
                  </div>
                  <div className="font-bold text-gray-900">Rs. {fmt(summary.marketPrice)}</div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-gray-400">MV After Fees Per Share</div>
                  <div className="font-bold text-indigo-700">{summary.mvAfterFeesPerShare == null ? '—' : `Rs. ${fmt(summary.mvAfterFeesPerShare)}`}</div>
                </div>
              </>
            )}
            <div className="text-center">
              <div className="text-xs text-gray-400">Cum Surplus</div>
              {summary
                ? <div className={clsSurplus(summary.cumSurplus)}>Rs. {fmt(summary.cumSurplus)}</div>
                : <div className="text-gray-400">—</div>}
            </div>
            <div className="text-center">
              <div className="text-xs text-gray-400">AER (XIRR)</div>
              <div className={`font-bold ${groupAer === null ? 'text-gray-400' : groupAer >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                {formatAer(groupAer)}
              </div>
            </div>
          </div>

          {order.groups.length > 0 && (
            <button
              onClick={() => setOrderOpen(true)}
              title="Set the order of trades that share a date"
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold flex-shrink-0 mr-2 transition-colors ${
                undecided > 0
                  ? 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <ListOrdered className="w-3.5 h-3.5" />
              Same-day order
              {undecided > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-amber-500 text-white text-[10px] leading-none">
                  {undecided}
                </span>
              )}
            </button>
          )}
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
                  <th key={h} className={`px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide ${h === 'Date' || h === 'Status' || h === 'Note' || h === 'CDS Account' ? 'text-left' : 'text-right'}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(fromDate ? group.rows.filter(r => r.trade_date && r.trade_date >= fromDate) : group.rows).map((row, idx) => {
                const isOp    = row.row_type === 'opening';
                const isDiv   = row.row_type === 'dividend';
                const isScrip = row.row_type === 'scrip';
                const isNote  = row.row_type === 'buy' || row.row_type === 'sell';
                const bg      = isOp ? 'bg-blue-50/70' : isDiv ? 'bg-yellow-50/60' : isScrip ? 'bg-purple-50/60' : idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50';
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
                      <td className="px-3 py-2 text-right font-mono text-orange-700">
                        {row.row_type === 'sell' && row.no_of_shares > 0 ? fmt(row.no_of_shares * row.av_price) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-3 py-2 text-right font-mono font-semibold text-blue-700">{fmt(row.av_cost)}</td>
                      <td className="px-3 py-2 text-right font-mono font-semibold text-gray-900">{fmt(row.av_price)}</td>
                      <td className="px-3 py-2 text-right font-mono">{row.dividend > 0 ? <span className="text-yellow-700 font-semibold">{fmt(row.dividend)}</span> : <span className="text-gray-300">—</span>}</td>
                      <td className="px-3 py-2 text-right font-mono text-gray-300">—</td>
                      <td className="px-3 py-2 text-right font-mono">
                        <span className={row.cash_flow > 0 ? 'text-green-700 font-semibold' : row.cash_flow < 0 ? 'text-red-600 font-semibold' : 'text-gray-300'}>
                          {row.cash_flow !== 0 ? fmt(row.cash_flow) : '—'}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right font-mono">
                        <span className={row.cash_flow > 0 ? 'text-green-700 font-semibold' : row.cash_flow < 0 ? 'text-red-600 font-semibold' : 'text-gray-300'}>
                          {row.cash_flow !== 0 ? fmt(row.cash_flow) : '—'}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right font-mono"><span className={clsSurplus(row.cum_surplus)}>{fmt(row.cum_surplus)}</span></td>
                      <td className="px-3 py-2 text-left text-xs font-mono text-gray-500">
                        {row.cds_account ?? <span className="text-gray-300">—</span>}
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
                        <td colSpan={17} className="px-6 py-4">
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
            <tfoot className="sticky bottom-0 border-t-2 border-gray-300 text-xs font-bold">
              {/*
                Market Value row + Cost per share row.

                Both come from `closingRows` in the service, which the CSV export
                projects as well. They used to be computed here and rebuilt a
                second time in `exportDetail`, and the two copies disagreed on
                four separate figures. One definition, two readers.

                A null cell is an em dash — the row has nothing to say there, and
                a zero would claim it did.
              */}
              {closingRows(group, new Date()).map(c => {
                const isMv  = c.label === 'Market Value';
                const tone  = isMv
                  ? { row: 'bg-slate-800 text-white', dim: 'text-slate-300', val: 'text-white', pos: 'text-emerald-300', cost: 'text-blue-300', badge: 'bg-slate-600 text-white', pill: 'text-slate-400' }
                  : { row: 'bg-amber-50 border-t-2 border-amber-300', dim: 'text-amber-700', val: 'text-amber-900', pos: 'text-amber-900', cost: 'text-blue-700', badge: 'bg-amber-400 text-white', pill: 'text-amber-700' };
                const cell  = (v: number | null, cls: string, d = 2) =>
                  <td className={`px-3 py-2.5 text-right font-mono ${v == null ? tone.dim : cls}`}>{v == null ? '—' : fmt(v, d)}</td>;
                const count = (v: number | null) =>
                  <td className={`px-3 py-2.5 text-right font-mono ${v == null ? tone.dim : tone.val}`}>{v == null ? '—' : fmtN(v)}</td>;
                const signed = (v: number) =>
                  <td className="px-3 py-2.5 text-right font-mono">
                    <span className={isMv ? (v >= 0 ? 'text-emerald-300' : 'text-red-400') : clsSurplus(v)}>{fmt(v)}</span>
                  </td>;

                return (
                  <tr key={c.label} className={tone.row}>
                    <td className={`px-3 py-2.5 ${tone.dim}`}>{c.date ? fmtDate(c.date) : '—'}</td>
                    <td className="px-3 py-2.5">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${tone.badge}`}>{c.label}</span>
                    </td>
                    {cell(c.unitPrice, `${tone.val} font-bold`)}
                    {count(c.shares)}
                    {count(c.shareCumBal)}
                    {cell(c.purchaseCost, tone.val)}
                    {cell(c.saleValue, tone.pos)}
                    {cell(c.saleCost, tone.val)}
                    {cell(c.avCost, tone.cost)}
                    {cell(c.avPrice, tone.val)}
                    {cell(c.dividend, tone.val)}
                    {cell(c.marketValue, isMv ? tone.pos : tone.cost)}
                    {signed(c.cashFlow)}
                    {signed(c.totalSurplus)}
                    {signed(c.cumSurplus)}
                    <td className={`px-3 py-2.5 ${tone.pill}`}>—</td>
                  </tr>
                );
              })}
              {/* The "Totals / Final" row was removed here — reported as not
                  required. The Market Value and Cost per share rows above stay:
                  they are the closing position, not a column summary. */}
            </tfoot>
          </table>
        </div>
      </div>

      {orderOpen && (
        <TradeOrderPanel
          shareTicker={group.share_ticker}
          entityName={group.entity_name}
          days={order.groups}
          draft={order.draft}
          saving={order.saving}
          isDirty={order.isDirty}
          onMove={order.move}
          onSave={d => void order.save(d)}
          onClear={d => void order.clear(d)}
          onClose={() => setOrderOpen(false)}
        />
      )}
    </div>
  );
}


// ── Main component ───────────────────────────────────────────────────────────

export function ShareAnalytics() {
  const activeTab = 'portfolio';
  const [entities, setEntities]                   = useState<Entity[]>([]);
  const [selectedEntityId, setSelectedEntityId]   = useState('');
  const [search, setSearch]                       = useState('');
  const [fromDate, setFromDate]                   = useState('');
  const [toDate, setToDate]                       = useState('');
  const [loading, setLoading]                     = useState(false);
  const [groups, setGroups]                       = useState<ShareGroup[]>([]);
  const [activeGroup, setActiveGroup]             = useState<ShareGroup | null>(null);
  const [cacheError, setCacheError]               = useState<string | null>(null);
  const { loadGroups } = useShareLedger();

  useEffect(() => {
    supabase.from('entities').select('id, name').order('name').then(({ data }) => setEntities(data || []));
  }, []);

  useEffect(() => { fetchData(); }, [selectedEntityId]);

  /*
    Keep the open breakdown pointing at the refreshed group.

    `activeGroup` holds the object, not a key, so after a refetch it is a
    detached copy of the pre-refetch numbers. Saving a same-day order refetches
    precisely so the figures move, and without this the modal the user is looking
    at would go on showing the ones they just changed. Cleared, rather than left
    stale, if the holding is no longer in the result.
  */
  useEffect(() => {
    setActiveGroup(prev => {
      if (!prev) return prev;
      return groups.find(g => g.entity_id === prev.entity_id && g.share_id === prev.share_id) ?? null;
    });
  }, [groups]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      /*
        ── Cache layer ──────────────────────────────────────────────────────
        If the fingerprint matches a cached batch, serve it — no recompute.

        This screen is the one that *writes* `share_analytics_cache`, while
        Portfolio and Portfolio Summary read it. It kept its own inline copy of
        the eight probes, so writer and readers each had their own idea of what
        the key was; any drift between them means the cache is written under a
        key nobody looks up. One definition, in the repository.
      */
      const sourceHash = await sourceFingerprintRepo.current();

      // Check whether we already have a cached batch with this exact hash
      const { data: existingBatch } = await supabase
        .from('share_analytics_cache')
        .select('source_hash')
        .eq('source_hash', sourceHash)
        .limit(1)
        .maybeSingle();

      if (existingBatch) {
        // ── Cache hit — read from cache table ──────────────────────────────
        // Paged: this select used to run unbounded and was silently truncated
        // at db-max-rows, which left groups missing their closing rows.
        const cached = await selectAll(() =>
          supabase
            .from('share_analytics_cache')
            .select('*')
            .eq('source_hash', sourceHash)
            .order('entity_name', { ascending: true })
            .order('share_ticker', { ascending: true })
            .order('row_index', { ascending: true })
            .order('id', { ascending: true }),
        );

        // An empty paged read means there is nothing to serve, so fall through
        // and recompute rather than showing an empty report.
        if (cached.length > 0) {
          // Reconstruct groups from cached rows
          const groupMap = new Map<string, ShareGroup>();
          for (const c of cached) {
            if (selectedEntityId && c.entity_id !== selectedEntityId) continue;
            const key = `${c.entity_id}__${c.share_id}`;
            const row: ComputedRow = {
              id: c.row_id,
              note_type: c.note_type,
              trade_date: c.trade_date,
              no_of_shares: Number(c.no_of_shares) || 0,
              price_avg: c.price_avg != null ? Number(c.price_avg) : null,
              gross_amount: Number(c.gross_amount) || 0,
              net_amount: Number(c.net_amount) || 0,
              entity_id: c.entity_id,
              entity_name: c.entity_name,
              share_id: c.share_id,
              share_ticker: c.share_ticker,
              share_name: c.share_name,
              cds_account: c.cds_account,
              row_type: c.row_type as ComputedRow['row_type'],
              purchase_cost: Number(c.purchase_cost) || 0,
              sale_value: Number(c.sale_value) || 0,
              dividend: Number(c.dividend) || 0,
              share_cum_bal: Number(c.share_cum_bal) || 0,
              av_cost: Number(c.av_cost) || 0,
              av_price: Number(c.av_price) || 0,
              cum_purchase_cost: Number(c.cum_purchase_cost) || 0,
              cum_sale_value: Number(c.cum_sale_value) || 0,
              cum_dividend: Number(c.cum_dividend) || 0,
              cum_surplus: Number(c.cum_surplus) || 0,
              market_value: Number(c.market_value) || 0,
              cash_flow: Number(c.cash_flow) || 0,
              total_surplus: Number(c.total_surplus) || 0,
              // Null, not 0: a row with no stated position has not been given
              // position zero, and the panel reads this to decide whether a day
              // has been decided at all.
              intraday_seq: c.intraday_seq != null ? Number(c.intraday_seq) : null,
            };
            let grp = groupMap.get(key);
            if (!grp) {
              grp = {
                share_id: c.share_id,
                share_ticker: c.share_ticker,
                share_name: c.share_name,
                entity_id: c.entity_id,
                entity_name: c.entity_name,
                market_price: Number(c.market_price) || 0,
                market_price_date: c.market_price_date ?? null,
                cds_accounts: c.cds_accounts ?? [],
                brokerage_fee_rate: Number(c.brokerage_fee_rate) || 0,
                rows: [],
              };
              groupMap.set(key, grp);
            }
            grp.rows.push(row);
          }
          const cachedGroups = Array.from(groupMap.values());
          // Rows arrive ordered by row_index, so they are already in compute
          // order and must not be re-sorted here. The old trade_date sort put
          // undated rows first while Portfolio Summary's SQL sort put them last,
          // so the two screens read a different row as the closing position.
          cachedGroups.sort((a, b) => a.entity_name.localeCompare(b.entity_name) || a.share_ticker.localeCompare(b.share_ticker));
          setGroups(cachedGroups);
          return; // Skip full recompute
        }
      }

      // ── Cache miss — recompute from source tables ─────────────────────────
      // Built by `shareGroups.service`, the assembly the Dashboard and Reports
      // read too. It lived here as a third copy.
      //
      // Every entity is computed, because the cache is written for all of them;
      // only the selected one is shown. The miss path used to show every entity
      // regardless of the filter, until the next visit hit the cache.
      const result = await loadGroups();
      setGroups(selectedEntityId ? result.filter(g => g.entity_id === selectedEntityId) : result);

      // Persist computed result to cache (own try/catch so write failure still shows the report)
      try {
        setCacheError(null);
        const cacheRows: Record<string, unknown>[] = [];
        const today = new Date();
        for (const g of result) {
          const groupAer = groupAerPercent(g, today);

          for (const [rowIndex, r] of g.rows.entries()) {
            cacheRows.push({
              row_index: rowIndex,
              entity_id: g.entity_id, share_id: g.share_id,
              entity_name: g.entity_name, share_ticker: g.share_ticker, share_name: g.share_name,
              market_price: g.market_price, market_price_date: g.market_price_date,
              cds_accounts: g.cds_accounts, brokerage_fee_rate: g.brokerage_fee_rate,
              row_id: r.id, row_type: r.row_type, note_type: r.note_type,
              trade_date: r.trade_date, no_of_shares: r.no_of_shares,
              price_avg: r.price_avg, gross_amount: r.gross_amount ?? 0, net_amount: r.net_amount ?? 0,
              cds_account: r.cds_account,
              intraday_seq: r.intraday_seq ?? null,
              purchase_cost: r.purchase_cost, sale_value: r.sale_value, dividend: r.dividend,
              share_cum_bal: r.share_cum_bal, av_cost: r.av_cost, av_price: r.av_price,
              cum_purchase_cost: r.cum_purchase_cost, cum_sale_value: r.cum_sale_value,
              cum_dividend: r.cum_dividend, cum_surplus: r.cum_surplus,
              market_value: r.market_value, cash_flow: r.cash_flow, total_surplus: r.total_surplus,
              aer: groupAer,
              source_hash: sourceHash,
            });
          }
        }
        if (cacheRows.length > 0) {
          /*
            Written one entity at a time, rather than "delete everything, then
            insert everything".

            The old shape deleted every row the caller could see and then inserted
            the whole batch. Two ways that hurt, and there is no transaction across
            PostgREST calls to save it:

              - INSERT is gated by has_entity_access(entity_id), so a report
                spanning an entity the user cannot write fails the batch. The
                delete had already succeeded, so the cache was left EMPTY and every
                later visit recomputed from scratch — worse than before the write
                was attempted.
              - any other single bad row (an out-of-range number, a constraint)
                took down the whole cache the same way.

            Scoping delete+insert to one entity keeps the damage local: entities
            that can be written are cached, the rest are reported, and nobody's
            existing cache is destroyed by a failure that belongs to someone else.
          */
          const byEntity = new Map<string, Record<string, unknown>[]>();
          for (const row of cacheRows) {
            const key = String(row.entity_id);
            if (!byEntity.has(key)) byEntity.set(key, []);
            byEntity.get(key)!.push(row);
          }

          const failures: string[] = [];
          for (const [entityId, rows] of byEntity) {
            const label = String(rows[0]?.entity_name ?? entityId);
            try {
              const { error: delErr } = await supabase
                .from('share_analytics_cache')
                .delete()
                .eq('entity_id', entityId);
              if (delErr) throw new Error(`delete: ${describeDbError(delErr)}`);

              for (let i = 0; i < rows.length; i += 500) {
                const { error: insErr } = await supabase
                  .from('share_analytics_cache')
                  .insert(rows.slice(i, i + 500));
                if (insErr) throw new Error(`insert: ${describeDbError(insErr)}`);
              }
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              console.error(`[analytics cache] ${label}:`, err);
              failures.push(`${label} — ${msg}`);
            }
          }

          if (failures.length > 0) {
            const cached = byEntity.size - failures.length;
            setCacheError(
              `${failures.length} of ${byEntity.size} entities could not be cached` +
                (cached > 0 ? ` (${cached} cached)` : '') +
                `: ${failures.join('; ')}`,
            );
          }
        }
      } catch (err) {
        // Keep whatever the error actually carries. This used to reduce everything
        // to err.message, which is how "Cache write failed: <bare message>" reached
        // users with no code, no hint, and no clue which call produced it.
        console.error('[analytics cache] write failed:', err);
        setCacheError(describeDbError(err));
      }

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [selectedEntityId, loadGroups]);

  /*
    The end date truncates history; the start date does not.

    This asymmetry is the whole design. Every row carries the cumulative state
    after it, so dropping everything after the end date leaves the last
    surviving row holding the position exactly as it stood that day -- an "as
    of" report, no recomputation needed.

    Dropping rows *before* a start date would do the opposite. The balance,
    average cost and cumulative totals all depend on the purchases that came
    first, so a report that hid them would show a holding with no record of
    having been bought. The start date therefore filters what is listed and
    what the activity columns sum, and never what the position is built from.

    Undated rows are kept: an opening balance predates any window, and nothing
    else should be silently dropped for want of a date.
  */
  const inWindow = groups
    .map(g => (toDate
      ? { ...g, rows: g.rows.filter(r => !r.trade_date || r.trade_date <= toDate) }
      : g))
    .filter(g => g.rows.length > 0);

  /** Rows a period's activity columns should sum: within the window. */
  const activityRows = (g: ShareGroup) =>
    fromDate ? g.rows.filter(r => r.trade_date && r.trade_date >= fromDate) : g.rows;

  const filtered = inWindow.filter(g => {
    if (!search) return true;
    const q = search.toLowerCase();
    return g.share_ticker.toLowerCase().includes(q) || g.share_name.toLowerCase().includes(q) || g.entity_name.toLowerCase().includes(q);
  });

  // Aggregate totals across filtered groups. Position columns come from the
  // last row inside the window; activity columns sum only the period's rows.
  const totals = filtered.reduce((acc, g) => {
    const last = g.rows[g.rows.length - 1];
    const act  = activityRows(g);
    const mvAfterFees = netMarketValue(last.share_cum_bal, g.market_price, g.brokerage_fee_rate);
    const pc  = act.reduce((s, r) => s + r.purchase_cost, 0);
    const sv  = act.reduce((s, r) => s + r.sale_value, 0);
    const div = act.reduce((s, r) => s + r.dividend, 0);
    return {
      share_cum_bal:      acc.share_cum_bal   + last.share_cum_bal,
      purchase_cost:      acc.purchase_cost   + pc,
      sale_value:         acc.sale_value      + sv,
      av_cost:            acc.av_cost         + last.av_cost,
      dividend:           acc.dividend        + div,
      cum_surplus:        acc.cum_surplus     + last.cum_surplus,
      market_value:       acc.market_value    + last.market_value,
      mv_after_fees:      acc.mv_after_fees   + mvAfterFees,
      cash_flow:          acc.cash_flow       + act.reduce((s, r) => s + r.cash_flow, 0),
      total_surplus:      acc.total_surplus   + (mvAfterFees + sv + div - pc),
    };
  }, { share_cum_bal: 0, purchase_cost: 0, sale_value: 0, av_cost: 0, dividend: 0, cum_surplus: 0, market_value: 0, mv_after_fees: 0, cash_flow: 0, total_surplus: 0 });

  // Portfolio-level XIRR — terminal date is always today to match Portfolio Summary.
  // Terminal value is net of brokerage, the same basis the per-share AER uses;
  // it used to discount the gross market value, which flattered this card
  // against every other screen.
  const portfolioAerResult = portfolioAer(
    filtered.map(g => {
      const last = g.rows[g.rows.length - 1];
      return {
        label: g.share_ticker,
        cashFlows: groupCashFlows(g.rows),
        heldShares: last.share_cum_bal,
        marketPrice: g.market_price,
        brokerageFeeRate: g.brokerage_fee_rate,
      };
    }),
    new Date(),
  );
  const portfolioAerPct = portfolioAerResult.percent;
  const unpricedShares  = portfolioAerResult.excluded;

  const entityName = selectedEntityId ? (entities.find(e => e.id === selectedEntityId)?.name ?? '') : '';

  function exportSummary() {
    const asOf = new Date();
    const { headers, rows } = summaryExport(filtered, activityRows, asOf);
    const date  = asOf.toISOString().split('T')[0];
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
          <DateRangeField
            from={fromDate}
            to={toDate}
            onFromChange={setFromDate}
            onToChange={setToDate}
            fromLabel="From"
            toLabel="To (as of)"
            layout="stacked"
            labelStyle="filter"
          />
          {(fromDate || toDate) && (
            <button
              onClick={() => { setFromDate(''); setToDate(''); }}
              className="px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors self-end"
            >
              Clear dates
            </button>
          )}
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

        {/* The two dates do different jobs, and reading the report as though
            they did the same thing is the easy mistake. Say which is which. */}
        {(fromDate || toDate) && (
          <div className="mt-3 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-xs text-blue-900">
            {toDate && (
              <>Balance, average cost and market value are <strong>as at {fmtDate(toDate)}</strong>; anything traded later is excluded. </>
            )}
            {fromDate && (
              <>Purchase cost, sale value, dividend and cash flow cover <strong>{fmtDate(fromDate)} onward</strong> only — the position itself still includes everything bought before then, or it would not add up. </>
            )}
            Market price is the latest on file, not the price on the as-at date.
          </div>
        )}
      </div>

      {/* Cache write error banner */}
      {cacheError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4 text-sm text-red-700">
          <span className="font-semibold">Cache write failed: </span>
          {cacheError}
        </div>
      )}

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
            <SummaryCard label="MV after Brokerage"   value={`Rs. ${fmt(totals.mv_after_fees)}`} color="text-indigo-700" />
            <SummaryCard
              label="Cum Surplus (Realized)"
              value={`Rs. ${fmt(totals.cum_surplus)}`}
              color={totals.cum_surplus >= 0 ? 'text-green-700' : 'text-red-600'}
            />
            <SummaryCard label="Total Av Cost (Held)" value={`Rs. ${fmt(totals.av_cost)}`}      color="text-blue-700" />
            <SummaryCard label="Total Cash Flow"      value={`Rs. ${fmt(totals.cash_flow)}`}    color={totals.cash_flow >= 0 ? 'text-green-700' : 'text-red-600'} />
            <SummaryCard
              label="AER (XIRR)"
              value={formatAer(portfolioAerPct)}
              color={
                portfolioAerPct === null ? 'text-gray-400'
                  : portfolioAerPct >= 0 ? 'text-green-700'
                  : 'text-red-600'
              }
              sub={
                unpricedShares.length > 0
                  ? `Excludes ${unpricedShares.length} share${unpricedShares.length === 1 ? '' : 's'} with no market price`
                  : 'Annualised portfolio return'
              }
            />
          </div>

          {/* A held position with no market price has no terminal value, so it
              cannot enter the portfolio XIRR. Name them — left silent, they used
              to sit in the pool as pure outflows and drag the number negative. */}
          {unpricedShares.length > 0 && (
            <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800">
              <span className="font-semibold">
                {unpricedShares.length} held share{unpricedShares.length === 1 ? ' has' : 's have'} no market price
                {' '}and {unpricedShares.length === 1 ? 'is' : 'are'} excluded from the portfolio AER:
              </span>{' '}
              {unpricedShares.join(', ')}. Upload their latest prices for a complete figure.
            </div>
          )}
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
                  {['Share','Entity','CDS Account','Share Cum Bal','Purchase Cost','Sale Value','Av Cost','Av Price','Dividend','Cum Surplus','Market Value','MV after Fees','Cash Flow','Total Surplus','Txns'].map(h => (
                    <th key={h} className={`px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide ${h === 'Share' || h === 'Entity' || h === 'CDS Account' ? 'text-left' : 'text-right'}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((group, idx) => {
                  const last     = group.rows[group.rows.length - 1];
                  const act      = activityRows(group);
                  const totalPC  = act.reduce((s, r) => s + r.purchase_cost, 0);
                  const totalSV  = act.reduce((s, r) => s + r.sale_value, 0);
                  const totalDiv = act.reduce((s, r) => s + r.dividend, 0);
                  const totalCF  = act.reduce((s, r) => s + r.cash_flow, 0);
                  const txnCount = act.filter(r => r.row_type === 'buy' || r.row_type === 'sell' || r.row_type === 'scrip').length;

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
                      <td className="px-4 py-3 text-left text-gray-500 text-xs font-mono">
                        {group.cds_accounts.length > 0
                          ? group.cds_accounts.map((cds, i) => <div key={i}>{cds}</div>)
                          : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-semibold text-gray-900">{fmtN(last.share_cum_bal)}</td>
                      <td className="px-4 py-3 text-right font-mono text-gray-800">{fmt(totalPC)}</td>
                      <td className="px-4 py-3 text-right font-mono text-gray-800">{totalSV > 0 ? fmt(totalSV) : <span className="text-gray-300">—</span>}</td>
                      <td className="px-4 py-3 text-right font-mono font-semibold text-blue-700">{fmt(last.av_cost)}</td>
                      <td className="px-4 py-3 text-right font-mono text-gray-800">{fmt(last.av_price)}</td>
                      <td className="px-4 py-3 text-right font-mono">{totalDiv > 0 ? <span className="text-yellow-700 font-semibold">{fmt(totalDiv)}</span> : <span className="text-gray-300">—</span>}</td>
                      <td className="px-4 py-3 text-right font-mono"><span className={clsSurplus(last.cum_surplus)}>{fmt(last.cum_surplus)}</span></td>
                      <td className="px-4 py-3 text-right font-mono text-blue-600 font-semibold">
                        {group.market_price > 0
                          ? <div>
                              <div>{fmt(last.market_value)}</div>
                              {group.market_price_date && <div className="text-xs text-gray-400 font-normal">({fmtDate(group.market_price_date)})</div>}
                            </div>
                          : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-indigo-600 font-semibold">
                        {group.market_price > 0
                          ? fmt(last.market_value * (1 - group.brokerage_fee_rate / 100))
                          : <span className="text-gray-300">—</span>}
                      </td>
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
                  <td className="px-4 py-3 text-right font-mono text-indigo-600">{fmt(totals.mv_after_fees)}</td>
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
      {activeGroup && (
        <BreakdownModal
          group={activeGroup}
          onClose={() => setActiveGroup(null)}
          fromDate={fromDate}
          onOrderSaved={() => void fetchData()}
        />
      )}
      </>}
    </div>
  );
}
