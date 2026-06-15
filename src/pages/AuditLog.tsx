import { useState, useEffect, useCallback, Fragment } from 'react';
import { Search, Download, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Power, Filter, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { invalidateAuditCache } from '../lib/auditLog';
import { AuditDiff } from '../components/AuditDiff';
import { useAuth } from '../contexts/AuthContext';

const PAGE_SIZE = 50;

const TABLE_LABELS: Record<string, string> = {
  transactions: 'Transactions',
  buy_sell_notes: 'Buy & Sell Notes',
  buy_sell_approvals: 'Buy & Sell Approvals',
  cash_balance_ledger: 'Cash Balance',
  dividends: 'Dividends',
  scrip_entries: 'Scrip Entries',
  shares: 'Shares',
  brokers: 'Brokers',
  banks: 'Banks',
  entities: 'Entities',
  entity_types: 'Entity Types',
  sector_types: 'Sector Types',
  industry_types: 'Industry Types',
  brokerage_fee_types: 'Brokerage Fee Types',
  daily_share_prices: 'Daily Prices',
  entity_share_opening_balances: 'Opening Balances',
  entity_brokers: 'Entity Brokers',
  app_users: 'Users',
};

const ACTION_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  CREATE: { bg: 'bg-green-100', text: 'text-green-800', label: 'Create' },
  UPDATE: { bg: 'bg-amber-100', text: 'text-amber-800', label: 'Update' },
  DELETE: { bg: 'bg-red-100', text: 'text-red-800', label: 'Delete' },
};

interface AuditEntry {
  id: string;
  table_name: string;
  record_id: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  performed_by: string;
  performed_at: string;
  old_values: Record<string, any> | null;
  new_values: Record<string, any> | null;
  changed_fields: string[] | null;
  entity_id: string | null;
  description: string | null;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
    ' ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function AuditLog() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const [auditEnabled, setAuditEnabled] = useState(true);
  const [toggling, setToggling] = useState(false);

  const [filterAction, setFilterAction] = useState('');
  const [filterTable, setFilterTable] = useState('');
  const [filterUser, setFilterUser] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [filterSearch, setFilterSearch] = useState('');
  const [filterEntity, setFilterEntity] = useState('');

  const [entities, setEntities] = useState<{ id: string; name: string }[]>([]);
  const [users, setUsers] = useState<string[]>([]);
  const [tables, setTables] = useState<string[]>([]);

  const loadSettings = useCallback(async () => {
    const { data } = await supabase.from('audit_settings').select('audit_enabled').limit(1).maybeSingle();
    if (data) setAuditEnabled(data.audit_enabled);
  }, []);

