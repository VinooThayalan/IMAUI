import { Plus, Search, Filter, Wallet, TrendingUp, Calendar } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface Dividend {
  id: string;
  entity_id: string;
  share_id: string;
  dividend_date: string | null;
  quantity: number;
  gross_dividend_per_share: number;
  withholding_tax_rate: number;
  net_dividend_per_share: number;
  tax_withheld: number;
  amount_gross: number;
  amount_net: number;
  announcement_date: string | null;
  payment_date: string | null;
  effective_date: string | null;
  bank_name: string | null;
  bank_account_no: string | null;
  payment_method: string | null;
  cds_account: string | null;
  notes: string | null;
  status: string;
  created_at: string;
}

interface Entity {
  id: string;
  name: string;
}

interface Share {
  id: string;
  ticker: string;
  share_name: string;
}

interface Bank {
  id: string;
  name: string;
  account_number: string | null;
  entity_id: string;
}

interface EntityBroker {
  id: string;
  entity_id: string;
  relationship_type: string;
  custodian_account_number: string | null;
  broker_account_number: string | null;
}

const EMPTY_FORM = {
  entity_id: '',
  share_id: '',
  dividend_date: '',
  quantity: '',
  gross_dividend_per_share: '',
  withholding_tax_rate: '10',
  net_dividend_per_share: '',
  announcement_date: '',
  payment_date: '',
  effective_date: '',
  selected_bank_id: '',
  bank_name: '',
  bank_account_no: '',
  payment_method: '',
  cds_account: '',
  notes: '',
  status: 'Awaiting dividend',
};

