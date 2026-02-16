import { Plus, Search, Filter, Wallet, TrendingUp, Calendar } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface Dividend {
  id: string;
  entity_id: string;
  share_id: string;
  quantity: number;
  gross_dividend_per_share: number;
  net_dividend_per_share: number;
  tax_withheld: number;
  amount_gross: number;
  amount_net: number;
  announcement_date: string | null;
  effective_date: string | null;
  payment_date: string;
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
  name: string;
}

export function Dividends() {
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dividends, setDividends] = useState<Dividend[]>([]);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [shares, setShares] = useState<Share[]>([]);
  const [formData, setFormData] = useState({
    entity_id: '',
    share_id: '',
    quantity: '',
    gross_dividend_per_share: '',
    net_dividend_per_share: '',
    tax_withheld: '',
    announcement_date: '',
    effective_date: '',
    payment_date: '',
    payment_method: '',
    cds_account: '',
    notes: '',
    status: 'Pending'
  });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const [dividendsRes, entitiesRes, sharesRes] = await Promise.all([
        supabase.from('dividends').select('*').order('payment_date', { ascending: false }),
        supabase.from('entities').select('id, name').order('name'),
        supabase.from('shares').select('id, ticker, name').order('ticker')
      ]);

      if (dividendsRes.error) throw dividendsRes.error;
      if (entitiesRes.error) throw entitiesRes.error;
      if (sharesRes.error) throw sharesRes.error;

      setDividends(dividendsRes.data || []);
      setEntities(entitiesRes.data || []);
      setShares(sharesRes.data || []);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }

  function getEntityName(entityId: string) {
    return entities.find(e => e.id === entityId)?.name || 'Unknown';
  }

  function getShareTicker(shareId: string) {
    return shares.find(s => s.id === shareId)?.ticker || 'Unknown';
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const amount_gross = Number(formData.quantity) * Number(formData.gross_dividend_per_share);
      const amount_net = Number(formData.quantity) * Number(formData.net_dividend_per_share);
      const tax_withheld = amount_gross - amount_net;

      const { error } = await supabase.from('dividends').insert({
        entity_id: formData.entity_id,
        share_id: formData.share_id,
        quantity: Number(formData.quantity),
        gross_dividend_per_share: Number(formData.gross_dividend_per_share),
        net_dividend_per_share: Number(formData.net_dividend_per_share),
        tax_withheld,
        amount_gross,
        amount_net,
        announcement_date: formData.announcement_date || null,
        effective_date: formData.effective_date || null,
        payment_date: formData.payment_date,
        payment_method: formData.payment_method || null,
        cds_account: formData.cds_account || null,
        notes: formData.notes || null,
        status: formData.status
      });

      if (error) throw error;

      setShowModal(false);
      setFormData({
        entity_id: '',
        share_id: '',
        quantity: '',
        gross_dividend_per_share: '',
        net_dividend_per_share: '',
        tax_withheld: '',
        announcement_date: '',
        effective_date: '',
        payment_date: '',
        payment_method: '',
        cds_account: '',
        notes: '',
        status: 'Pending'
      });
      loadData();
    } catch (error) {
      console.error('Error adding dividend:', error);
      alert('Failed to add dividend');
    }
  }

  const totalDividends = dividends
    .filter(d => d.status === 'Paid')
    .reduce((sum, d) => sum + (d.amount_net || 0), 0);

  const scheduledCount = dividends.filter(d => d.status === 'Pending' || d.status === 'Processing').length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dividends</h1>
          <p className="text-gray-500 mt-1">Track dividend payments</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          <span className="font-medium">Add Dividend</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Total Dividends (YTD)</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">Rs. {totalDividends.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              <div className="flex items-center mt-2">
                <TrendingUp className="w-4 h-4 text-green-600" />
                <span className="text-sm font-medium text-green-600 ml-1">+12.5%</span>
                <span className="text-sm text-gray-500 ml-1">vs last year</span>
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
              <p className="text-sm font-medium text-gray-500">Scheduled Payments</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">{scheduledCount}</p>
              <p className="text-sm text-gray-500 mt-2">Pending or processing</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <Calendar className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center space-x-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search dividends..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Entity</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Ticker</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Quantity</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Gross/Share</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Net/Share</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">W. Tax</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Net</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Dates</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Payment Method</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">CDS Account</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan={11} className="px-6 py-12 text-center">
                      <div className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                      </div>
                    </td>
                  </tr>
                ) : dividends.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-6 py-12 text-center text-gray-500">
                      No dividends found. Add your first dividend to get started.
                    </td>
                  </tr>
                ) : (
                  dividends.map((dividend) => (
                    <tr key={dividend.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div>
                          <div className="text-sm font-bold text-gray-900">{getEntityName(dividend.entity_id)}</div>
                          {dividend.notes && (
                            <div className="text-xs text-gray-500 mt-1">{dividend.notes.substring(0, 50)}{dividend.notes.length > 50 ? '...' : ''}</div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-blue-600">{getShareTicker(dividend.share_id)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{dividend.quantity?.toLocaleString() || 0}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">Rs. {dividend.gross_dividend_per_share?.toFixed(2) || '0.00'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">Rs. {dividend.net_dividend_per_share?.toFixed(2) || '0.00'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">Rs. {dividend.tax_withheld?.toFixed(2) || '0.00'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">Rs. {dividend.amount_net?.toFixed(2) || '0.00'}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-xs space-y-1">
                          {dividend.announcement_date && (
                            <div className="text-gray-500">Ann: {dividend.announcement_date}</div>
                          )}
                          {dividend.effective_date && (
                            <div className="text-gray-500">Eff: {dividend.effective_date}</div>
                          )}
                          {dividend.payment_date && (
                            <div className="text-gray-500">Pay: {dividend.payment_date}</div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{dividend.payment_method || '-'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{dividend.cds_account || '-'}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          dividend.status === 'Paid' ? 'bg-green-100 text-green-800' :
                          dividend.status === 'Pending' ? 'bg-yellow-100 text-yellow-800' :
                          dividend.status === 'Processing' ? 'bg-blue-100 text-blue-800' :
                          dividend.status === 'Cancelled' ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {dividend.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <form onSubmit={handleSubmit}>
              <div className="p-6 border-b border-gray-200 sticky top-0 bg-white">
                <h2 className="text-2xl font-bold text-gray-900">Add Dividend</h2>
              </div>
              <div className="p-6 space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div className="col-span-2">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Entity *</label>
                    <select
                      required
                      value={formData.entity_id}
                      onChange={(e) => setFormData({...formData, entity_id: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select an entity</option>
                      {entities.map((entity) => (
                        <option key={entity.id} value={entity.id}>
                          {entity.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Ticker *</label>
                    <select
                      required
                      value={formData.share_id}
                      onChange={(e) => setFormData({...formData, share_id: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select a ticker</option>
                      {shares.map((share) => (
                        <option key={share.id} value={share.id}>
                          {share.ticker} - {share.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Quantity *</label>
                    <input
                      type="number"
                      required
                      step="1"
                      value={formData.quantity}
                      onChange={(e) => setFormData({...formData, quantity: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Gross Dividend per Share *</label>
                    <input
                      type="number"
                      required
                      step="0.01"
                      value={formData.gross_dividend_per_share}
                      onChange={(e) => setFormData({...formData, gross_dividend_per_share: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Net Dividend per Share *</label>
                    <input
                      type="number"
                      required
                      step="0.01"
                      value={formData.net_dividend_per_share}
                      onChange={(e) => setFormData({...formData, net_dividend_per_share: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Announcement Date</label>
                    <input
                      type="date"
                      value={formData.announcement_date}
                      onChange={(e) => setFormData({...formData, announcement_date: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Effective Date</label>
                    <input
                      type="date"
                      value={formData.effective_date}
                      onChange={(e) => setFormData({...formData, effective_date: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Payment Date *</label>
                    <input
                      type="date"
                      required
                      value={formData.payment_date}
                      onChange={(e) => setFormData({...formData, payment_date: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Payment Method</label>
                    <select
                      value={formData.payment_method}
                      onChange={(e) => setFormData({...formData, payment_method: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select payment method</option>
                      <option value="Cheque">Cheque</option>
                      <option value="Transfer-CEFT">Transfer-CEFT</option>
                      <option value="Direct Deposit">Direct Deposit</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">CDS Account</label>
                    <input
                      type="text"
                      value={formData.cds_account}
                      onChange={(e) => setFormData({...formData, cds_account: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="CDS Account Number"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Status *</label>
                    <select
                      required
                      value={formData.status}
                      onChange={(e) => setFormData({...formData, status: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="Pending">Pending</option>
                      <option value="Processing">Processing</option>
                      <option value="Paid">Paid</option>
                      <option value="Cancelled">Cancelled</option>
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Notes</label>
                    <textarea
                      value={formData.notes}
                      onChange={(e) => setFormData({...formData, notes: e.target.value})}
                      rows={3}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Additional notes about this dividend..."
                    />
                  </div>
                </div>
              </div>
              <div className="p-6 border-t border-gray-200 flex justify-end space-x-4 sticky bottom-0 bg-white">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-6 py-2 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
                >
                  Add Dividend
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
