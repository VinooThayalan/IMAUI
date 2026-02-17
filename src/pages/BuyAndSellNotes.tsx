import { Plus, Search, FileText, Upload, Edit, Trash2, Eye } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface BuyAndSellNote {
  id: string;
  transaction_id: string;
  note_type: 'Buy' | 'Sell';
  note_number: string;
  broker: string;
  brokerage_fee_type_id?: string;
  transaction_date?: string;
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
  ticker: string;
  name: string;
}

interface BrokerageFeeType {
  id: string;
  name: string;
  rate: number;
  is_active: boolean;
}

export function BuyAndSellNotes() {
  const [showModal, setShowModal] = useState(false);
  const [showValidationModal, setShowValidationModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewingNote, setViewingNote] = useState<BuyAndSellNote | null>(null);
  const [editingNote, setEditingNote] = useState<BuyAndSellNote | null>(null);
  const [notes, setNotes] = useState<BuyAndSellNote[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [shares, setShares] = useState<Share[]>([]);
  const [brokerageFeeTypes, setBrokerageFeeTypes] = useState<BrokerageFeeType[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'Buy' | 'Sell'>('all');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [showExtractionModal, setShowExtractionModal] = useState(false);
  const [extractedData, setExtractedData] = useState({
    noteNumber: '',
    broker: '',
    transactionDate: '',
    settlementDate: '',
    shareCode: '',
    shareName: '',
    noOfShares: '',
    pricePerShare: '',
    totalAmount: '',
    brokerageFee: '',
    brokerageFeeRate: '',
    netAmount: '',
    entity: ''
  });
  const [isExtracting, setIsExtracting] = useState(false);
  const [validationData, setValidationData] = useState({
    uploadedBrokerageFee: '',
    uploadedAmount: '',
    uploadedShares: ''
  });
  const [formData, setFormData] = useState({
    transaction_id: '',
    note_type: 'Buy' as 'Buy' | 'Sell',
    note_number: '',
    broker: '',
    brokerage_fee_type_id: '',
    transaction_date: new Date().toISOString().split('T')[0],
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

      const [notesRes, transactionsRes, entitiesRes, sharesRes, feeTypesRes] = await Promise.all([
        supabase.from('buy_sell_notes').select('*').order('created_at', { ascending: false }),
        supabase.from('transactions').select('*').order('transaction_date', { ascending: false }),
        supabase.from('entities').select('id, entity_id, name').order('name'),
        supabase.from('shares').select('id, ticker, name').order('name'),
        supabase.from('brokerage_fee_types').select('id, name, rate, is_active').eq('is_active', true).order('name')
      ]);

      if (notesRes.error) throw notesRes.error;
      if (transactionsRes.error) throw transactionsRes.error;
      if (entitiesRes.error) throw entitiesRes.error;
      if (sharesRes.error) throw sharesRes.error;
      if (feeTypesRes.error) throw feeTypesRes.error;

      setNotes(notesRes.data || []);
      setTransactions(transactionsRes.data || []);
      setEntities(entitiesRes.data || []);
      setShares(sharesRes.data || []);
      setBrokerageFeeTypes(feeTypesRes.data || []);
    } catch (error) {
      console.error('Error loading data:', error);
      alert('Failed to load data');
    } finally {
      setLoading(false);
    }
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedFile(file);
      simulateDataExtraction();
    }
  }

  function simulateDataExtraction() {
    setIsExtracting(true);
    setShowExtractionModal(true);

    setTimeout(() => {
      const dummyData = {
        noteNumber: 'CN' + Math.floor(Math.random() * 900000 + 100000),
        broker: 'ABC Securities Ltd',
        transactionDate: new Date().toISOString().split('T')[0],
        settlementDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        shareCode: 'ABC.N0000',
        shareName: 'ABC Company PLC',
        noOfShares: '1000',
        pricePerShare: '125.50',
        totalAmount: '125500.00',
        brokerageFee: '878.50',
        brokerageFeeRate: '0.70',
        netAmount: '126378.50',
        entity: 'John Doe'
      };

      setExtractedData(dummyData);
      setIsExtracting(false);
    }, 2000);
  }

  function handleConfirmExtractedData() {
    setFormData({
      ...formData,
      note_number: extractedData.noteNumber,
      broker: extractedData.broker,
      transaction_date: extractedData.transactionDate,
      settlement_date: extractedData.settlementDate,
      file_url: uploadedFile?.name || ''
    });

    setShowExtractionModal(false);
    alert('Data extracted successfully! Please review and complete any remaining fields.');
  }

  function handleValidationSubmit() {
    if (!validationData.uploadedBrokerageFee || !validationData.uploadedAmount || !validationData.uploadedShares) {
      alert('Please fill in all uploaded document values');
      return;
    }

    const selectedTransaction = transactions.find(t => t.id === formData.transaction_id);
    if (!selectedTransaction) {
      alert('Please select a transaction first');
      return;
    }

    const selectedFeeType = brokerageFeeTypes.find(f => f.id === formData.brokerage_fee_type_id);

    const uploadedFee = parseFloat(validationData.uploadedBrokerageFee);
    const uploadedAmount = parseFloat(validationData.uploadedAmount);
    const uploadedShares = parseFloat(validationData.uploadedShares);

    let expectedFee = 0;
    if (selectedFeeType) {
      expectedFee = selectedTransaction.total_amount * (selectedFeeType.rate / 100);
    }

    const errors = [];

    if (Math.abs(uploadedAmount - selectedTransaction.total_amount) > 0.01) {
      errors.push(`Total amount mismatch: Expected Rs. ${selectedTransaction.total_amount.toFixed(2)}, Uploaded Rs. ${uploadedAmount.toFixed(2)}`);
    }

    if (uploadedShares !== selectedTransaction.no_of_shares) {
      errors.push(`Shares mismatch: Expected ${selectedTransaction.no_of_shares}, Uploaded ${uploadedShares}`);
    }

    if (selectedFeeType && Math.abs(uploadedFee - expectedFee) > 0.01) {
      errors.push(`Brokerage fee mismatch: Expected Rs. ${expectedFee.toFixed(2)} (${selectedFeeType.rate}%), Uploaded Rs. ${uploadedFee.toFixed(2)}`);
    }

    if (errors.length > 0) {
      const proceed = confirm(`Validation warnings:\n\n${errors.join('\n')}\n\nDo you want to proceed anyway?`);
      if (!proceed) return;
    }

    alert('File validation successful! You can now submit the form.');
    setFormData({ ...formData, file_url: uploadedFile?.name || '' });
    setShowValidationModal(false);
    setValidationData({ uploadedBrokerageFee: '', uploadedAmount: '', uploadedShares: '' });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!formData.transaction_id || !formData.note_number || !formData.broker) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      const selectedTransaction = transactions.find(t => t.id === formData.transaction_id);
      if (!selectedTransaction) {
        alert('Selected transaction not found');
        return;
      }

      const entity = entities.find(e => e.id === selectedTransaction.entity_id);
      if (!entity) {
        alert('Entity not found for this transaction');
        return;
      }

      if (editingNote) {
        const { error } = await supabase
          .from('buy_sell_notes')
          .update({
            transaction_id: formData.transaction_id,
            note_type: formData.note_type,
            note_number: formData.note_number,
            broker: formData.broker,
            brokerage_fee_type_id: formData.brokerage_fee_type_id || null,
            transaction_date: formData.transaction_date,
            settlement_date: formData.settlement_date,
            file_url: formData.file_url || null,
            remarks: formData.remarks || null
          })
          .eq('id', editingNote.id);

        if (error) throw error;
      } else {
        const { data: insertedNote, error: insertError } = await supabase
          .from('buy_sell_notes')
          .insert({
            transaction_id: formData.transaction_id,
            note_type: formData.note_type,
            note_number: formData.note_number,
            broker: formData.broker,
            brokerage_fee_type_id: formData.brokerage_fee_type_id || null,
            transaction_date: formData.transaction_date,
            settlement_date: formData.settlement_date,
            file_url: formData.file_url || null,
            remarks: formData.remarks || null
          })
          .select()
          .single();

        if (insertError) throw insertError;

        let brokerageFee = 0;
        if (formData.brokerage_fee_type_id) {
          const feeType = brokerageFeeTypes.find(f => f.id === formData.brokerage_fee_type_id);
          if (feeType) {
            brokerageFee = selectedTransaction.total_amount * (feeType.rate / 100);
          }
        }

        const netAmount = formData.note_type === 'Buy'
          ? selectedTransaction.total_amount + brokerageFee
          : selectedTransaction.total_amount - brokerageFee;

        const transactionType = formData.note_type === 'Buy' ? 'Deduction' : 'Addition';

        const { data: existingTransactions } = await supabase
          .from('cash_balance_ledger')
          .select('running_balance')
          .eq('entity_id', entity.entity_id)
          .order('timestamp', { ascending: false })
          .limit(1);

        const lastBalance = existingTransactions && existingTransactions.length > 0
          ? Number(existingTransactions[0].running_balance)
          : Number(entity.current_balance) || 0;

        const newBalance = transactionType === 'Addition'
          ? lastBalance + netAmount
          : lastBalance - netAmount;

        const { error: ledgerError } = await supabase
          .from('cash_balance_ledger')
          .insert({
            type: transactionType,
            description: `${formData.note_type} - ${formData.note_number} (${formData.broker})`,
            code: formData.note_number,
            amount: netAmount,
            date: formData.transaction_date,
            running_balance: newBalance,
            entity_id: entity.entity_id,
            reference_id: insertedNote?.id || null,
            created_by: 'System',
            notes: formData.remarks || null
          });

        if (ledgerError) throw ledgerError;

        const { error: entityError } = await supabase
          .from('entities')
          .update({ current_balance: newBalance })
          .eq('entity_id', entity.entity_id);

        if (entityError) throw entityError;
      }

      await loadData();
      handleCloseModal();
      alert(`${formData.note_type} note ${editingNote ? 'updated' : 'added'} successfully!${!editingNote ? ' Cash balance has been updated.' : ''}`);
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
      brokerage_fee_type_id: note.brokerage_fee_type_id || '',
      transaction_date: note.transaction_date || new Date().toISOString().split('T')[0],
      settlement_date: note.settlement_date,
      file_url: note.file_url || '',
      remarks: note.remarks || ''
    });
    setShowModal(true);
  }

  function handleView(note: BuyAndSellNote) {
    setViewingNote(note);
    setShowViewModal(true);
  }

  function handleCloseModal() {
    setShowModal(false);
    setEditingNote(null);
    setFormData({
      transaction_id: '',
      note_type: 'Buy',
      note_number: '',
      broker: '',
      brokerage_fee_type_id: '',
      transaction_date: new Date().toISOString().split('T')[0],
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
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Brokerage Fee</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Settlement Date</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Document</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredNotes.map((note) => {
                const details = getTransactionDetails(note.transaction_id);
                const feeType = brokerageFeeTypes.find(ft => ft.id === note.brokerage_fee_type_id);
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
                          <div className="text-sm font-medium text-gray-900">{details.share?.name || 'N/A'}</div>
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
                      {feeType ? (
                        <div>
                          <div className="text-sm font-medium text-gray-900">{feeType.name}</div>
                          <div className="text-xs text-gray-500">{feeType.rate}%</div>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">Not set</span>
                      )}
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
                          onClick={() => handleView(note)}
                          className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
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
                        {new Date(transaction.transaction_date).toLocaleDateString()} - {transaction.transaction_type} - {share?.name || 'N/A'} ({entity?.name || 'N/A'})
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
                  Brokerage Fee Type
                </label>
                <select
                  value={formData.brokerage_fee_type_id}
                  onChange={(e) => setFormData({ ...formData, brokerage_fee_type_id: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select fee type (optional)</option>
                  {brokerageFeeTypes.map((feeType) => (
                    <option key={feeType.id} value={feeType.id}>
                      {feeType.name} ({feeType.rate}%)
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Transaction Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={formData.transaction_date}
                    onChange={(e) => setFormData({ ...formData, transaction_date: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Upload Buy/Sell Note Document
                </label>
                <div className="flex items-center space-x-2">
                  <Upload className="w-5 h-5 text-gray-400" />
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={handleFileUpload}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                {formData.file_url && (
                  <p className="text-sm text-green-600 mt-2">✓ File uploaded: {formData.file_url}</p>
                )}
                <p className="text-xs text-gray-500 mt-2">
                  Upload your buy/sell note document. After upload, you'll need to validate the values in the document.
                </p>
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

              {formData.transaction_id && !editingNote && (() => {
                const selectedTransaction = transactions.find(t => t.id === formData.transaction_id);
                const entity = selectedTransaction ? entities.find(e => e.id === selectedTransaction.entity_id) : null;

                if (!selectedTransaction || !entity) return null;

                let brokerageFee = 0;
                if (formData.brokerage_fee_type_id) {
                  const feeType = brokerageFeeTypes.find(f => f.id === formData.brokerage_fee_type_id);
                  if (feeType) {
                    brokerageFee = selectedTransaction.total_amount * (feeType.rate / 100);
                  }
                }

                const netAmount = formData.note_type === 'Buy'
                  ? selectedTransaction.total_amount + brokerageFee
                  : selectedTransaction.total_amount - brokerageFee;

                const currentBalance = Number(entity.current_balance) || 0;
                const newBalance = formData.note_type === 'Buy'
                  ? currentBalance - netAmount
                  : currentBalance + netAmount;

                return (
                  <div className={`p-4 rounded-lg border-2 ${formData.note_type === 'Buy' ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
                    <h3 className="font-semibold text-gray-900 mb-3 flex items-center">
                      <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Cash Balance Impact
                    </h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Entity:</span>
                        <span className="font-semibold text-gray-900">{entity.name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Transaction Amount:</span>
                        <span className="font-semibold text-gray-900">Rs. {selectedTransaction.total_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      </div>
                      {brokerageFee > 0 && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Brokerage Fee:</span>
                          <span className="font-semibold text-gray-900">Rs. {brokerageFee.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        </div>
                      )}
                      <div className="flex justify-between pt-2 border-t border-gray-300">
                        <span className="text-gray-600">Net Amount:</span>
                        <span className="font-bold text-gray-900">Rs. {netAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Current Balance:</span>
                        <span className="font-semibold text-gray-900">Rs. {currentBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Cash Movement:</span>
                        <span className={`font-bold ${formData.note_type === 'Buy' ? 'text-red-600' : 'text-green-600'}`}>
                          {formData.note_type === 'Buy' ? '-' : '+'}Rs. {netAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="flex justify-between pt-2 border-t border-gray-300">
                        <span className="text-gray-600 font-semibold">New Balance:</span>
                        <span className={`font-bold text-lg ${newBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          Rs. {newBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })()}

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

      {showExtractionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4">
              <h2 className="text-xl font-bold text-white">Document Data Extraction</h2>
              <p className="text-sm text-blue-100 mt-1">
                {isExtracting ? 'Analyzing document...' : 'Review and edit extracted data'}
              </p>
            </div>

            {isExtracting ? (
              <div className="p-12 flex flex-col items-center justify-center">
                <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mb-4"></div>
                <p className="text-gray-600 mb-2">Extracting data from document...</p>
                <p className="text-sm text-gray-500">This may take a few moments</p>
              </div>
            ) : (
              <>
                <div className="p-6">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                    <div className="flex items-start">
                      <div className="flex-shrink-0">
                        <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div className="ml-3">
                        <h3 className="text-sm font-medium text-green-800">Extraction Complete</h3>
                        <p className="text-sm text-green-700 mt-1">
                          Data has been successfully extracted. Please review and edit if needed.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <h3 className="font-semibold text-gray-900 text-sm uppercase tracking-wide border-b pb-2">
                        Document Information
                      </h3>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Note Number
                        </label>
                        <input
                          type="text"
                          value={extractedData.noteNumber}
                          onChange={(e) => setExtractedData({ ...extractedData, noteNumber: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-yellow-50"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Broker
                        </label>
                        <input
                          type="text"
                          value={extractedData.broker}
                          onChange={(e) => setExtractedData({ ...extractedData, broker: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-yellow-50"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Entity/Client Name
                        </label>
                        <input
                          type="text"
                          value={extractedData.entity}
                          onChange={(e) => setExtractedData({ ...extractedData, entity: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-yellow-50"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Transaction Date
                        </label>
                        <input
                          type="date"
                          value={extractedData.transactionDate}
                          onChange={(e) => setExtractedData({ ...extractedData, transactionDate: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-yellow-50"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Settlement Date
                        </label>
                        <input
                          type="date"
                          value={extractedData.settlementDate}
                          onChange={(e) => setExtractedData({ ...extractedData, settlementDate: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-yellow-50"
                        />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h3 className="font-semibold text-gray-900 text-sm uppercase tracking-wide border-b pb-2">
                        Transaction Details
                      </h3>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Share Code
                        </label>
                        <input
                          type="text"
                          value={extractedData.shareCode}
                          onChange={(e) => setExtractedData({ ...extractedData, shareCode: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-yellow-50"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Share Name
                        </label>
                        <input
                          type="text"
                          value={extractedData.shareName}
                          onChange={(e) => setExtractedData({ ...extractedData, shareName: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-yellow-50"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Number of Shares
                        </label>
                        <input
                          type="text"
                          value={extractedData.noOfShares}
                          onChange={(e) => setExtractedData({ ...extractedData, noOfShares: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-yellow-50"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Price per Share (Rs.)
                        </label>
                        <input
                          type="text"
                          value={extractedData.pricePerShare}
                          onChange={(e) => setExtractedData({ ...extractedData, pricePerShare: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-yellow-50"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Total Amount (Rs.)
                        </label>
                        <input
                          type="text"
                          value={extractedData.totalAmount}
                          onChange={(e) => setExtractedData({ ...extractedData, totalAmount: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-yellow-50"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 pt-6 border-t border-gray-200">
                    <h3 className="font-semibold text-gray-900 text-sm uppercase tracking-wide mb-4">
                      Fee Information
                    </h3>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Brokerage Fee (Rs.)
                        </label>
                        <input
                          type="text"
                          value={extractedData.brokerageFee}
                          onChange={(e) => setExtractedData({ ...extractedData, brokerageFee: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-yellow-50"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Brokerage Rate (%)
                        </label>
                        <input
                          type="text"
                          value={extractedData.brokerageFeeRate}
                          onChange={(e) => setExtractedData({ ...extractedData, brokerageFeeRate: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-yellow-50"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Net Amount (Rs.)
                        </label>
                        <input
                          type="text"
                          value={extractedData.netAmount}
                          onChange={(e) => setExtractedData({ ...extractedData, netAmount: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-yellow-50"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm text-blue-800">
                      <span className="font-semibold">Note:</span> Fields with yellow background contain extracted data.
                      Review all fields carefully and make corrections if needed before confirming.
                    </p>
                  </div>
                </div>

                <div className="flex justify-end space-x-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
                  <button
                    type="button"
                    onClick={() => {
                      setShowExtractionModal(false);
                      setUploadedFile(null);
                      setExtractedData({
                        noteNumber: '',
                        broker: '',
                        transactionDate: '',
                        settlementDate: '',
                        shareCode: '',
                        shareName: '',
                        noOfShares: '',
                        pricePerShare: '',
                        totalAmount: '',
                        brokerageFee: '',
                        brokerageFeeRate: '',
                        netAmount: '',
                        entity: ''
                      });
                    }}
                    className="px-6 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmExtractedData}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                  >
                    Confirm & Use Data
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {showValidationModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="bg-white border-b border-gray-200 px-6 py-4">
              <h2 className="text-xl font-bold text-gray-900">Validate Document Values</h2>
              <p className="text-sm text-gray-500 mt-1">
                Enter the values from the uploaded document to validate against the transaction
              </p>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Brokerage Fee (Rs.) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={validationData.uploadedBrokerageFee}
                  onChange={(e) => setValidationData({ ...validationData, uploadedBrokerageFee: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter brokerage fee from document"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Total Amount (Rs.) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={validationData.uploadedAmount}
                  onChange={(e) => setValidationData({ ...validationData, uploadedAmount: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter total amount from document"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Number of Shares <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="1"
                  value={validationData.uploadedShares}
                  onChange={(e) => setValidationData({ ...validationData, uploadedShares: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter number of shares from document"
                  required
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3 px-6 py-4 border-t border-gray-200">
              <button
                type="button"
                onClick={() => {
                  setShowValidationModal(false);
                  setUploadedFile(null);
                  setValidationData({ uploadedBrokerageFee: '', uploadedAmount: '', uploadedShares: '' });
                }}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleValidationSubmit}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Validate & Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {showViewModal && viewingNote && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4">
              <h2 className="text-xl font-bold text-gray-900">View Buy/Sell Note Details</h2>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-500">Note Number:</span>
                  <span className="text-sm font-bold text-gray-900">{viewingNote.note_number}</span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-500">Note Type:</span>
                  <span className={`text-sm font-bold px-2 py-1 rounded ${
                    viewingNote.note_type === 'Buy' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {viewingNote.note_type}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-500">Broker:</span>
                  <span className="text-sm font-bold text-gray-900">{viewingNote.broker}</span>
                </div>

                {viewingNote.transaction_date && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-500">Transaction Date:</span>
                    <span className="text-sm font-bold text-gray-900">
                      {new Date(viewingNote.transaction_date).toLocaleDateString()}
                    </span>
                  </div>
                )}

                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-500">Settlement Date:</span>
                  <span className="text-sm font-bold text-gray-900">
                    {new Date(viewingNote.settlement_date).toLocaleDateString()}
                  </span>
                </div>

                {viewingNote.brokerage_fee_type_id && (() => {
                  const feeType = brokerageFeeTypes.find(ft => ft.id === viewingNote.brokerage_fee_type_id);
                  return feeType ? (
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-500">Brokerage Fee Type:</span>
                      <span className="text-sm font-bold text-gray-900">{feeType.name} ({feeType.rate}%)</span>
                    </div>
                  ) : null;
                })()}

                {(() => {
                  const details = getTransactionDetails(viewingNote.transaction_id);
                  return details ? (
                    <>
                      <div className="pt-3 border-t border-gray-200">
                        <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Transaction Details</p>
                      </div>

                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-gray-500">Entity:</span>
                        <span className="text-sm font-bold text-gray-900">{details.entity?.name || 'N/A'}</span>
                      </div>

                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-gray-500">Share:</span>
                        <span className="text-sm font-bold text-gray-900">{details.share?.name || 'N/A'}</span>
                      </div>

                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-gray-500">Number of Shares:</span>
                        <span className="text-sm font-bold text-gray-900">
                          {details.transaction.no_of_shares.toLocaleString()}
                        </span>
                      </div>

                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-gray-500">Price per Share:</span>
                        <span className="text-sm font-bold text-gray-900">
                          Rs. {details.transaction.price_per_share.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                      </div>

                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-gray-500">Total Amount:</span>
                        <span className="text-sm font-bold text-gray-900">
                          Rs. {details.transaction.total_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </>
                  ) : null;
                })()}

                {viewingNote.file_url && (
                  <div className="pt-3 border-t border-gray-200">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-500">Attached Document:</span>
                      <a
                        href={viewingNote.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:text-blue-800 font-semibold"
                      >
                        View Document
                      </a>
                    </div>
                  </div>
                )}

                {viewingNote.remarks && (
                  <div className="pt-3 border-t border-gray-200">
                    <span className="text-sm font-medium text-gray-500">Remarks:</span>
                    <p className="text-sm text-gray-900 mt-1">{viewingNote.remarks}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end px-6 py-4 border-t border-gray-200">
              <button
                type="button"
                onClick={() => setShowViewModal(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