export function Dividends() {
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dividends, setDividends] = useState<Dividend[]>([]);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [shares, setShares] = useState<Share[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [entityBrokers, setEntityBrokers] = useState<EntityBroker[]>([]);
  const [search, setSearch] = useState('');
  const [formData, setFormData] = useState({ ...EMPTY_FORM });

  useEffect(() => { loadData(); }, []);

  // Auto-calculate net_dividend_per_share when gross or WHT rate changes
  useEffect(() => {
    const gross = parseFloat(formData.gross_dividend_per_share) || 0;
    const rate = parseFloat(formData.withholding_tax_rate) || 0;
    const net = gross * (1 - rate / 100);
    setFormData(prev => ({
      ...prev,
      net_dividend_per_share: gross > 0 ? net.toFixed(4) : '',
    }));
  }, [formData.gross_dividend_per_share, formData.withholding_tax_rate]);

  async function loadData() {
    try {
      setLoading(true);
      const [dividendsRes, entitiesRes, sharesRes, banksRes, entityBrokersRes] = await Promise.all([
        supabase.from('dividends').select('*').order('created_at', { ascending: false }),
        supabase.from('entities').select('id, name').order('name'),
        supabase.from('shares').select('id, ticker, share_name').order('ticker'),
        supabase.from('banks').select('id, name, account_number, entity_id').order('name'),
        supabase.from('entity_brokers').select('id, entity_id, relationship_type, custodian_account_number, broker_account_number'),
      ]);
      if (dividendsRes.error) throw dividendsRes.error;
      if (entitiesRes.error) throw entitiesRes.error;
      if (sharesRes.error) throw sharesRes.error;
      setDividends(dividendsRes.data || []);
      setEntities(entitiesRes.data || []);
      setShares(sharesRes.data || []);
      setBanks(banksRes.data || []);
      setEntityBrokers(entityBrokersRes.data || []);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }

  function getEntityName(id: string) {
    return entities.find(e => e.id === id)?.name || '—';
  }

  function getShareTicker(id: string) {
    return shares.find(s => s.id === id)?.ticker || '—';
  }

  function formatDate(d: string | null) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const gross = parseFloat(formData.gross_dividend_per_share) || 0;
      const rate = parseFloat(formData.withholding_tax_rate) || 0;
      const net = gross * (1 - rate / 100);
      const qty = parseFloat(formData.quantity) || 0;

      const selectedBank = banks.find(b => b.id === formData.selected_bank_id);

      const { error } = await supabase.from('dividends').insert({
        entity_id: formData.entity_id,
        share_id: formData.share_id,
        dividend_date: formData.dividend_date || null,
        quantity: qty,
        gross_dividend_per_share: gross,
        withholding_tax_rate: rate,
        net_dividend_per_share: net,
        tax_withheld: (gross - net) * qty,
        amount_gross: gross * qty,
        amount_net: net * qty,
        announcement_date: formData.announcement_date || null,
        payment_date: formData.payment_date || null,
        effective_date: formData.effective_date || null,
        bank_name: selectedBank?.name || null,
        bank_account_no: selectedBank?.account_number || null,
        payment_method: formData.payment_method || null,
        cds_account: formData.cds_account || null,
        notes: formData.notes || null,
        status: formData.status,
      });
      if (error) throw error;
      setShowModal(false);
      setFormData({ ...EMPTY_FORM });
      loadData();
    } catch (error) {
      console.error('Error adding dividend:', error);
      alert('Failed to add dividend');
    }
  }

  const finalized = dividends.filter(d => d.status === 'Finalized');
  const totalNet = finalized.reduce((s, d) => s + (d.amount_net || 0), 0);
  const pendingCount = dividends.filter(d => d.status === 'Awaiting dividend' || d.status === 'Received').length;

  const filtered = dividends.filter(d => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      getEntityName(d.entity_id).toLowerCase().includes(q) ||
      getShareTicker(d.share_id).toLowerCase().includes(q) ||
      d.status.toLowerCase().includes(q)
    );
  });

  const statusStyle = (s: string) => {
    if (s === 'Finalized') return 'bg-green-100 text-green-800';
    if (s === 'Received') return 'bg-blue-100 text-blue-800';
    if (s === 'Awaiting dividend') return 'bg-amber-100 text-amber-800';
    return 'bg-gray-100 text-gray-600';
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dividends</h1>
          <p className="text-gray-500 mt-1">Track and manage dividend receipts</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          <span className="font-medium">Add Dividend</span>
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Total Finalized (Net)</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">
                Rs. {totalNet.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <div className="flex items-center mt-2">
                <TrendingUp className="w-4 h-4 text-green-600" />
                <span className="text-sm text-gray-500 ml-1">{finalized.length} finalized dividend(s)</span>
              </div>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <Wallet className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Pending Dividends</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">{pendingCount}</p>
              <p className="text-sm text-gray-500 mt-2">Awaiting or received</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <Calendar className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center space-x-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by entity, ticker or status..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
              <Filter className="w-5 h-5 text-gray-500" />
              <span className="font-medium text-gray-700">Filter</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Entity</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Ticker</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Quantity</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Gross/Share</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">WHT %</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Net/Share</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Net</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Dates</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Bank</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Payment</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={12} className="px-4 py-12 text-center">
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-4 py-12 text-center text-gray-500">
                    {search ? 'No dividends match your search.' : 'No dividends found. Add your first dividend to get started.'}
                  </td>
                </tr>
              ) : filtered.map(d => (
                <tr key={d.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-4 text-sm font-semibold text-gray-900">{getEntityName(d.entity_id)}</td>
                  <td className="px-4 py-4 text-sm font-bold text-blue-600 whitespace-nowrap">{getShareTicker(d.share_id)}</td>
                  <td className="px-4 py-4 text-sm text-gray-600 whitespace-nowrap">{formatDate(d.dividend_date)}</td>
                  <td className="px-4 py-4 text-sm text-gray-900 text-right whitespace-nowrap">{(d.quantity || 0).toLocaleString()}</td>
                  <td className="px-4 py-4 text-sm text-gray-900 text-right whitespace-nowrap">Rs. {(d.gross_dividend_per_share || 0).toFixed(4)}</td>
                  <td className="px-4 py-4 text-sm text-gray-900 text-right whitespace-nowrap">{(d.withholding_tax_rate || 0).toFixed(1)}%</td>
                  <td className="px-4 py-4 text-sm text-gray-900 text-right whitespace-nowrap">Rs. {(d.net_dividend_per_share || 0).toFixed(4)}</td>
                  <td className="px-4 py-4 text-sm font-semibold text-gray-900 text-right whitespace-nowrap">
                    Rs. {(d.amount_net || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="text-xs space-y-0.5 text-gray-500">
                      {d.announcement_date && <div>Ann: {formatDate(d.announcement_date)}</div>}
                      {d.effective_date && <div className="text-emerald-600 font-medium">Eff: {formatDate(d.effective_date)}</div>}
                      {d.payment_date && <div>Pay: {formatDate(d.payment_date)}</div>}
                    </div>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="text-xs space-y-0.5">
                      {d.bank_name && <div className="text-gray-900 font-medium">{d.bank_name}</div>}
                      {d.bank_account_no && <div className="text-gray-500">{d.bank_account_no}</div>}
                      {!d.bank_name && !d.bank_account_no && <span className="text-gray-400">—</span>}
                    </div>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="text-xs space-y-0.5">
                      {d.payment_method && <div className="text-gray-900">{d.payment_method}</div>}
                      {d.cds_account && <div className="text-gray-500">{d.cds_account}</div>}
                      {!d.payment_method && !d.cds_account && <span className="text-gray-400">—</span>}
                    </div>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${statusStyle(d.status)}`}>
                      {d.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Dividend Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto">
            <form onSubmit={handleSubmit}>
              {/* Modal Header */}
              <div className="p-6 border-b border-gray-200 sticky top-0 bg-white z-10">
                <h2 className="text-2xl font-bold text-gray-900">Add Dividend</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Fields in <span className="text-red-500 font-medium">red</span> are required.
                  Fields in <span className="text-emerald-600 font-medium">green</span> affect reports and cashflow.
                </p>
              </div>

              <div className="p-6 space-y-5">
                {/* Row 1: Entity */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Entity <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value={formData.entity_id}
                    onChange={e => setFormData({ ...formData, entity_id: e.target.value, selected_bank_id: '', cds_account: '' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  >
                    <option value="">Select entity...</option>
                    {entities.map(en => (
                      <option key={en.id} value={en.id}>{en.name}</option>
                    ))}
                  </select>
                </div>

                {/* Row 2: Ticker */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Ticker (Share) <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value={formData.share_id}
                    onChange={e => setFormData({ ...formData, share_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  >
                    <option value="">Select ticker...</option>
                    {shares.map(s => (
                      <option key={s.id} value={s.id}>{s.ticker} — {s.share_name}</option>
                    ))}
                  </select>
                </div>

                {/* Divider */}
                <div className="border-t border-gray-100 pt-1">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Dividend Calculation</p>
                </div>

                {/* Row 3: Quantity + Gross */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-red-600 mb-1.5">
                      Quantity <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      required
                      min="0"
                      step="1"
                      value={formData.quantity}
                      onChange={e => setFormData({ ...formData, quantity: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-red-600 mb-1.5">
                      Gross Dividend per Share <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      required
                      min="0"
                      step="0.0001"
                      value={formData.gross_dividend_per_share}
                      onChange={e => setFormData({ ...formData, gross_dividend_per_share: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      placeholder="0.0000"
                    />
                  </div>
                </div>

                {/* Row 4: WHT Rate + Net per Share (calculated) */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-red-600 mb-1.5">
                      Withholding Tax Rate (%) <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        required
                        min="0"
                        max="100"
                        step="0.01"
                        value={formData.withholding_tax_rate}
                        onChange={e => setFormData({ ...formData, withholding_tax_rate: e.target.value })}
                        className="w-full px-3 py-2 pr-8 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        placeholder="10"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">Automatically applies the rate</p>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-red-600 mb-1.5">
                      Net Dividend per Share
                    </label>
                    <input
                      type="number"
                      readOnly
                      value={formData.net_dividend_per_share}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-sm text-gray-700 cursor-not-allowed"
                      placeholder="Auto-calculated"
                    />
                    <p className="text-xs text-gray-400 mt-1">Calculates based on the quantity and rate</p>
                  </div>
                </div>

                {/* Divider */}
                <div className="border-t border-gray-100 pt-1">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Dates</p>
                </div>

                {/* Row 5: Announcement + Payment */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-red-600 mb-1.5">
                      Announcement Date <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      required
                      value={formData.announcement_date}
                      onChange={e => setFormData({ ...formData, announcement_date: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Payment Date</label>
                    <input
                      type="date"
                      value={formData.payment_date}
                      onChange={e => setFormData({ ...formData, payment_date: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                  </div>
                </div>

                {/* Row 6: Effective Date */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-emerald-600 mb-1.5">Effective Date</label>
                    <input
                      type="date"
                      value={formData.effective_date}
                      onChange={e => setFormData({ ...formData, effective_date: e.target.value })}
                      className="w-full px-3 py-2 border border-emerald-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400 text-sm"
                    />
                    <p className="text-xs text-gray-400 mt-1">Used in reports and cashflow</p>
                  </div>
                </div>

                {/* Divider */}
                <div className="border-t border-gray-100 pt-1">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Bank & Payment Details</p>
                </div>

                {/* Row 7: Bank Name dropdown + Bank Account No (auto) + CDS Account (auto) */}
                {(() => {
                  const entityBanks = formData.entity_id ? banks.filter(b => b.entity_id === formData.entity_id) : [];
                  const selectedBank = banks.find(b => b.id === formData.selected_bank_id);
                  const entityCdsAccounts = formData.entity_id
                    ? entityBrokers.filter(eb => eb.entity_id === formData.entity_id)
                    : [];
                  const firstCds = entityCdsAccounts[0];
                  const cdsValue = firstCds
                    ? (firstCds.relationship_type === 'Custodian'
                        ? firstCds.custodian_account_number
                        : firstCds.broker_account_number) || ''
                    : formData.cds_account;
                  return (
                    <>
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-semibold text-emerald-600 mb-1.5">Bank Name</label>
                          <select
                            value={formData.selected_bank_id}
                            onChange={e => setFormData({ ...formData, selected_bank_id: e.target.value })}
                            className="w-full px-3 py-2 border border-emerald-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400 text-sm"
                            disabled={!formData.entity_id}
                          >
                            <option value="">Select bank...</option>
                            {entityBanks.map(b => (
                              <option key={b.id} value={b.id}>{b.name}</option>
                            ))}
                          </select>
                          {!formData.entity_id && (
                            <p className="text-xs text-gray-400 mt-1">Select an entity first</p>
                          )}
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-1.5">Bank Account No.</label>
                          <input
                            type="text"
                            value={selectedBank?.account_number || ''}
                            readOnly
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-700 text-sm"
                            placeholder="Auto-filled on bank selection"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-emerald-600 mb-1.5">CDS Account</label>
                          <input
                            type="text"
                            value={cdsValue || ''}
                            readOnly={!!firstCds}
                            onChange={e => !firstCds && setFormData({ ...formData, cds_account: e.target.value })}
                            className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 ${firstCds ? 'border-gray-200 bg-gray-50 text-gray-700' : 'border-emerald-200'}`}
                            placeholder="e.g. CMB / SBL"
                          />
                          {firstCds && <p className="text-xs text-gray-400 mt-1">Auto-filled from account</p>}
                        </div>
                      </div>

                      {/* Row 8: Payment Method */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-semibold text-emerald-600 mb-1.5">Payment Method</label>
                          <select
                            value={formData.payment_method}
                            onChange={e => setFormData({ ...formData, payment_method: e.target.value })}
                            className="w-full px-3 py-2 border border-emerald-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400 text-sm"
                          >
                            <option value="">Select method...</option>
                            <option value="Cheque">Cheque</option>
                            <option value="Transfer (CEFT)">Transfer (CEFT)</option>
                          </select>
                        </div>
                      </div>
                    </>
                  );
                })()}

                {/* Divider */}
                <div className="border-t border-gray-100 pt-1">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Additional</p>
                </div>

                {/* Row 9: Notes + Status */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Notes</label>
                    <textarea
                      value={formData.notes}
                      onChange={e => setFormData({ ...formData, notes: e.target.value })}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm resize-none"
                      placeholder="Additional notes..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      Status <span className="text-gray-400 font-normal">(can be updated later)</span>
                    </label>
                    <select
                      value={formData.status}
                      onChange={e => setFormData({ ...formData, status: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    >
                      <option value="Awaiting dividend">Awaiting dividend</option>
                      <option value="Received">Received</option>
                      <option value="Finalized">Finalized</option>
                    </select>
                    <p className="text-xs text-gray-400 mt-1">Setting to Finalized updates cashflow</p>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-6 border-t border-gray-200 flex justify-end space-x-3 sticky bottom-0 bg-white">
                <button
                  type="button"
                  onClick={() => { setShowModal(false); setFormData({ ...EMPTY_FORM }); }}
                  className="px-5 py-2 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors text-sm"
                >
                  Submit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
