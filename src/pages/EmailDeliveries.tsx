import { useState, useEffect, useCallback } from 'react';
import { Search, Download, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Filter, X, Mail, MailOpen, MailX, Eye } from 'lucide-react';
import { supabase } from '../lib/supabase';

const PAGE_SIZE = 25;

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string; icon: typeof Mail }> = {
  sent: { bg: 'bg-green-100', text: 'text-green-800', label: 'Sent', icon: MailOpen },
  failed: { bg: 'bg-red-100', text: 'text-red-800', label: 'Failed', icon: MailX },
};

const SOURCE_LABELS: Record<string, string> = {
  'transactions': 'Transactions',
  'transaction-approvals': 'Transaction Approvals',
  'buy-sell-approvals': 'Buy & Sell Approvals',
  'test-email': 'Test Email',
};

interface EmailLog {
  id: string;
  to_email: string;
  cc_emails: string[] | null;
  subject: string;
  html_content: string | null;
  status: string;
  error_message: string | null;
  triggered_by: string | null;
  source: string | null;
  email_type: string | null;
  created_at: string;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
    ' ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function EmailDeliveries() {
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [previewLog, setPreviewLog] = useState<EmailLog | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const [filterStatus, setFilterStatus] = useState('');
  const [filterSource, setFilterSource] = useState('');
  const [filterUser, setFilterUser] = useState('');
  const [filterEmail, setFilterEmail] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [filterSearch, setFilterSearch] = useState('');

  const [sources, setSources] = useState<string[]>([]);
  const [users, setUsers] = useState<string[]>([]);

  const loadFilterOptions = useCallback(async () => {
    const [sourceRes, userRes] = await Promise.all([
      supabase.from('email_logs').select('source'),
      supabase.from('email_logs').select('triggered_by'),
    ]);
    const uniqueSources = [...new Set((sourceRes.data || []).map((r: any) => r.source).filter(Boolean))].sort();
    setSources(uniqueSources);
    const uniqueUsers = [...new Set((userRes.data || []).map((r: any) => r.triggered_by).filter(Boolean))].sort();
    setUsers(uniqueUsers);
  }, []);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('email_logs')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (filterStatus) query = query.eq('status', filterStatus);
      if (filterSource) query = query.eq('source', filterSource);
      if (filterUser) query = query.eq('triggered_by', filterUser);
      if (filterEmail) query = query.ilike('to_email', `%${filterEmail}%`);
      if (filterDateFrom) query = query.gte('created_at', filterDateFrom + 'T00:00:00');
      if (filterDateTo) query = query.lte('created_at', filterDateTo + 'T23:59:59');
      if (filterSearch) query = query.or(`subject.ilike.%${filterSearch}%,to_email.ilike.%${filterSearch}%`);

