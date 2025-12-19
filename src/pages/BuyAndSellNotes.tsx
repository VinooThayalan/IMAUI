import { Plus, Search, FileText, Upload, Edit, Trash2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface BuyAndSellNote {
  id: string;
  transaction_id: string;
  note_type: 'Buy' | 'Sell';
  note_number: string;
  broker: string;
  settlement_date: string;
  file_url?: string;
  remarks?: string;
  created_at: string;
  updated_at: string;
}

interface Transaction {
  id: string;
  entity_id: string;
  share_id: string;
  transaction_type: string;
  transaction_date: string;
  no_of_shares: number;
  price_per_share: number;
  total_amount: number;
}

interface Entity {
  id: string;
  entity_id: string;
  name: string;
}

interface Share {
  id: string;
  share_id: string;
  company_name: string;
}

export function BuyAndSellNotes() {
  const [showModal, setShowModal] = useState(false);
  const [editingNote, setEditingNote] = useState<BuyAndSellNote | null>(null);
  const [notes, setNotes] = useState<BuyAndSellNote[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [shares, setShares] = useState<Share[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'Buy' | 'Sell'>('all');
  const [formData, setFormData] = useState({
    transaction_id: '',
    note_type: 'Buy' as 'Buy' | 'Sell',
    note_number: '',
    broker: '',
    settlement_date: new Date().toISOString().split('T')[0],
    file_url: '',
    remarks: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);

      const [notesRes, transactionsRes, entitiesRes, sharesRes] = await Promise.all([
        supabase.from('buy_sell_notes').select('*').order('created_at', { ascending: false }),
        supabase.from('transactions').select('*').order('transaction_date', { ascending: false }),
        supabase.from('entities').select('id, entity_id, name').order('name'),
        supabase.from('shares').select('id, share_id, company_name').order('company_name')
      ]);

      if (notesRes.error) throw notesRes.error;
      if (transactionsRes.error) throw transactionsRes.error;
      if (entitiesRes.error) throw entitiesRes.error;
      if (sharesRes.error) throw sharesRes.error;

      setNotes(notesRes.data || []);
      setTransactions(transactionsRes.data || []);
      setEntities(entitiesRes.data || []);
      setShares(sharesRes.data || []);
    } catch (error) {
      console.error('Error loading data:', error);
      alert('Failed to load data');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!formData.transaction_id || !formData.note_number || !formData.broker) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      if (editingNote) {
        const { error } = await supabase
          .from('buy_sell_notes')
          .update({
            transaction_id: formData.transaction_id,
            note_type: formData.note_type,
            note_number: formData.note_number,
            broker: formData.broker,
            settlement_date: formData.settlement_date,
            file_url: formData.file_url || null,
            remarks: formData.remarks || null
          })
          .eq('id', editingNote.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('buy_sell_notes')
          .insert({
            transaction_id: formData.transaction_id,
            note_type: formData.note_type,
            note_number: formData.note_number,
            broker: formData.broker,
            settlement_date: formData.settlement_date,
            file_url: formData.file_url || null,
            remarks: formData.remarks || null
          });

        if (error) throw error;
      }

      await loadData();
      handleCloseModal();
    } catch (error) {
      console.error('Error saving note:', error);
      alert('Failed to save note');
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this note?')) return;

    try {
      const { error } = await supabase
        .from('buy_sell_notes')
        .delete()
        .eq('id', id);

      if (error) throw error;
      await loadData();
    } catch (error) {
      console.error('Error deleting note:', error);
      alert('Failed to delete note');
    }
  }

  function handleEdit(note: BuyAndSellNote) {
    setEditingNote(note);
    setFormData({
      transaction_id: note.transaction_id,
      note_type: note.note_type,
      note_number: note.note_number,
      broker: note.broker,
      settlement_date: note.settlement_date,
      file_url: note.file_url || '',
      remarks: note.remarks || ''
    });
    setShowModal(true);
  }

  function handleCloseModal() {
    setShowModal(false);
    setEditingNote(null);
    setFormData({
      transaction_id: '',
      note_type: 'Buy',
      note_number: '',
      broker: '',
      settlement_date: new Date().toISOString().split('T')[0],
      file_url: '',
      remarks: ''
    });
  }

  function getTransactionDetails(transactionId: string) {
    const transaction = transactions.find(t => t.id === transactionId);
    if (!transaction) return null;

    const entity = entities.find(e => e.id === transaction.entity_id);
    const share = shares.find(s => s.id === transaction.share_id);

    return {
      transaction,
      entity,
      share
    };
  }

  const filteredNotes = notes.filter(note => {
    const matchesSearch = note.note_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         note.broker.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'all' || note.note_type === filterType;
    return matchesSearch && matchesType;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-3xl font-bold text-gray-900">Buy & Sell Notes</h1>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            <span>Add Note</span>
          </button>
        </div>
        <p className="text-gray-600">Upload and manage contract notes for buy and sell transactions</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6 p-6">
        <div className="flex items-center space-x-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search by note number or broker..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as 'all' | 'Buy' | 'Sell')}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Types</option>
            <option value="Buy">Buy Notes</option>
            <option value="Sell">Sell Notes</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Note Number</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Transaction Details</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Broker</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Settlement Date</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Document</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredNotes.map((note) => {
                const details = getTransactionDetails(note.transaction_id);
                return (
                  <tr key={note.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-bold text-blue-600">{note.note_number}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        note.note_type === 'Buy' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {note.note_type}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {details ? (
                        <div>
                          <div className="text-sm font-medium text-gray-900">{details.share?.company_name || 'N/A'}</div>
                          <div className="text-xs text-gray-500">{details.entity?.name || 'N/A'}</div>
                          <div className="text-xs text-gray-500">
                            {details.transaction.no_of_shares} shares @ Rs. {details.transaction.price_per_share.toLocaleString()}
                          </div>
                        </div>
                      ) : (
                        <div className="text-sm text-gray-500">Transaction not found</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{note.broker}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {new Date(note.settlement_date).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {note.file_url ? (
                        <a
                          href={note.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 flex items-center space-x-1"
                        >
                          <FileText className="w-4 h-4" />
                          <span className="text-sm">View</span>
                        </a>
                      ) : (
                        <span className="text-sm text-gray-400">No file</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleEdit(note)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(note.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filteredNotes.length === 0 && (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No notes found</p>
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4">
              <h2 className="text-xl font-bold text-gray-900">
                {editingNote ? 'Edit Note' : 'Add Buy/Sell Note'}
              </h2>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Transaction <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.transaction_id}
                  onChange={(e) => setFormData({ ...formData, transaction_id: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Select transaction</option>
                  {transactions.map((transaction) => {
                    const entity = entities.find(e => e.id === transaction.entity_id);
                    const share = shares.find(s => s.id === transaction.share_id);
                    return (
                      <option key={transaction.id} value={transaction.id}>
                        {new Date(transaction.transaction_date).toLocaleDateString()} - {transaction.transaction_type} - {share?.company_name || 'N/A'} ({entity?.name || 'N/A'})
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Note Type</label>
                <div className="flex space-x-4">
                  <label className="flex items-center space-x-2">
                    <input
                      type="radio"
                      value="Buy"
                      checked={formData.note_type === 'Buy'}
                      onChange={(e) => setFormData({ ...formData, note_type: 'Buy' })}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    <span>Buy</span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input
                      type="radio"
                      value="Sell"
                      checked={formData.note_type === 'Sell'}
                      onChange={(e) => setFormData({ ...formData, note_type: 'Sell' })}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    <span>Sell</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Note Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.note_number}
                  onChange={(e) => setFormData({ ...formData, note_number: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., CN2024001"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Broker <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.broker}
                  onChange={(e) => setFormData({ ...formData, broker: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., ABC Securities"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Settlement Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={formData.settlement_date}
                  onChange={(e) => setFormData({ ...formData, settlement_date: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Document URL
                </label>
                <div className="flex items-center space-x-2">
                  <Upload className="w-5 h-5 text-gray-400" />
                  <input
                    type="url"
                    value={formData.file_url}
                    onChange={(e) => setFormData({ ...formData, file_url: e.target.value })}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="https://example.com/document.pdf"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">Enter the URL of the uploaded document</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Remarks</label>
                <textarea
                  value={formData.remarks}
                  onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Additional notes..."
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  {editingNote ? 'Update Note' : 'Add Note'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
