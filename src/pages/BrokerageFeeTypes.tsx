import { Plus, CreditCard as Edit, Trash2, Percent, ChevronDown, ChevronUp } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface FeeBreakdownItem {
  name: string;
  rate: number;
}

interface BrokerageFeeType {
  id: string;
  name: string;
  min_price: number | null;
  max_price: number | null;
  rate: number;
  description: string;
  is_active: boolean;
  fee_breakdown_items: FeeBreakdownItem[];
  created_at: string;
}

const DEFAULT_BREAKDOWN_NAMES = [
  'Brokerage Fee',
  'CSE Fees',
  'CDS Fees',
  'Clearing Fees',
  'SEC CESS',
  'Share Transaction IOVY',
];

export function BrokerageFeeTypes() {
  const [feeTypes, setFeeTypes] = useState<BrokerageFeeType[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingFeeType, setEditingFeeType] = useState<BrokerageFeeType | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [formData, setFormData] = useState({
    name: '',
    min_price: '',
    max_price: '',
    description: '',
    is_active: true,
  });
  const [breakdownItems, setBreakdownItems] = useState<FeeBreakdownItem[]>([]);

  useEffect(() => {
    fetchFeeTypes();
  }, []);

  const fetchFeeTypes = async () => {
    const { data, error } = await supabase
      .from('brokerage_fee_types')
      .select('*')
      .order('min_price', { nullsFirst: true });

    if (error) {
      console.error('Error fetching fee types:', error);
      return;
    }

    setFeeTypes((data || []).map(ft => ({
      ...ft,
      fee_breakdown_items: Array.isArray(ft.fee_breakdown_items) ? ft.fee_breakdown_items : [],
    })));
  };

  const totalBreakdownRate = breakdownItems.reduce((sum, item) => sum + (item.rate || 0), 0);

  const handleAddFeeType = async (e: React.FormEvent) => {
    e.preventDefault();

    const payload = {
      name: formData.name,
      min_price: formData.min_price ? parseFloat(formData.min_price) : null,
      max_price: formData.max_price ? parseFloat(formData.max_price) : null,
      rate: breakdownItems.length > 0 ? totalBreakdownRate : 0,
      description: formData.description,
      is_active: formData.is_active,
      fee_breakdown_items: breakdownItems,
    };

    if (editingFeeType) {
      const { error } = await supabase
        .from('brokerage_fee_types')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('id', editingFeeType.id);

      if (error) {
        console.error('Error updating fee type:', error);
        alert('Failed to update fee type');
        return;
      }
    } else {
      const { error } = await supabase
        .from('brokerage_fee_types')
        .insert(payload);

      if (error) {
        console.error('Error adding fee type:', error);
        alert('Failed to add fee type');
        return;
      }
    }

    closeModal();
    fetchFeeTypes();
  };

  const handleEdit = (feeType: BrokerageFeeType) => {
    setEditingFeeType(feeType);
    setFormData({
      name: feeType.name,
      min_price: feeType.min_price != null ? feeType.min_price.toString() : '',
      max_price: feeType.max_price != null ? feeType.max_price.toString() : '',
      description: feeType.description,
      is_active: feeType.is_active,
    });
    setBreakdownItems(
      feeType.fee_breakdown_items.length > 0
        ? feeType.fee_breakdown_items.map(i => ({ ...i }))
        : DEFAULT_BREAKDOWN_NAMES.map(name => ({ name, rate: 0 }))
    );
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this fee type?')) return;
    const { error } = await supabase.from('brokerage_fee_types').delete().eq('id', id);
    if (error) {
      alert('Failed to delete fee type');
      return;
    }
    fetchFeeTypes();
  };

  const handleToggleActive = async (feeType: BrokerageFeeType) => {
    const { error } = await supabase
      .from('brokerage_fee_types')
      .update({ is_active: !feeType.is_active, updated_at: new Date().toISOString() })
      .eq('id', feeType.id);
    if (!error) fetchFeeTypes();
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingFeeType(null);
    setFormData({ name: '', min_price: '', max_price: '', description: '', is_active: true });
    setBreakdownItems([]);
  };

  const openAddModal = () => {
    setEditingFeeType(null);
    setFormData({ name: '', min_price: '', max_price: '', description: '', is_active: true });
    setBreakdownItems(DEFAULT_BREAKDOWN_NAMES.map(name => ({ name, rate: 0 })));
    setShowModal(true);
  };

  const addBreakdownItem = () => {
    setBreakdownItems(prev => [...prev, { name: '', rate: 0 }]);
  };

  const removeBreakdownItem = (index: number) => {
    setBreakdownItems(prev => prev.filter((_, i) => i !== index));
  };

  const updateBreakdownItem = (index: number, field: keyof FeeBreakdownItem, value: string | number) => {
    setBreakdownItems(prev => prev.map((item, i) =>
      i === index
        ? { ...item, [field]: field === 'rate' ? parseFloat(value as string) || 0 : value }
        : item
    ));
  };

  const toggleRow = (id: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const activeFeeTypes = feeTypes.filter(ft => ft.is_active);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Total Fee Types</h1>
          <p className="text-gray-500 mt-1">Manage brokerage fee tiers and component breakdowns</p>
        </div>
        <button
          onClick={openAddModal}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          <span className="font-medium">Add Fee Type</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Total Fee Types</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">{feeTypes.length}</p>
              <p className="text-sm text-gray-500 mt-2">{activeFeeTypes.length} active</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <Percent className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Active Fee Types</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">{activeFeeTypes.length}</p>
              <p className="text-sm text-gray-500 mt-2">Currently in use</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 w-10"></th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Name</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Min Amount</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Max Amount</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Rate</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Components</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {feeTypes.map((feeType) => (
              <>
                <tr key={feeType.id} className="hover:bg-gray-50">
                  <td className="px-4 py-4 text-center">
                    {feeType.fee_breakdown_items.length > 0 && (
                      <button
                        onClick={() => toggleRow(feeType.id)}
                        className="text-gray-400 hover:text-blue-600 transition-colors"
                      >
                        {expandedRows.has(feeType.id)
                          ? <ChevronUp className="w-4 h-4" />
                          : <ChevronDown className="w-4 h-4" />}
                      </button>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-bold text-gray-900">{feeType.name}</div>
                    {feeType.description && (
                      <div className="text-xs text-gray-500 mt-0.5">{feeType.description}</div>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {feeType.min_price != null ? `LKR ${feeType.min_price.toLocaleString()}` : '-'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {feeType.max_price != null ? `LKR ${feeType.max_price.toLocaleString()}` : '-'}
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm font-bold text-blue-600">{Number(feeType.rate).toFixed(4)}%</span>
                  </td>
                  <td className="px-6 py-4">
                    {feeType.fee_breakdown_items.length > 0 ? (
                      <button
                        onClick={() => toggleRow(feeType.id)}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        {feeType.fee_breakdown_items.length} components
                      </button>
                    ) : (
                      <span className="text-gray-400 italic text-xs">No breakdown</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => handleToggleActive(feeType)}
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold cursor-pointer transition-colors ${
                        feeType.is_active
                          ? 'bg-green-100 text-green-800 hover:bg-green-200'
                          : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      }`}
                    >
                      {feeType.is_active ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleEdit(feeType)}
                        className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        title="Edit"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(feeType.id)}
                        className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>

                {expandedRows.has(feeType.id) && feeType.fee_breakdown_items.length > 0 && (
                  <tr key={`${feeType.id}-breakdown`}>
                    <td className="bg-blue-50"></td>
                    <td colSpan={7} className="bg-blue-50 px-6 py-4">
                      <div className="max-w-sm rounded-lg border border-blue-200 overflow-hidden shadow-sm">
                        <table className="w-full text-sm">
                          <thead className="bg-blue-600">
                            <tr>
                              <th className="px-4 py-2 text-left font-semibold text-white">Fee Component</th>
                              <th className="px-4 py-2 text-right font-semibold text-white">Rate (%)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-blue-100">
                            {feeType.fee_breakdown_items.map((item, idx) => (
                              <tr key={idx} className="bg-white">
                                <td className="px-4 py-2 text-gray-700">{item.name}</td>
                                <td className="px-4 py-2 text-right font-medium text-green-700">{Number(item.rate).toFixed(4)}%</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot className="bg-blue-50 border-t-2 border-blue-300">
                            <tr>
                              <td className="px-4 py-2.5 font-bold text-blue-900">Total</td>
                              <td className="px-4 py-2.5 text-right font-bold text-blue-900">
                                {feeType.fee_breakdown_items.reduce((s, i) => s + Number(i.rate), 0).toFixed(4)}%
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">
                {editingFeeType ? 'Edit Fee Type' : 'Add Fee Type'}
              </h2>
            </div>

            <form onSubmit={handleAddFeeType} className="flex flex-col flex-1 min-h-0">
              <div className="p-6 space-y-6 overflow-y-auto">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Name *</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="e.g., Below 100M transactions"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Min Transaction Amount (LKR)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.min_price}
                      onChange={(e) => setFormData({ ...formData, min_price: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Leave blank for no minimum"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Max Transaction Amount (LKR)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.max_price}
                      onChange={(e) => setFormData({ ...formData, max_price: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Leave blank for no maximum"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Description</label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows={2}
                      placeholder="Optional description"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700">Fee Breakdown Components</label>
                      <p className="text-xs text-gray-500 mt-0.5">Define individual components. Total rate is auto-calculated.</p>
                    </div>
                    <button
                      type="button"
                      onClick={addBreakdownItem}
                      className="flex items-center space-x-1 px-3 py-1.5 text-sm bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Row</span>
                    </button>
                  </div>

                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-4 py-2.5 text-left font-semibold text-gray-600">Component Name</th>
                          <th className="px-4 py-2.5 text-right font-semibold text-gray-600 w-40">Rate (%)</th>
                          <th className="px-3 py-2.5 w-10"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {breakdownItems.map((item, idx) => (
                          <tr key={idx}>
                            <td className="px-4 py-2">
                              <input
                                type="text"
                                value={item.name}
                                onChange={(e) => updateBreakdownItem(idx, 'name', e.target.value)}
                                className="w-full px-3 py-1.5 border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
                                placeholder="e.g., Brokerage Fee"
                              />
                            </td>
                            <td className="px-4 py-2">
                              <input
                                type="number"
                                step="0.0001"
                                min="0"
                                value={item.rate}
                                onChange={(e) => updateBreakdownItem(idx, 'rate', e.target.value)}
                                className="w-full px-3 py-1.5 border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm text-right"
                                placeholder="0.0000"
                              />
                            </td>
                            <td className="px-3 py-2 text-center">
                              <button
                                type="button"
                                onClick={() => removeBreakdownItem(idx)}
                                className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                        {breakdownItems.length === 0 && (
                          <tr>
                            <td colSpan={3} className="px-4 py-8 text-center text-gray-400 text-sm italic">
                              No components added yet. Click "Add Row" to start building the breakdown.
                            </td>
                          </tr>
                        )}
                      </tbody>
                      {breakdownItems.length > 0 && (
                        <tfoot className="bg-gray-50 border-t-2 border-gray-300">
                          <tr>
                            <td className="px-4 py-2.5 font-bold text-gray-800">Total Rate</td>
                            <td className="px-4 py-2.5 text-right font-bold text-blue-700 text-base">
                              {totalBreakdownRate.toFixed(4)}%
                            </td>
                            <td></td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="is_active_modal"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="is_active_modal" className="text-sm font-medium text-gray-700">Active</label>
                </div>
              </div>

              <div className="p-6 border-t border-gray-200 flex items-center justify-between bg-white">
                <div className="text-sm text-gray-500">
                  {breakdownItems.length > 0 && (
                    <span>
                      Total rate will be saved as{' '}
                      <strong className="text-blue-700">{totalBreakdownRate.toFixed(4)}%</strong>
                    </span>
                  )}
                </div>
                <div className="flex space-x-3">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="px-6 py-2 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
                  >
                    {editingFeeType ? 'Update Fee Type' : 'Add Fee Type'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
