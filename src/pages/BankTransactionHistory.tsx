import { useState, useEffect } from 'react';
import { Search, TrendingUp, TrendingDown, Landmark, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '../lib/supabase';

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
  on_hold_amount: number | null;
}

const fmt = (v: number) =>
  v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtDate = (d: string | null) =>
  d ? new Date(d + 'T00:00:00').toLocaleDateString('en-GB') : '—';

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

      // Compute current balance = last running_balance for each bank
      const bankIds = (data || []).map((b: any) => b.id);
      let balanceMap = new Map<string, number>();

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
      const bank = banks.find(b => b.id === bankId);

      const [bankRes, entityRes] = await Promise.all([
        supabase
          .from('cash_balance_ledger')
          .select('id, date, type, description, code, amount, running_balance')
          .eq('bank_id', bankId)
          .order('date', { ascending: true }),
        bank
          ? supabase
              .from('cash_balance_ledger')
              .select('id, date, type, description, code, amount, running_balance')
              .eq('entity_id', bank.entity_id)
              .is('bank_id', null)
              .order('date', { ascending: true })
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (bankRes.error) throw bankRes.error;

      const allEntries = [
        ...(bankRes.data || []),
        ...(entityRes.data || []),
      ].sort((a, b) => {
        if (!a.date && !b.date) return 0;
        if (!a.date) return -1;
        if (!b.date) return 1;
        return a.date < b.date ? -1 : a.date > b.date ? 1 : 0;
      });

      setLedger(
        allEntries.map((r: any) => ({
          id: r.id,
          date: r.date,
          type: r.type,
          description: r.description,
          code: r.code,
          amount: Number(r.amount) || 0,
          running_balance: Number(r.running_balance) || 0,
          on_hold_amount: null,
        }))
      );
    } catch (err) {
      console.error(err);
    } finally {
      setLedgerLoading(false);
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

  const sortedLedger = sortAsc ? ledger : [...ledger].reverse();

  return (
    <div className="p-6 space-y-5">
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
          {/* Header row */}
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
                              {ledgerLoading ? (
                                <div className="flex items-center justify-center py-8">
                                  <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-blue-600" />
                                </div>
                              ) : ledger.length === 0 ? (
                                <div className="py-6 text-center text-gray-400 text-sm">No transactions recorded for this account.</div>
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
                                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Code</th>
                                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Description</th>
                                        <th className="px-3 py-2 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Type</th>
                                        <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Amount</th>
                                        <th className="pr-6 pl-3 py-2 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Running Balance</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {sortedLedger.map((entry, i) => {
                                        const isAdd = entry.type === 'Addition' || entry.type === 'addition';
                                        return (
                                          <tr
                                            key={entry.id}
                                            className={`border-b border-gray-100 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'} hover:bg-blue-50/30 transition-colors`}
                                          >
                                            <td className="pl-12 pr-3 py-2 text-gray-600">{fmtDate(entry.date)}</td>
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
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                    {/* Ledger footer */}
                                    <tfoot className="bg-gray-100 border-t-2 border-gray-200 text-xs font-bold">
                                      <tr>
                                        <td colSpan={4} className="pl-12 pr-3 py-2 text-gray-500 uppercase">
                                          {ledger.length} transaction{ledger.length !== 1 ? 's' : ''}
                                        </td>
                                        <td className="px-3 py-2 text-right font-mono text-gray-700">
                                          Net: <span className={
                                            ledger.reduce((s, r) => s + (r.type === 'Addition' || r.type === 'addition' ? r.amount : -r.amount), 0) >= 0
                                              ? 'text-green-700' : 'text-red-600'
                                          }>
                                            {fmt(ledger.reduce((s, r) => s + (r.type === 'Addition' || r.type === 'addition' ? r.amount : -r.amount), 0))}
                                          </span>
                                        </td>
                                        <td className="pr-6 pl-3 py-2 text-right font-mono">
                                          <span className={bank.current_balance >= 0 ? 'text-green-700' : 'text-red-600'}>
                                            Rs. {fmt(bank.current_balance)}
                                          </span>
                                        </td>
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

              {/* Grand total footer */}
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
