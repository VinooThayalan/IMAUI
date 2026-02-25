import { Plus, Search, FileText, Upload, Eye, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface BuyAndSellNote {
  id: string;
  transaction_id: string;
  note_type: 'Buy' | 'Sell';
  note_number: string;
  broker_id?: string;
  dealer_name?: string;
  transaction_date?: string;
  settlement_date: string;
  file_url?: string;
  remarks?: string;
  trade_date?: string;
  contract_no?: string;
  no_of_shares?: number;
  price_avg?: number;
  gross_amount?: number;
  brokerage?: number;
  sec?: number;
  exchange?: number;
  cds?: number;
  gov_cess?: number;
  clearing_fees?: number;
  net_amount?: number;
  foreign_brokerage?: number;
  created_at: string;
}

interface Transaction {
  id: string;
  entity_id: string;
  share_id: string;
  transaction_type: string;
  approval_status: string;
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

interface Broker {
  id: string;
  broker_id: string;
  broker_name: string;
}

interface EntityBroker {
  id: string;
  entity_id: string;
  broker_id: string;
  account_number: string;
  cds_account?: string;
}

interface ExtractedData {
  trade_date: string;
  contract_no: string;
  no_of_shares: string;
  price_avg: string;
  gross_amount: string;
  brokerage: string;
  sec: string;
  exchange: string;
  cds: string;
  gov_cess: string;
  clearing_fees: string;
  net_amount: string;
  settlement: string;
  foreign_brokerage: string;
}

export function BuyAndSellNotes() {
  const [showModal, setShowModal] = useState(false);
  const [showProcessModal, setShowProcessModal] = useState(false);
  const [notes, setNotes] = useState<BuyAndSellNote[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [shares, setShares] = useState<Share[]>([]);
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [entityBrokers, setEntityBrokers] = useState<EntityBroker[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedData, setExtractedData] = useState<ExtractedData>({
    trade_date: '',
    contract_no: '',
    no_of_shares: '',
    price_avg: '',
    gross_amount: '',
    brokerage: '',
    sec: '',
    exchange: '',
    cds: '',
    gov_cess: '',
    clearing_fees: '',
    net_amount: '',
    settlement: '',
    foreign_brokerage: ''
  });
  const [formData, setFormData] = useState({
    transaction_id: '',
    broker_id: '',
    dealer_name: '',
    entity_account_number: '',
    settlement_date: new Date().toISOString().split('T')[0],
    remarks: ''
  });
  const [validationIssues, setValidationIssues] = useState<string[]>([]);
  const [totals, setTotals] = useState({
    total_shares: 0,
    total_price_avg: 0,
    total_gross: 0,
    total_brokerage: 0,
    total_sec: 0,
    total_exchange: 0,
    total_cds: 0,
    total_gov_cess: 0,
    total_clearing: 0,
    total_net: 0,
    purchase_total: 0,
    sales_total: 0,
    net_settlement: 0
  });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);

      const [notesRes, transactionsRes, entitiesRes, sharesRes, brokersRes, entityBrokersRes] = await Promise.all([
        supabase.from('buy_sell_notes').select('*').order('created_at', { ascending: false }),
        supabase.from('transactions').select('*').eq('approval_status', 'APPROVED').order('transaction_date', { ascending: false }),
        supabase.from('entities').select('id, entity_id, name').order('name'),
        supabase.from('shares').select('id, ticker, name').order('name'),
        supabase.from('brokers').select('id, broker_id, broker_name').eq('is_active', true).order('broker_name'),
        supabase.from('entity_brokers').select('*')
      ]);

      if (notesRes.error) throw notesRes.error;
      if (transactionsRes.error) throw transactionsRes.error;
      if (entitiesRes.error) throw entitiesRes.error;
      if (sharesRes.error) throw sharesRes.error;
      if (brokersRes.error) throw brokersRes.error;

      setNotes(notesRes.data || []);
      setTransactions(transactionsRes.data || []);
      setEntities(entitiesRes.data || []);
      setShares(sharesRes.data || []);
      setBrokers(brokersRes.data || []);
      setEntityBrokers(entityBrokersRes.data || []);
    } catch (error) {
      console.error('Error loading data:', error);
      alert('Failed to load data');
    } finally {
      setLoading(false);
    }
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      setUploadedFile(file);
      simulateDataExtraction();
    } else {
      alert('Please upload a PDF file');
    }
  }

  function simulateDataExtraction() {
    setIsExtracting(true);

    setTimeout(() => {
      const dummyData: ExtractedData = {
        trade_date: '2024-01-15',
        contract_no: 'CN' + Math.floor(Math.random() * 900000 + 100000),
        no_of_shares: '1000',
        price_avg: '125.50',
        gross_amount: '125500.00',
        brokerage: '878.50',
        sec: '250.00',
        exchange: '100.00',
        cds: '50.00',
        gov_cess: '150.00',
        clearing_fees: '75.00',
        net_amount: '127003.50',
        settlement: '2024-01-17',
        foreign_brokerage: '0.00'
      };

      setExtractedData(dummyData);
      setFormData({ ...formData, settlement_date: dummyData.settlement });
      setIsExtracting(false);
    }, 2000);
  }

  function calculateTotals() {
    const shares = parseFloat(extractedData.no_of_shares) || 0;
    const priceAvg = parseFloat(extractedData.price_avg) || 0;
    const gross = parseFloat(extractedData.gross_amount) || 0;
    const brokerage = parseFloat(extractedData.brokerage) || 0;
    const sec = parseFloat(extractedData.sec) || 0;
    const exchange = parseFloat(extractedData.exchange) || 0;
    const cds = parseFloat(extractedData.cds) || 0;
    const govCess = parseFloat(extractedData.gov_cess) || 0;
    const clearing = parseFloat(extractedData.clearing_fees) || 0;
    const net = parseFloat(extractedData.net_amount) || 0;

    const selectedTransaction = transactions.find(t => t.id === formData.transaction_id);
    const isBuy = selectedTransaction?.transaction_type === 'Buy';

    setTotals({
      total_shares: shares,
      total_price_avg: priceAvg,
      total_gross: gross,
      total_brokerage: brokerage,
      total_sec: sec,
      total_exchange: exchange,
      total_cds: cds,
      total_gov_cess: govCess,
      total_clearing: clearing,
      total_net: net,
      purchase_total: isBuy ? net : 0,
      sales_total: !isBuy ? net : 0,
      net_settlement: isBuy ? -net : net
    });
  }

  function validateExtractedData() {
    const issues: string[] = [];

    if (!formData.transaction_id) {
      issues.push('Please select a transaction');
      setValidationIssues(issues);
      return false;
    }

    const selectedTransaction = transactions.find(t => t.id === formData.transaction_id);
    if (!selectedTransaction) {
      issues.push('Selected transaction not found');
      setValidationIssues(issues);
      return false;
    }

    const uploadedShares = parseFloat(extractedData.no_of_shares) || 0;
    const uploadedPrice = parseFloat(extractedData.price_avg) || 0;
    const uploadedGross = parseFloat(extractedData.gross_amount) || 0;

    if (Math.abs(uploadedShares - selectedTransaction.no_of_shares) > 0.01) {
      issues.push(`No of Shares mismatch: Expected ${selectedTransaction.no_of_shares}, but PDF shows ${uploadedShares}`);
    }

    if (Math.abs(uploadedPrice - selectedTransaction.price_per_share) > 0.01) {
      issues.push(`Price/Avg mismatch: Expected ${selectedTransaction.price_per_share.toFixed(2)}, but PDF shows ${uploadedPrice}`);
    }

    if (Math.abs(uploadedGross - selectedTransaction.total_amount) > 0.01) {
      issues.push(`Gross Amount mismatch: Expected ${selectedTransaction.total_amount.toFixed(2)}, but PDF shows ${uploadedGross}`);
    }

    const expectedBrokerage = calculateExpectedBrokerage(uploadedGross);
    const uploadedBrokerage = parseFloat(extractedData.brokerage) || 0;
    if (Math.abs(uploadedBrokerage - expectedBrokerage) > 1) {
      issues.push(`Brokerage mismatch: Expected ~${expectedBrokerage.toFixed(2)}, but PDF shows ${uploadedBrokerage}`);
    }

    const expectedSec = uploadedGross * 0.002;
    const uploadedSec = parseFloat(extractedData.sec) || 0;
    if (Math.abs(uploadedSec - expectedSec) > 1) {
      issues.push(`SEC mismatch: Expected ~${expectedSec.toFixed(2)}, but PDF shows ${uploadedSec}`);
    }

    const expectedExchange = uploadedGross * 0.0008;
    const uploadedExchange = parseFloat(extractedData.exchange) || 0;
    if (Math.abs(uploadedExchange - expectedExchange) > 1) {
      issues.push(`Exchange mismatch: Expected ~${expectedExchange.toFixed(2)}, but PDF shows ${uploadedExchange}`);
    }

    const expectedCds = uploadedGross * 0.0004;
    const uploadedCds = parseFloat(extractedData.cds) || 0;
    if (Math.abs(uploadedCds - expectedCds) > 1) {
      issues.push(`CDS mismatch: Expected ~${expectedCds.toFixed(2)}, but PDF shows ${uploadedCds}`);
    }

    const expectedGovCess = uploadedGross * 0.0012;
    const uploadedGovCess = parseFloat(extractedData.gov_cess) || 0;
    if (Math.abs(uploadedGovCess - expectedGovCess) > 1) {
      issues.push(`GOV CESS mismatch: Expected ~${expectedGovCess.toFixed(2)}, but PDF shows ${uploadedGovCess}`);
    }

    const expectedClearing = uploadedGross * 0.0006;
    const uploadedClearing = parseFloat(extractedData.clearing_fees) || 0;
    if (Math.abs(uploadedClearing - expectedClearing) > 1) {
      issues.push(`Clearing Fees mismatch: Expected ~${expectedClearing.toFixed(2)}, but PDF shows ${uploadedClearing}`);
    }

    setValidationIssues(issues);
    calculateTotals();
    return issues.length === 0;
  }

  function calculateExpectedBrokerage(grossAmount: number): number {
    return grossAmount * 0.007;
  }

  function handleProcessClick() {
    if (!uploadedFile) {
      alert('Please upload a PDF first');
      return;
    }

    if (!extractedData.contract_no) {
      alert('Please wait for PDF extraction to complete');
      return;
    }

    validateExtractedData();
    setShowProcessModal(true);
  }

  async function handleApproval() {
    if (validationIssues.length > 0) {
      alert('Cannot approve with validation issues. Please check the highlighted mismatches.');
      return;
    }

    try {
      const selectedTransaction = transactions.find(t => t.id === formData.transaction_id);
      if (!selectedTransaction) {
        alert('Transaction not found');
        return;
      }

      const { data: insertedNote, error: insertError } = await supabase
        .from('buy_sell_notes')
        .insert({
          transaction_id: formData.transaction_id,
          note_type: selectedTransaction.transaction_type,
          note_number: extractedData.contract_no,
          broker_id: formData.broker_id,
          dealer_name: formData.dealer_name || null,
          transaction_date: extractedData.trade_date,
          settlement_date: formData.settlement_date,
          file_url: uploadedFile?.name || null,
          remarks: formData.remarks || null,
          trade_date: extractedData.trade_date,
          contract_no: extractedData.contract_no,
          no_of_shares: parseFloat(extractedData.no_of_shares),
          price_avg: parseFloat(extractedData.price_avg),
          gross_amount: parseFloat(extractedData.gross_amount),
          brokerage: parseFloat(extractedData.brokerage),
          sec: parseFloat(extractedData.sec),
          exchange: parseFloat(extractedData.exchange),
          cds: parseFloat(extractedData.cds),
          gov_cess: parseFloat(extractedData.gov_cess),
          clearing_fees: parseFloat(extractedData.clearing_fees),
          net_amount: parseFloat(extractedData.net_amount),
          foreign_brokerage: parseFloat(extractedData.foreign_brokerage)
        })
        .select()
        .single();

      if (insertError) throw insertError;

      const entity = entities.find(e => e.id === selectedTransaction.entity_id);
      if (!entity) {
        alert('Entity not found');
        return;
      }

      const netAmount = parseFloat(extractedData.net_amount);
      const transactionType = selectedTransaction.transaction_type === 'Buy' ? 'Deduction' : 'Addition';

      const { data: existingTransactions } = await supabase
        .from('cash_balance_ledger')
        .select('running_balance')
        .eq('entity_id', entity.entity_id)
        .order('timestamp', { ascending: false })
        .limit(1);

      const lastBalance = existingTransactions && existingTransactions.length > 0
        ? Number(existingTransactions[0].running_balance)
        : 0;

      const newBalance = transactionType === 'Addition'
        ? lastBalance + netAmount
        : lastBalance - netAmount;

      const { error: ledgerError } = await supabase
        .from('cash_balance_ledger')
        .insert({
          type: transactionType,
          description: `${selectedTransaction.transaction_type} - ${extractedData.contract_no}`,
          code: extractedData.contract_no,
          amount: netAmount,
          date: extractedData.trade_date,
          running_balance: newBalance,
          on_hold_amount: 0,
          entity_id: entity.entity_id,
          bank_id: null,
          reference_id: insertedNote?.id || null,
          created_by: 'System',
          notes: formData.remarks || null
        });

      if (ledgerError) throw ledgerError;

      await loadData();
      handleCloseModals();
      alert('Buy/Sell note processed successfully! Cash balance has been updated.');
    } catch (error) {
      console.error('Error processing note:', error);
      alert('Failed to process note');
    }
  }

  function handleReject() {
    if (!confirm('Are you sure you want to reject this upload?')) return;
    handleCloseModals();
  }

  function handleCloseModals() {
    setShowModal(false);
    setShowProcessModal(false);
    setUploadedFile(null);
    setExtractedData({
      trade_date: '',
      contract_no: '',
      no_of_shares: '',
      price_avg: '',
      gross_amount: '',
      brokerage: '',
      sec: '',
      exchange: '',
      cds: '',
      gov_cess: '',
      clearing_fees: '',
      net_amount: '',
      settlement: '',
      foreign_brokerage: ''
    });
    setFormData({
      transaction_id: '',
      broker_id: '',
      dealer_name: '',
      entity_account_number: '',
      settlement_date: new Date().toISOString().split('T')[0],
      remarks: ''
    });
    setValidationIssues([]);
    setTotals({
      total_shares: 0,
      total_price_avg: 0,
      total_gross: 0,
      total_brokerage: 0,
      total_sec: 0,
      total_exchange: 0,
      total_cds: 0,
      total_gov_cess: 0,
      total_clearing: 0,
      total_net: 0,
      purchase_total: 0,
      sales_total: 0,
      net_settlement: 0
    });
  }

  function getTransactionDisplay(transactionId: string) {
    const transaction = transactions.find(t => t.id === transactionId);
    if (!transaction) return 'N/A';

    const entity = entities.find(e => e.id === transaction.entity_id);
    const share = shares.find(s => s.id === transaction.share_id);

    return `${transaction.transaction_type} - ${share?.ticker || 'N/A'} - ${entity?.name || 'N/A'} - ${transaction.no_of_shares} shares`;
  }

  const filteredNotes = notes.filter(note =>
    note.note_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    note.dealer_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const availableEntityAccounts = formData.broker_id && formData.transaction_id
    ? (() => {
        const transaction = transactions.find(t => t.id === formData.transaction_id);
        if (!transaction) return [];
        const entity = entities.find(e => e.id === transaction.entity_id);
        if (!entity) return [];
        return entityBrokers.filter(eb =>
          eb.entity_id === entity.entity_id && eb.broker_id === formData.broker_id
        );
      })()
    : [];

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
            <span>Upload Note</span>
          </button>
        </div>
        <p className="text-gray-600">Upload and process contract notes for approved buy/sell transactions</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6 p-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search by contract number or dealer name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Contract No</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Type</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Trade Date</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Shares</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Price</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Net Amount</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Settlement</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredNotes.map((note) => (
                <tr key={note.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-bold text-blue-600">{note.contract_no}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                      note.note_type === 'Buy' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {note.note_type}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {note.trade_date ? new Date(note.trade_date).toLocaleDateString() : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {note.no_of_shares?.toLocaleString() || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    Rs. {note.price_avg?.toFixed(2) || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                    Rs. {note.net_amount?.toLocaleString(undefined, { minimumFractionDigits: 2 }) || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {new Date(note.settlement_date).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                      <Eye className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
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
          <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4">
              <h2 className="text-xl font-bold text-gray-900">Upload Buy/Sell Note</h2>
            </div>

            <div className="p-6 space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  This should be the list of approved buy/sell requests
                </p>
              </div>

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
                  <option value="">Select approved transaction</option>
                  {transactions.map((transaction) => (
                    <option key={transaction.id} value={transaction.id}>
                      {getTransactionDisplay(transaction.id)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  From - Broker <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.broker_id}
                  onChange={(e) => setFormData({ ...formData, broker_id: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Select broker</option>
                  {brokers.map((broker) => (
                    <option key={broker.id} value={broker.id}>
                      {broker.broker_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  From - Dealer Name
                </label>
                <input
                  type="text"
                  value={formData.dealer_name}
                  onChange={(e) => setFormData({ ...formData, dealer_name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter dealer name"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  To / Entity <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.transaction_id ? (() => {
                    const transaction = transactions.find(t => t.id === formData.transaction_id);
                    if (!transaction) return '';
                    const entity = entities.find(e => e.id === transaction.entity_id);
                    return entity?.name || '';
                  })() : ''}
                  disabled
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500"
                  placeholder="Auto-filled from transaction"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Client A/C Number <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.entity_account_number}
                  onChange={(e) => setFormData({ ...formData, entity_account_number: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={availableEntityAccounts.length === 0}
                  required
                >
                  <option value="">Select account (CDS or Broker)</option>
                  {availableEntityAccounts.map((eb) => (
                    <option key={eb.id} value={eb.account_number}>
                      {eb.cds_account ? `CDS: ${eb.cds_account}` : `Broker: ${eb.account_number}`}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-blue-600 mt-1">
                  Drop down from CDS or Broker Acc. list (Not the bank acc. list)
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Transaction Date
                </label>
                <input
                  type="text"
                  value={extractedData.trade_date || 'From PDF'}
                  disabled
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500"
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
                <p className="text-xs text-red-600 mt-1">
                  This is the date that should be considered in the reports
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Upload buy/sell document <span className="text-red-500">*</span>
                </label>
                <div className="flex items-center space-x-2">
                  <Upload className="w-5 h-5 text-gray-400" />
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={handleFileUpload}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">Uploads the below pdf</p>
                {isExtracting && (
                  <div className="mt-2 text-sm text-blue-600">Extracting data from PDF...</div>
                )}
                {uploadedFile && !isExtracting && (
                  <div className="mt-2 text-sm text-green-600 flex items-center">
                    <CheckCircle className="w-4 h-4 mr-1" />
                    File uploaded: {uploadedFile.name}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Remarks</label>
                <textarea
                  value={formData.remarks}
                  onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                  rows={2}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Additional notes..."
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={handleCloseModals}
                  className="px-6 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleProcessClick}
                  disabled={!uploadedFile || isExtracting}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  Process
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showProcessModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-5xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4">
              <h2 className="text-xl font-bold text-gray-900">Validate & Process Contract Note</h2>
            </div>

            <div className="p-6 space-y-6">
              {validationIssues.length > 0 && (
                <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4">
                  <div className="flex items-start space-x-2">
                    <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
                    <div>
                      <h3 className="font-semibold text-red-800 mb-2">Validation Issues Detected</h3>
                      <ul className="list-disc list-inside space-y-1 text-sm text-red-700">
                        {validationIssues.map((issue, idx) => (
                          <li key={idx}>{issue}</li>
                        ))}
                      </ul>
                      <p className="text-xs text-red-600 mt-2 font-semibold">
                        These mismatches require approval before processing
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="border border-gray-300 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-4 py-2 text-left font-semibold text-gray-700">Field Name</th>
                      <th className="px-4 py-2 text-left font-semibold text-gray-700">Value</th>
                      <th className="px-4 py-2 text-left font-semibold text-gray-700">Comments</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    <tr className={validationIssues.some(i => i.includes('Trade Date')) ? 'bg-yellow-50' : ''}>
                      <td className="px-4 py-2 font-medium text-gray-900">Trade Date</td>
                      <td className="px-4 py-2 text-gray-700">{extractedData.trade_date || '-'}</td>
                      <td className="px-4 py-2 text-gray-500 text-xs">Front the file</td>
                    </tr>
                    <tr className={validationIssues.some(i => i.includes('Contract No')) ? 'bg-yellow-50' : ''}>
                      <td className="px-4 py-2 font-medium text-gray-900">Contract No</td>
                      <td className="px-4 py-2 text-gray-700">{extractedData.contract_no || '-'}</td>
                      <td className="px-4 py-2 text-gray-500 text-xs">Front the file</td>
                    </tr>
                    <tr className={validationIssues.some(i => i.includes('No of Shares')) ? 'bg-red-50' : ''}>
                      <td className="px-4 py-2 font-medium text-gray-900">No of Shares</td>
                      <td className="px-4 py-2 text-gray-700">{extractedData.no_of_shares || '-'}</td>
                      <td className="px-4 py-2 text-red-600 text-xs">
                        {validationIssues.some(i => i.includes('No of Shares'))
                          ? 'If this is not equal with original amount it should be highlighted and provide option to reject'
                          : 'Front the file'}
                      </td>
                    </tr>
                    <tr className={validationIssues.some(i => i.includes('Price')) ? 'bg-red-50' : ''}>
                      <td className="px-4 py-2 font-medium text-gray-900">Price/Avg</td>
                      <td className="px-4 py-2 text-gray-700">Rs. {extractedData.price_avg || '-'}</td>
                      <td className="px-4 py-2 text-red-600 text-xs">
                        {validationIssues.some(i => i.includes('Price'))
                          ? 'If this is not equal with original amount it should be highlighted and provide option to reject'
                          : 'Front the file'}
                      </td>
                    </tr>
                    <tr className={validationIssues.some(i => i.includes('Gross')) ? 'bg-yellow-50' : ''}>
                      <td className="px-4 py-2 font-medium text-gray-900">Gross Amount</td>
                      <td className="px-4 py-2 text-gray-700">Rs. {extractedData.gross_amount || '-'}</td>
                      <td className="px-4 py-2 text-gray-500 text-xs">Front the file</td>
                    </tr>
                    <tr className={validationIssues.some(i => i.includes('Brokerage')) ? 'bg-red-50' : ''}>
                      <td className="px-4 py-2 font-medium text-gray-900">Brokerage</td>
                      <td className="px-4 py-2 text-gray-700">Rs. {extractedData.brokerage || '-'}</td>
                      <td className="px-4 py-2 text-red-600 text-xs">
                        {validationIssues.some(i => i.includes('Brokerage'))
                          ? 'If this is not equal with the applicable rate it should be highlighted and send this upload for approval'
                          : 'Front the file'}
                      </td>
                    </tr>
                    <tr className={validationIssues.some(i => i.includes('SEC')) ? 'bg-red-50' : ''}>
                      <td className="px-4 py-2 font-medium text-gray-900">SEC</td>
                      <td className="px-4 py-2 text-gray-700">Rs. {extractedData.sec || '-'}</td>
                      <td className="px-4 py-2 text-red-600 text-xs">
                        {validationIssues.some(i => i.includes('SEC'))
                          ? 'If this is not equal with the applicable rate it should be highlighted and send this upload for approval'
                          : 'Front the file'}
                      </td>
                    </tr>
                    <tr className={validationIssues.some(i => i.includes('Exchange')) ? 'bg-red-50' : ''}>
                      <td className="px-4 py-2 font-medium text-gray-900">Exchange</td>
                      <td className="px-4 py-2 text-gray-700">Rs. {extractedData.exchange || '-'}</td>
                      <td className="px-4 py-2 text-red-600 text-xs">
                        {validationIssues.some(i => i.includes('Exchange'))
                          ? 'If this is not equal with the applicable rate it should be highlighted and send this upload for approval'
                          : 'Front the file'}
                      </td>
                    </tr>
                    <tr className={validationIssues.some(i => i.includes('CDS')) ? 'bg-red-50' : ''}>
                      <td className="px-4 py-2 font-medium text-gray-900">CDS</td>
                      <td className="px-4 py-2 text-gray-700">Rs. {extractedData.cds || '-'}</td>
                      <td className="px-4 py-2 text-red-600 text-xs">
                        {validationIssues.some(i => i.includes('CDS'))
                          ? 'If this is not equal with the applicable rate it should be highlighted and send this upload for approval'
                          : 'Front the file'}
                      </td>
                    </tr>
                    <tr className={validationIssues.some(i => i.includes('GOV CESS')) ? 'bg-red-50' : ''}>
                      <td className="px-4 py-2 font-medium text-gray-900">GOV CESS</td>
                      <td className="px-4 py-2 text-gray-700">Rs. {extractedData.gov_cess || '-'}</td>
                      <td className="px-4 py-2 text-red-600 text-xs">
                        {validationIssues.some(i => i.includes('GOV CESS'))
                          ? 'If this is not equal with the applicable rate it should be highlighted and send this upload for approval'
                          : 'Front the file'}
                      </td>
                    </tr>
                    <tr className={validationIssues.some(i => i.includes('Clearing')) ? 'bg-red-50' : ''}>
                      <td className="px-4 py-2 font-medium text-gray-900">Clearing Fees</td>
                      <td className="px-4 py-2 text-gray-700">Rs. {extractedData.clearing_fees || '-'}</td>
                      <td className="px-4 py-2 text-red-600 text-xs">
                        {validationIssues.some(i => i.includes('Clearing'))
                          ? 'If this is not equal with the applicable rate it should be highlighted and send this upload for approval'
                          : 'Front the file'}
                      </td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2 font-medium text-gray-900">Net Amount</td>
                      <td className="px-4 py-2 text-gray-700">Rs. {extractedData.net_amount || '-'}</td>
                      <td className="px-4 py-2 text-gray-500 text-xs">Front the file</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2 font-medium text-gray-900">Settlement</td>
                      <td className="px-4 py-2 text-gray-700">{extractedData.settlement || '-'}</td>
                      <td className="px-4 py-2 text-gray-500 text-xs">Front the file</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2 font-medium text-gray-900">Foreign Brokerage</td>
                      <td className="px-4 py-2 text-gray-700">Rs. {extractedData.foreign_brokerage || '-'}</td>
                      <td className="px-4 py-2 text-gray-500 text-xs">Front the file</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="bg-green-50 border border-green-300 rounded-lg p-4">
                <h3 className="font-semibold text-green-800 mb-3">Total Figures</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex justify-between">
                    <span className="text-green-700">Total - No of shares:</span>
                    <span className="font-semibold text-green-900">{totals.total_shares}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-green-700">Total Price / Avg:</span>
                    <span className="font-semibold text-green-900">Rs. {totals.total_price_avg.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-green-700">Total Gross Amount:</span>
                    <span className="font-semibold text-green-900">Rs. {totals.total_gross.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-green-700">Total Brokerage:</span>
                    <span className="font-semibold text-green-900">Rs. {totals.total_brokerage.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-green-700">Total SEC:</span>
                    <span className="font-semibold text-green-900">Rs. {totals.total_sec.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-green-700">Total Exchange:</span>
                    <span className="font-semibold text-green-900">Rs. {totals.total_exchange.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-green-700">Total CDS:</span>
                    <span className="font-semibold text-green-900">Rs. {totals.total_cds.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-green-700">Total Gov Cess:</span>
                    <span className="font-semibold text-green-900">Rs. {totals.total_gov_cess.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-green-700">Total Clearing Fess:</span>
                    <span className="font-semibold text-green-900">Rs. {totals.total_clearing.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-green-700">Total - Net Amount:</span>
                    <span className="font-semibold text-green-900">Rs. {totals.total_net.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between border-t-2 border-green-400 pt-2">
                    <span className="text-green-700">Purchase Total:</span>
                    <span className="font-semibold text-green-900">Rs. {totals.purchase_total.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between border-t-2 border-green-400 pt-2">
                    <span className="text-green-700">Sales Total:</span>
                    <span className="font-semibold text-green-900">Rs. {totals.sales_total.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between col-span-2 border-t-2 border-green-400 pt-2">
                    <span className="text-green-700 font-bold">Net Settlement Value:</span>
                    <span className="font-bold text-green-900 text-lg">Rs. {totals.net_settlement.toFixed(2)}</span>
                  </div>
                </div>
                <p className="text-xs text-green-600 mt-3">
                  These 3 fields should be visible clearly. Better to separate with other fields.
                </p>
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={handleReject}
                  className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center space-x-2"
                >
                  <XCircle className="w-4 h-4" />
                  <span>Reject</span>
                </button>
                <button
                  type="button"
                  onClick={handleApproval}
                  className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2"
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>Approval</span>
                </button>
                <button
                  type="button"
                  onClick={handleApproval}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Process
                </button>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-xs text-gray-600">
                <p className="mb-1">Updates the cashflow - Sell -&gt; Current and available funds</p>
                <p>Updates the cashflow - Buy -&gt; Release the onhold funds</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