  const loadFilterOptions = useCallback(async () => {
    const [entRes, userRes, tableRes] = await Promise.all([
      supabase.from('entities').select('id, name').order('name'),
      supabase.from('audit_logs').select('performed_by'),
      supabase.from('audit_logs').select('table_name'),
    ]);
    setEntities(entRes.data || []);
    const uniqueUsers = [...new Set((userRes.data || []).map((r: any) => r.performed_by))].sort();
    setUsers(uniqueUsers);
    const uniqueTables = [...new Set((tableRes.data || []).map((r: any) => r.table_name))].sort();
    setTables(uniqueTables);
  }, []);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('audit_logs')
        .select('*', { count: 'exact' })
        .order('performed_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (filterAction) query = query.eq('action', filterAction);
      if (filterTable) query = query.eq('table_name', filterTable);
      if (filterUser) query = query.eq('performed_by', filterUser);
      if (filterEntity) query = query.eq('entity_id', filterEntity);
      if (filterDateFrom) query = query.gte('performed_at', filterDateFrom + 'T00:00:00');
      if (filterDateTo) query = query.lte('performed_at', filterDateTo + 'T23:59:59');
      if (filterSearch) query = query.or(`description.ilike.%${filterSearch}%,record_id.ilike.%${filterSearch}%`);

      const { data, count, error } = await query;
      if (error) throw error;
      setLogs(data || []);
      setTotalCount(count || 0);
    } catch (err) {
      console.error('Error loading audit logs:', err);
    } finally {
      setLoading(false);
    }
  }, [page, filterAction, filterTable, filterUser, filterEntity, filterDateFrom, filterDateTo, filterSearch]);

  useEffect(() => { loadSettings(); loadFilterOptions(); }, [loadSettings, loadFilterOptions]);
  useEffect(() => { loadLogs(); }, [loadLogs]);

  async function toggleAudit() {
    setToggling(true);
    try {
      const newVal = !auditEnabled;
      const { error } = await supabase
        .from('audit_settings')
        .update({ audit_enabled: newVal, updated_by: user?.email || 'admin', updated_at: new Date().toISOString() })
        .not('id', 'is', null);
      if (error) throw error;
      setAuditEnabled(newVal);
      invalidateAuditCache();
    } catch (err) {
      console.error('Error toggling audit:', err);
      alert('Failed to update audit setting');
    } finally {
      setToggling(false);
    }
  }

  function clearFilters() {
    setFilterAction('');
    setFilterTable('');
    setFilterUser('');
    setFilterDateFrom('');
    setFilterDateTo('');
    setFilterSearch('');
    setFilterEntity('');
    setPage(0);
  }

  const hasFilters = filterAction || filterTable || filterUser || filterDateFrom || filterDateTo || filterSearch || filterEntity;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  function handleExport() {
    const headers = ['Timestamp', 'User', 'Action', 'Module', 'Record ID', 'Description', 'Changed Fields'];
    const rows = logs.map(l => [
      l.performed_at,
      l.performed_by,
      l.action,
      TABLE_LABELS[l.table_name] || l.table_name,
      l.record_id,
      l.description || '',
      (l.changed_fields || []).join('; '),
    ]);
    const escape = (v: string) => (v.includes(',') || v.includes('"') ? `"${v.replace(/"/g, '""')}"` : v);
    const csv = [headers, ...rows].map(r => r.map(c => escape(String(c))).join(',')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit_trail_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Audit Trail</h1>
          <p className="text-gray-500 mt-1">Track all changes across the system</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={toggleAudit}
            disabled={toggling}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              auditEnabled
                ? 'bg-green-100 text-green-800 hover:bg-green-200'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <Power className="w-4 h-4" />
            Audit {auditEnabled ? 'ON' : 'OFF'}
          </button>
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

      {/* Filters panel */}
      {showFilters && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Action</label>
              <select value={filterAction} onChange={e => { setFilterAction(e.target.value); setPage(0); }} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white">
                <option value="">All Actions</option>
                <option value="CREATE">Create</option>
                <option value="UPDATE">Update</option>
                <option value="DELETE">Delete</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Module</label>
              <select value={filterTable} onChange={e => { setFilterTable(e.target.value); setPage(0); }} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white">
                <option value="">All Modules</option>
                {tables.map(t => (
                  <option key={t} value={t}>{TABLE_LABELS[t] || t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">User</label>
              <select value={filterUser} onChange={e => { setFilterUser(e.target.value); setPage(0); }} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white">
                <option value="">All Users</option>
                {users.map(u => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Entity</label>
              <select value={filterEntity} onChange={e => { setFilterEntity(e.target.value); setPage(0); }} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white">
                <option value="">All Entities</option>
                {entities.map(e => (
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
              </select>
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
              <label className="block text-xs font-medium text-gray-500 mb-1">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Description or Record ID..."
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

      {/* Summary */}
      <div className="flex items-center justify-between text-sm text-gray-500">
        <span>Showing {Math.min(logs.length, PAGE_SIZE)} of {totalCount.toLocaleString()} records</span>
        {!auditEnabled && (
          <span className="text-amber-600 font-medium">Audit logging is currently disabled</span>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <p className="text-lg font-medium">No audit records found</p>
            <p className="text-sm mt-1">Audit entries will appear here once changes are made</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="w-8" />
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Timestamp</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">User</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Action</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Module</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Description</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => {
                const style = ACTION_STYLES[log.action] || ACTION_STYLES.UPDATE;
                const isExpanded = expandedId === log.id;
                return (
                  <Fragment key={log.id}>
                    <tr
                      className={`border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors ${isExpanded ? 'bg-gray-50' : ''}`}
                      onClick={() => setExpandedId(isExpanded ? null : log.id)}
                    >
                      <td className="pl-3 pr-0">
                        {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                      </td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{formatDate(log.performed_at)}</td>
                      <td className="px-4 py-3 text-gray-700 max-w-[180px] truncate">{log.performed_by}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${style.bg} ${style.text}`}>
                          {style.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-700">{TABLE_LABELS[log.table_name] || log.table_name}</td>
                      <td className="px-4 py-3 text-gray-600 max-w-xs truncate">{log.description || '--'}</td>
                    </tr>
                    {isExpanded && (
                      <tr className="bg-gray-50">
                        <td colSpan={6} className="px-6 py-4">
                          <div className="max-w-4xl">
                            <div className="text-xs text-gray-400 mb-3">
                              Record ID: <span className="font-mono text-gray-600">{log.record_id}</span>
                              {log.entity_id && <span className="ml-4">Entity: <span className="font-mono text-gray-600">{log.entity_id}</span></span>}
                            </div>
                            <AuditDiff
                              action={log.action}
                              oldValues={log.old_values}
                              newValues={log.new_values}
                              changedFields={log.changed_fields}
                            />
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Page {page + 1} of {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              <ChevronLeft className="w-4 h-4" /> Previous
            </button>
            <button
              onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
              disabled={page >= totalPages - 1}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <p className="text-xs text-gray-400 text-center">Records older than 2 years are archived automatically</p>
    </div>
  );
}
