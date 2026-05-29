import React, { useState, useEffect } from 'react';
import { Activity, TrendingUp, BookOpen, DollarSign, Plus, Pencil, Trash2, Save } from 'lucide-react';
import { supabase } from '../lib/supabase';

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (v: number, d = 2) => v.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });

interface ShareInfo  { id: string; ticker: string; share_name: string; }
interface EntityInfo { id: string; name: string; }

// ── 52-Week Values Tab ────────────────────────────────────────────────────────

interface Week52Record {
  id: string;
  share_id: string;
  high_value: number;
  low_value: number;
  effective_date: string;
  notes: string | null;
  created_by: string;
}

function Week52Tab() {
  const [records, setRecords]     = useState<Week52Record[]>([]);
  const [shares, setShares]       = useState<ShareInfo[]>([]);
  const [loading, setLoading]     = useState(true);
  const [filterShare, setFilter]  = useState('');
  const [editId, setEditId]       = useState<string | null>(null);
  const [showForm, setShowForm]   = useState(false);
  const [saving, setSaving]       = useState(false);
  const [form, setForm] = useState({ share_id: '', high_value: '', low_value: '', effective_date: new Date().toISOString().split('T')[0], notes: '' });

  async function load() {
    setLoading(true);
    const [recs, shs] = await Promise.all([
      supabase.from('share_52week_values').select('*').order('effective_date', { ascending: false }),
      supabase.from('shares').select('id, ticker, share_name').order('ticker'),
    ]);
    setRecords(recs.data || []);
    setShares(shs.data || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function startEdit(r: Week52Record) {
    setEditId(r.id);
    setForm({ share_id: r.share_id, high_value: String(r.high_value), low_value: String(r.low_value), effective_date: r.effective_date, notes: r.notes || '' });
    setShowForm(true);
  }

  function startNew() {
    setEditId(null);
    setForm({ share_id: '', high_value: '', low_value: '', effective_date: new Date().toISOString().split('T')[0], notes: '' });
    setShowForm(true);
  }

  async function save() {
    if (!form.share_id || !form.high_value || !form.low_value || !form.effective_date) return alert('Fill all required fields');
    setSaving(true);
    const payload = { share_id: form.share_id, high_value: Number(form.high_value), low_value: Number(form.low_value), effective_date: form.effective_date, notes: form.notes || null, created_by: 'User' };
    if (editId) {
      await supabase.from('share_52week_values').update(payload).eq('id', editId);
    } else {
      await supabase.from('share_52week_values').insert(payload);
    }
    setSaving(false);
    setShowForm(false);
    setEditId(null);
    load();
  }

  async function del(id: string) {
    if (!confirm('Delete this record?')) return;
    await supabase.from('share_52week_values').delete().eq('id', id);
    load();
  }

  const shareMap = new Map(shares.map(s => [s.id, s]));
  const filtered = records.filter(r => !filterShare || r.share_id === filterShare);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <select value={filterShare} onChange={e => setFilter(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">All Shares</option>
            {shares.map(s => <option key={s.id} value={s.id}>{s.ticker} — {s.share_name}</option>)}
          </select>
        </div>
        <button onClick={startNew} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors">
          <Plus className="w-4 h-4" /> Add Record
        </button>
      </div>

      {showForm && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
          <h3 className="text-sm font-bold text-blue-900 mb-4">{editId ? 'Edit' : 'New'} 52-Week Record</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-3">
              <label className="block text-xs font-semibold text-gray-600 mb-1">Share <span className="text-red-500">*</span></label>
              <select value={form.share_id} onChange={e => setForm({...form, share_id: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Select share...</option>
                {shares.map(s => <option key={s.id} value={s.id}>{s.ticker} — {s.share_name}</option>)}
              </select>
            </div>
            {[['high_value','52-Week High','number'],['low_value','52-Week Low','number'],['effective_date','Effective Date','date']].map(([field, label, type]) => (
              <div key={field}>
                <label className="block text-xs font-semibold text-gray-600 mb-1">{label} <span className="text-red-500">*</span></label>
                <input type={type} step="0.01" value={form[field as keyof typeof form]} onChange={e => setForm({...form, [field]: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            ))}
            <div className="sm:col-span-3">
              <label className="block text-xs font-semibold text-gray-600 mb-1">Notes</label>
              <input type="text" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Optional notes..." />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={save} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">
              <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save'}
            </button>
            <button onClick={() => { setShowForm(false); setEditId(null); }} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200">Cancel</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-32"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Share','Effective Date','52-Week High','52-Week Low','Range','Notes',''].map(h => (
                  <th key={h} className={`px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide ${['Share','Effective Date','Notes',''].includes(h) ? 'text-left' : 'text-right'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400 text-sm">No records found</td></tr>
              ) : filtered.map(r => {
                const s = shareMap.get(r.share_id);
                const range = r.high_value - r.low_value;
                return (
                  <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-gray-900">{s?.ticker || '—'}</div>
                      <div className="text-xs text-gray-400">{s?.share_name || '—'}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{r.effective_date ? new Date(r.effective_date + 'T00:00:00').toLocaleDateString('en-GB') : '—'}</td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-green-700">Rs. {fmt(r.high_value)}</td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-red-600">Rs. {fmt(r.low_value)}</td>
                    <td className="px-4 py-3 text-right font-mono text-gray-600">Rs. {fmt(range)}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs max-w-xs truncate">{r.notes || '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => startEdit(r)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                        <button onClick={() => del(r.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Share Earnings Tab ────────────────────────────────────────────────────────

interface EarningsRecord {
  id: string;
  entity_id: string;
  share_id: string;
  effective_date: string;
  earnings_per_share: number;
  price_earning_ratio: number;
  notes: string | null;
  created_by: string;
}

function EarningsTab() {
  const [records, setRecords]   = useState<EarningsRecord[]>([]);
  const [shares, setShares]     = useState<ShareInfo[]>([]);
  const [entities, setEntities] = useState<EntityInfo[]>([]);
  const [loading, setLoading]   = useState(true);
  const [filterShare, setFilterShare] = useState('');
  const [filterEntity, setFilterEntity] = useState('');
  const [editId, setEditId]     = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving]     = useState(false);
  const [form, setForm] = useState({ entity_id: '', share_id: '', effective_date: new Date().toISOString().split('T')[0], earnings_per_share: '', price_earning_ratio: '', notes: '' });

  async function load() {
    setLoading(true);
    const [recs, shs, ents] = await Promise.all([
      supabase.from('share_earnings').select('*').order('effective_date', { ascending: false }),
      supabase.from('shares').select('id, ticker, share_name').order('ticker'),
      supabase.from('entities').select('id, name').order('name'),
    ]);
    setRecords(recs.data || []);
    setShares(shs.data || []);
    setEntities(ents.data || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function startEdit(r: EarningsRecord) {
    setEditId(r.id);
    setForm({ entity_id: r.entity_id, share_id: r.share_id, effective_date: r.effective_date, earnings_per_share: String(r.earnings_per_share), price_earning_ratio: String(r.price_earning_ratio), notes: r.notes || '' });
    setShowForm(true);
  }

  function startNew() {
    setEditId(null);
    setForm({ entity_id: '', share_id: '', effective_date: new Date().toISOString().split('T')[0], earnings_per_share: '', price_earning_ratio: '', notes: '' });
    setShowForm(true);
  }

  async function save() {
    if (!form.entity_id || !form.share_id || !form.earnings_per_share || !form.price_earning_ratio) return alert('Fill all required fields');
    setSaving(true);
    const payload = { entity_id: form.entity_id, share_id: form.share_id, effective_date: form.effective_date, earnings_per_share: Number(form.earnings_per_share), price_earning_ratio: Number(form.price_earning_ratio), notes: form.notes || null, created_by: 'User' };
    if (editId) {
      await supabase.from('share_earnings').update(payload).eq('id', editId);
    } else {
      await supabase.from('share_earnings').insert(payload);
    }
    setSaving(false);
    setShowForm(false);
    setEditId(null);
    load();
  }

  async function del(id: string) {
    if (!confirm('Delete this record?')) return;
    await supabase.from('share_earnings').delete().eq('id', id);
    load();
  }

  const shareMap  = new Map(shares.map(s => [s.id, s]));
  const entityMap = new Map(entities.map(e => [e.id, e]));
  const filtered  = records.filter(r => (!filterShare || r.share_id === filterShare) && (!filterEntity || r.entity_id === filterEntity));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <select value={filterEntity} onChange={e => setFilterEntity(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">All Entities</option>
            {entities.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
          <select value={filterShare} onChange={e => setFilterShare(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">All Shares</option>
            {shares.map(s => <option key={s.id} value={s.id}>{s.ticker} — {s.share_name}</option>)}
          </select>
        </div>
        <button onClick={startNew} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors">
          <Plus className="w-4 h-4" /> Add Record
        </button>
      </div>

      {showForm && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
          <h3 className="text-sm font-bold text-blue-900 mb-4">{editId ? 'Edit' : 'New'} Earnings Record</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Entity <span className="text-red-500">*</span></label>
              <select value={form.entity_id} onChange={e => setForm({...form, entity_id: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Select entity...</option>
                {entities.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Share <span className="text-red-500">*</span></label>
              <select value={form.share_id} onChange={e => setForm({...form, share_id: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Select share...</option>
                {shares.map(s => <option key={s.id} value={s.id}>{s.ticker} — {s.share_name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Effective Date <span className="text-red-500">*</span></label>
              <input type="date" value={form.effective_date} onChange={e => setForm({...form, effective_date: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Earnings Per Share (EPS) <span className="text-red-500">*</span></label>
              <input type="number" step="0.0001" value={form.earnings_per_share} onChange={e => setForm({...form, earnings_per_share: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">P/E Ratio <span className="text-red-500">*</span></label>
              <input type="number" step="0.0001" value={form.price_earning_ratio} onChange={e => setForm({...form, price_earning_ratio: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Notes</label>
              <input type="text" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Optional..." />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={save} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">
              <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save'}
            </button>
            <button onClick={() => { setShowForm(false); setEditId(null); }} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200">Cancel</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-32"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Entity','Share','Effective Date','EPS','P/E Ratio','Notes',''].map(h => (
                  <th key={h} className={`px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide ${['Entity','Share','Effective Date','Notes',''].includes(h) ? 'text-left' : 'text-right'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400 text-sm">No records found</td></tr>
              ) : filtered.map(r => {
                const s = shareMap.get(r.share_id);
                const e = entityMap.get(r.entity_id);
                return (
                  <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-700 font-medium">{e?.name || '—'}</td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-gray-900">{s?.ticker || '—'}</div>
                      <div className="text-xs text-gray-400">{s?.share_name || '—'}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{r.effective_date ? new Date(r.effective_date + 'T00:00:00').toLocaleDateString('en-GB') : '—'}</td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-blue-700">Rs. {fmt(r.earnings_per_share, 4)}</td>
                    <td className="px-4 py-3 text-right font-mono text-gray-700">{fmt(r.price_earning_ratio, 2)}x</td>
                    <td className="px-4 py-3 text-gray-400 text-xs max-w-xs truncate">{r.notes || '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => startEdit(r)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                        <button onClick={() => del(r.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Share Values Tab ──────────────────────────────────────────────────────────

interface ShareValueRecord {
  id: string;
  entity_id: string;
  share_id: string;
  effective_date: string;
  netbook_value_per_share: number;
  price_to_book_ratio: number;
  notes: string | null;
  created_by: string;
}

function ShareValuesTab() {
  const [records, setRecords]   = useState<ShareValueRecord[]>([]);
  const [shares, setShares]     = useState<ShareInfo[]>([]);
  const [entities, setEntities] = useState<EntityInfo[]>([]);
  const [loading, setLoading]   = useState(true);
  const [filterShare, setFilterShare] = useState('');
  const [filterEntity, setFilterEntity] = useState('');
  const [editId, setEditId]     = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving]     = useState(false);
  const [form, setForm] = useState({ entity_id: '', share_id: '', effective_date: new Date().toISOString().split('T')[0], netbook_value_per_share: '', price_to_book_ratio: '', notes: '' });

  async function load() {
    setLoading(true);
    const [recs, shs, ents] = await Promise.all([
      supabase.from('share_values').select('*').order('effective_date', { ascending: false }),
      supabase.from('shares').select('id, ticker, share_name').order('ticker'),
      supabase.from('entities').select('id, name').order('name'),
    ]);
    setRecords(recs.data || []);
    setShares(shs.data || []);
    setEntities(ents.data || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function startEdit(r: ShareValueRecord) {
    setEditId(r.id);
    setForm({ entity_id: r.entity_id, share_id: r.share_id, effective_date: r.effective_date, netbook_value_per_share: String(r.netbook_value_per_share), price_to_book_ratio: String(r.price_to_book_ratio), notes: r.notes || '' });
    setShowForm(true);
  }

  function startNew() {
    setEditId(null);
    setForm({ entity_id: '', share_id: '', effective_date: new Date().toISOString().split('T')[0], netbook_value_per_share: '', price_to_book_ratio: '', notes: '' });
    setShowForm(true);
  }

  async function save() {
    if (!form.entity_id || !form.share_id || !form.netbook_value_per_share || !form.price_to_book_ratio) return alert('Fill all required fields');
    setSaving(true);
    const payload = { entity_id: form.entity_id, share_id: form.share_id, effective_date: form.effective_date, netbook_value_per_share: Number(form.netbook_value_per_share), price_to_book_ratio: Number(form.price_to_book_ratio), notes: form.notes || null, created_by: 'User' };
    if (editId) {
      await supabase.from('share_values').update(payload).eq('id', editId);
    } else {
      await supabase.from('share_values').insert(payload);
    }
    setSaving(false);
    setShowForm(false);
    setEditId(null);
    load();
  }

  async function del(id: string) {
    if (!confirm('Delete this record?')) return;
    await supabase.from('share_values').delete().eq('id', id);
    load();
  }

  const shareMap  = new Map(shares.map(s => [s.id, s]));
  const entityMap = new Map(entities.map(e => [e.id, e]));
  const filtered  = records.filter(r => (!filterShare || r.share_id === filterShare) && (!filterEntity || r.entity_id === filterEntity));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <select value={filterEntity} onChange={e => setFilterEntity(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">All Entities</option>
            {entities.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
          <select value={filterShare} onChange={e => setFilterShare(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">All Shares</option>
            {shares.map(s => <option key={s.id} value={s.id}>{s.ticker} — {s.share_name}</option>)}
          </select>
        </div>
        <button onClick={startNew} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors">
          <Plus className="w-4 h-4" /> Add Record
        </button>
      </div>

      {showForm && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
          <h3 className="text-sm font-bold text-blue-900 mb-4">{editId ? 'Edit' : 'New'} Share Value Record</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Entity <span className="text-red-500">*</span></label>
              <select value={form.entity_id} onChange={e => setForm({...form, entity_id: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Select entity...</option>
                {entities.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Share <span className="text-red-500">*</span></label>
              <select value={form.share_id} onChange={e => setForm({...form, share_id: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Select share...</option>
                {shares.map(s => <option key={s.id} value={s.id}>{s.ticker} — {s.share_name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Effective Date <span className="text-red-500">*</span></label>
              <input type="date" value={form.effective_date} onChange={e => setForm({...form, effective_date: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Net Book Value / Share <span className="text-red-500">*</span></label>
              <input type="number" step="0.0001" value={form.netbook_value_per_share} onChange={e => setForm({...form, netbook_value_per_share: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Price to Book (P/B) Ratio <span className="text-red-500">*</span></label>
              <input type="number" step="0.0001" value={form.price_to_book_ratio} onChange={e => setForm({...form, price_to_book_ratio: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Notes</label>
              <input type="text" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Optional..." />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={save} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">
              <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save'}
            </button>
            <button onClick={() => { setShowForm(false); setEditId(null); }} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200">Cancel</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-32"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Entity','Share','Effective Date','Net Book Value / Share','P/B Ratio','Notes',''].map(h => (
                  <th key={h} className={`px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide ${['Entity','Share','Effective Date','Notes',''].includes(h) ? 'text-left' : 'text-right'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400 text-sm">No records found</td></tr>
              ) : filtered.map(r => {
                const s = shareMap.get(r.share_id);
                const e = entityMap.get(r.entity_id);
                return (
                  <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-700 font-medium">{e?.name || '—'}</td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-gray-900">{s?.ticker || '—'}</div>
                      <div className="text-xs text-gray-400">{s?.share_name || '—'}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{r.effective_date ? new Date(r.effective_date + 'T00:00:00').toLocaleDateString('en-GB') : '—'}</td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-blue-700">Rs. {fmt(r.netbook_value_per_share, 4)}</td>
                    <td className="px-4 py-3 text-right font-mono text-gray-700">{fmt(r.price_to_book_ratio, 2)}x</td>
                    <td className="px-4 py-3 text-gray-400 text-xs max-w-xs truncate">{r.notes || '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => startEdit(r)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                        <button onClick={() => del(r.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Dividends Per Share Tab ───────────────────────────────────────────────────

interface DpsRecord {
  id: string;
  entity_id: string;
  share_id: string;
  effective_date: string;
  dividend_per_share_gross: number;
  dividend_per_share_net: number;
  dividend_yield: number;
  notes: string | null;
  created_by: string;
}

function DividendsPerShareTab() {
  const [records, setRecords]   = useState<DpsRecord[]>([]);
  const [shares, setShares]     = useState<ShareInfo[]>([]);
  const [entities, setEntities] = useState<EntityInfo[]>([]);
  const [loading, setLoading]   = useState(true);
  const [filterShare, setFilterShare] = useState('');
  const [filterEntity, setFilterEntity] = useState('');
  const [editId, setEditId]     = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving]     = useState(false);
  const [form, setForm] = useState({ entity_id: '', share_id: '', effective_date: new Date().toISOString().split('T')[0], dividend_per_share_gross: '', dividend_per_share_net: '', dividend_yield: '', notes: '' });

  async function load() {
    setLoading(true);
    const [recs, shs, ents] = await Promise.all([
      supabase.from('share_dividends_per_share').select('*').order('effective_date', { ascending: false }),
      supabase.from('shares').select('id, ticker, share_name').order('ticker'),
      supabase.from('entities').select('id, name').order('name'),
    ]);
    setRecords(recs.data || []);
    setShares(shs.data || []);
    setEntities(ents.data || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function startEdit(r: DpsRecord) {
    setEditId(r.id);
    setForm({ entity_id: r.entity_id, share_id: r.share_id, effective_date: r.effective_date, dividend_per_share_gross: String(r.dividend_per_share_gross), dividend_per_share_net: String(r.dividend_per_share_net), dividend_yield: String(r.dividend_yield), notes: r.notes || '' });
    setShowForm(true);
  }

  function startNew() {
    setEditId(null);
    setForm({ entity_id: '', share_id: '', effective_date: new Date().toISOString().split('T')[0], dividend_per_share_gross: '', dividend_per_share_net: '', dividend_yield: '', notes: '' });
    setShowForm(true);
  }

  async function save() {
    if (!form.entity_id || !form.share_id || !form.dividend_per_share_gross || !form.dividend_per_share_net) return alert('Fill all required fields');
    setSaving(true);
    const payload = { entity_id: form.entity_id, share_id: form.share_id, effective_date: form.effective_date, dividend_per_share_gross: Number(form.dividend_per_share_gross), dividend_per_share_net: Number(form.dividend_per_share_net), dividend_yield: Number(form.dividend_yield) || 0, notes: form.notes || null, created_by: 'User' };
    if (editId) {
      await supabase.from('share_dividends_per_share').update(payload).eq('id', editId);
    } else {
      await supabase.from('share_dividends_per_share').insert(payload);
    }
    setSaving(false);
    setShowForm(false);
    setEditId(null);
    load();
  }

  async function del(id: string) {
    if (!confirm('Delete this record?')) return;
    await supabase.from('share_dividends_per_share').delete().eq('id', id);
    load();
  }

  const shareMap  = new Map(shares.map(s => [s.id, s]));
  const entityMap = new Map(entities.map(e => [e.id, e]));
  const filtered  = records.filter(r => (!filterShare || r.share_id === filterShare) && (!filterEntity || r.entity_id === filterEntity));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <select value={filterEntity} onChange={e => setFilterEntity(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">All Entities</option>
            {entities.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
          <select value={filterShare} onChange={e => setFilterShare(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">All Shares</option>
            {shares.map(s => <option key={s.id} value={s.id}>{s.ticker} — {s.share_name}</option>)}
          </select>
        </div>
        <button onClick={startNew} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors">
          <Plus className="w-4 h-4" /> Add Record
        </button>
      </div>

      {showForm && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
          <h3 className="text-sm font-bold text-blue-900 mb-4">{editId ? 'Edit' : 'New'} Dividends Per Share Record</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Entity <span className="text-red-500">*</span></label>
              <select value={form.entity_id} onChange={e => setForm({...form, entity_id: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Select entity...</option>
                {entities.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Share <span className="text-red-500">*</span></label>
              <select value={form.share_id} onChange={e => setForm({...form, share_id: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Select share...</option>
                {shares.map(s => <option key={s.id} value={s.id}>{s.ticker} — {s.share_name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Effective Date <span className="text-red-500">*</span></label>
              <input type="date" value={form.effective_date} onChange={e => setForm({...form, effective_date: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">DPS Gross <span className="text-red-500">*</span></label>
              <input type="number" step="0.0001" value={form.dividend_per_share_gross} onChange={e => setForm({...form, dividend_per_share_gross: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">DPS Net <span className="text-red-500">*</span></label>
              <input type="number" step="0.0001" value={form.dividend_per_share_net} onChange={e => setForm({...form, dividend_per_share_net: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Dividend Yield (%)</label>
              <input type="number" step="0.0001" value={form.dividend_yield} onChange={e => setForm({...form, dividend_yield: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="sm:col-span-3">
              <label className="block text-xs font-semibold text-gray-600 mb-1">Notes</label>
              <input type="text" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Optional..." />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={save} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">
              <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save'}
            </button>
            <button onClick={() => { setShowForm(false); setEditId(null); }} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200">Cancel</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-32"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Entity','Share','Effective Date','DPS Gross','DPS Net','Yield','Notes',''].map(h => (
                  <th key={h} className={`px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide ${['Entity','Share','Effective Date','Notes',''].includes(h) ? 'text-left' : 'text-right'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400 text-sm">No records found</td></tr>
              ) : filtered.map(r => {
                const s = shareMap.get(r.share_id);
                const e = entityMap.get(r.entity_id);
                return (
                  <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-700 font-medium">{e?.name || '—'}</td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-gray-900">{s?.ticker || '—'}</div>
                      <div className="text-xs text-gray-400">{s?.share_name || '—'}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{r.effective_date ? new Date(r.effective_date + 'T00:00:00').toLocaleDateString('en-GB') : '—'}</td>
                    <td className="px-4 py-3 text-right font-mono text-gray-700">Rs. {fmt(r.dividend_per_share_gross, 4)}</td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-yellow-700">Rs. {fmt(r.dividend_per_share_net, 4)}</td>
                    <td className="px-4 py-3 text-right font-mono text-green-700">{fmt(r.dividend_yield, 2)}%</td>
                    <td className="px-4 py-3 text-gray-400 text-xs max-w-xs truncate">{r.notes || '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => startEdit(r)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                        <button onClick={() => del(r.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

type Tab = '52week' | 'earnings' | 'share-values' | 'dps';

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: '52week',       label: '52-Week Values',      icon: <Activity className="w-4 h-4" /> },
  { id: 'earnings',     label: 'Share Earnings',      icon: <TrendingUp className="w-4 h-4" /> },
  { id: 'share-values', label: 'Net Book Value',        icon: <BookOpen className="w-4 h-4" /> },
  { id: 'dps',          label: 'Dividends Per Share',  icon: <DollarSign className="w-4 h-4" /> },
];

export function ShareSpecificValues() {
  const [activeTab, setActiveTab] = useState<Tab>('52week');

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Share Specific Values</h1>
        <p className="text-gray-500 mt-1">52-week ranges, earnings, book values and dividends per share.</p>
      </div>

      {/* Tab bar */}
      <div className="bg-white rounded-xl border border-gray-200 p-1 flex flex-wrap gap-1">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
              activeTab === tab.id
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === '52week'       && <Week52Tab />}
      {activeTab === 'earnings'     && <EarningsTab />}
      {activeTab === 'share-values' && <ShareValuesTab />}
      {activeTab === 'dps'          && <DividendsPerShareTab />}
    </div>
  );
}