      const { data, count, error } = await query;
      if (error) throw error;
      setLogs(data || []);
      setTotalCount(count || 0);
    } catch (err) {
      console.error('Error loading email logs:', err);
    } finally {
      setLoading(false);
    }
  }, [page, filterStatus, filterSource, filterUser, filterEmail, filterDateFrom, filterDateTo, filterSearch]);

  useEffect(() => { loadFilterOptions(); }, [loadFilterOptions]);
  useEffect(() => { loadLogs(); }, [loadLogs]);

  function clearFilters() {
    setFilterStatus('');
    setFilterSource('');
    setFilterUser('');
    setFilterEmail('');
    setFilterDateFrom('');
    setFilterDateTo('');
    setFilterSearch('');
    setPage(0);
  }

  const hasFilters = filterStatus || filterSource || filterUser || filterEmail || filterDateFrom || filterDateTo || filterSearch;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  function handleExport() {
    const headers = ['Timestamp', 'To', 'CC', 'Subject', 'Status', 'Triggered By', 'Source', 'Email Type', 'Error'];
    const rows = logs.map(l => [
      l.created_at,
      l.to_email,
      (l.cc_emails || []).join('; '),
      l.subject,
      l.status,
      l.triggered_by || '',
      SOURCE_LABELS[l.source || ''] || l.source || '',
      l.email_type || '',
      l.error_message || '',
    ]);
    const escape = (v: string) => (v.includes(',') || v.includes('"') ? `"${v.replace(/"/g, '""')}"` : v);
    const csv = [headers, ...rows].map(r => r.map(c => escape(String(c))).join(',')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `email_deliveries_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const sentCount = logs.filter(l => l.status === 'sent').length;
  const failedCount = logs.filter(l => l.status === 'failed').length;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Email Deliveries</h1>
          <p className="text-gray-500 mt-1">Track all emails sent from the system</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium border rounded-lg transition-colors ${
              hasFilters ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Filter className="w-4 h-4" />
            Filters
            {hasFilters && <span className="ml-1 w-2 h-2 bg-blue-500 rounded-full" />}
          </button>
          <button
            onClick={handleExport}
            disabled={logs.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Total (This Page)</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{logs.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Sent</p>
          <p className="text-2xl font-bold text-green-600 mt-1">{sentCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Failed</p>
          <p className="text-2xl font-bold text-red-600 mt-1">{failedCount}</p>
        </div>
      </div>

      {/* Filters panel */}
      {showFilters && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
              <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(0); }} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white">
                <option value="">All Statuses</option>
                <option value="sent">Sent</option>
                <option value="failed">Failed</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Functionality</label>
              <select value={filterSource} onChange={e => { setFilterSource(e.target.value); setPage(0); }} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white">
                <option value="">All Sources</option>
                {sources.map(s => (
                  <option key={s} value={s}>{SOURCE_LABELS[s] || s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Triggered By</label>
              <select value={filterUser} onChange={e => { setFilterUser(e.target.value); setPage(0); }} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white">
                <option value="">All Users</option>
                {users.map(u => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Recipient Email</label>
              <input
                type="text"
                placeholder="recipient@example.com"
                value={filterEmail}
                onChange={e => { setFilterEmail(e.target.value); setPage(0); }}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">From Date</label>
              <input type="date" value={filterDateFrom} onChange={e => { setFilterDateFrom(e.target.value); setPage(0); }} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">To Date</label>
              <input type="date" value={filterDateTo} onChange={e => { setFilterDateTo(e.target.value); setPage(0); }} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Search Subject</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Subject or recipient..."
                  value={filterSearch}
                  onChange={e => { setFilterSearch(e.target.value); setPage(0); }}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg"
                />
              </div>
            </div>
            <div className="flex items-end">
              {hasFilters && (
                <button onClick={clearFilters} className="inline-flex items-center gap-1 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg">
                  <X className="w-4 h-4" /> Clear All
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Summary bar */}
      <div className="flex items-center justify-between text-sm text-gray-500">
        <span>
          Showing {logs.length > 0 ? page * PAGE_SIZE + 1 : 0}–{page * PAGE_SIZE + logs.length} of {totalCount} emails
        </span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400">
            <Mail className="w-12 h-12 mb-3" />
            <p className="text-sm">No email delivery records found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Date / Time</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Recipient</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Subject</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Triggered By</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Functionality</th>
                  <th className="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {logs.map((log) => {
                  const statusStyle = STATUS_STYLES[log.status] || { bg: 'bg-gray-100', text: 'text-gray-800', label: log.status, icon: Mail };
                  const StatusIcon = statusStyle.icon;
                  const isExpanded = expandedId === log.id;
                  return (
                    <>
                      <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{formatDate(log.created_at)}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          <div className="font-medium">{log.to_email}</div>
                          {log.cc_emails && log.cc_emails.length > 0 && (
                            <div className="text-xs text-gray-400 mt-0.5">CC: {log.cc_emails.join(', ')}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 max-w-xs">
                          <div className="truncate">{log.subject}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${statusStyle.bg} ${statusStyle.text}`}>
                            <StatusIcon className="w-3 h-3" />
                            {statusStyle.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">{log.triggered_by || '—'}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{SOURCE_LABELS[log.source || ''] || log.source || '—'}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex items-center gap-1">
                            {log.html_content && (
                              <button
                                onClick={() => setPreviewLog(log)}
                                className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                title="View email content"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              onClick={() => setExpandedId(isExpanded ? null : log.id)}
                              className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                              title="Toggle details"
                            >
                              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </button>
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="bg-gray-50">
                          <td colSpan={7} className="px-4 py-4">
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Email Type</p>
                                <p className="text-gray-700">{log.email_type || '—'}</p>
                              </div>
                              <div>
                                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Error Message</p>
                                <p className="text-red-600">{log.error_message || '—'}</p>
                              </div>
                              {log.cc_emails && log.cc_emails.length > 0 && (
                                <div className="col-span-2">
                                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">CC Recipients</p>
                                  <p className="text-gray-700">{log.cc_emails.join(', ')}</p>
                                </div>
                              )}
                              {log.html_content && (
                                <div className="col-span-2">
                                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Email Content Preview</p>
                                  <div className="mt-1 border border-gray-200 rounded-lg overflow-hidden bg-white max-h-48 overflow-y-auto">
                                    <iframe
                                      srcDoc={log.html_content}
                                      className="w-full h-48 border-0"
                                      sandbox="allow-same-origin"
                                      title="Email content preview"
                                    />
                                  </div>
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
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
            <button
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              <ChevronLeft className="w-4 h-4" /> Previous
            </button>
            <span className="text-sm text-gray-500">Page {page + 1} of {totalPages}</span>
            <button
              onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
              disabled={page >= totalPages - 1}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Full email preview modal */}
      {previewLog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={() => setPreviewLog(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-gray-900 truncate">{previewLog.subject}</h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  To: {previewLog.to_email}
                  {previewLog.cc_emails && previewLog.cc_emails.length > 0 && ` · CC: ${previewLog.cc_emails.join(', ')}`}
                </p>
              </div>
              <button
                onClick={() => setPreviewLog(null)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 py-3 border-b border-gray-100 flex flex-wrap gap-4 text-sm">
              <div>
                <span className="text-gray-400">Status: </span>
                <span className={`font-semibold ${previewLog.status === 'sent' ? 'text-green-600' : 'text-red-600'}`}>
                  {previewLog.status === 'sent' ? 'Sent' : 'Failed'}
                </span>
              </div>
              <div>
                <span className="text-gray-400">Triggered By: </span>
                <span className="font-medium text-gray-700">{previewLog.triggered_by || '—'}</span>
              </div>
              <div>
                <span className="text-gray-400">Functionality: </span>
                <span className="font-medium text-gray-700">{SOURCE_LABELS[previewLog.source || ''] || previewLog.source || '—'}</span>
              </div>
              <div>
                <span className="text-gray-400">Date: </span>
                <span className="font-medium text-gray-700">{formatDate(previewLog.created_at)}</span>
              </div>
            </div>
            {previewLog.error_message && (
              <div className="mx-6 mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-700"><span className="font-semibold">Error: </span>{previewLog.error_message}</p>
              </div>
            )}
            <div className="flex-1 overflow-y-auto p-6">
              {previewLog.html_content ? (
                <iframe
                  srcDoc={previewLog.html_content}
                  className="w-full h-full min-h-[400px] border border-gray-200 rounded-lg"
                  sandbox="allow-same-origin"
                  title="Email content"
                />
              ) : (
                <p className="text-gray-400 text-center py-8">No content available</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
