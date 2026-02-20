import { Plus, Search, Filter, TrendingUp, TrendingDown, Send, CheckCircle, XCircle, Eye, Printer, Upload, Clock } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

interface Transaction {
  id: string;
  entity_id: string;
  broker_id: string | null;
  bank_id: string | null;
  share_id: string;
  cds_account_id: string | null;
  transaction_type: string;
  order_type: string;
  transaction_date: string;
  no_of_shares: number;
  price_per_share: number;
  total_amount_gross: number;
  brokerage_fee_type_id: string | null;
  brokerage_fee_rate: number | null;
  fees: number;
  net_price_per_share: number;
  total_amount: number;
  approval_status: string;
  submitted_for_approval_at: string | null;
  approval_validity_hours: number | null;
  approval_expires_at: string | null;
  submitted_by: string | null;
  approved_by: string | null;
  approval_date: string | null;
  approval_notes: string | null;
  rejection_reason: string | null;
  approval_document_url: string | null;
  approval_document_name: string | null;
  approval_document_uploaded_at: string | null;
  approval_document_uploaded_by: string | null;
  offline_approval: boolean | null;
  created_at: string;
}

interface Entity {
  id: string;
  name: string;
  current_balance: number;
}

interface Share {
  id: string;
  name: string;
  ticker: string;
}

interface Bank {
  id: string;
  name: string;
  account_number: string;
  balance: number;
}

interface Broker {
  id: string;
  broker_name: string;
}

interface BrokerageFeeType {
  id: string;
  name: string;
  rate: number;
  min_price: number | null;
  max_price: number | null;
}

interface ShareBalance {
  share_id: string;
  total_shares: number;
  avg_cost: number;
}

interface EntityBroker {
  id: string;
  entity_id: string;
  broker_id: string;
  relationship_type: string;
  custodian_account_number: string | null;
  broker_account_number: string | null;
  broker_name_id: string | null;
}

export function Transactions() {
  const [activeTab, setActiveTab] = useState<'all' | 'pending'>('all');
  const [showModal, setShowModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [showApprovalActionModal, setShowApprovalActionModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [shares, setShares] = useState<Share[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [brokerageFeeTypes, setBrokerageFeeTypes] = useState<BrokerageFeeType[]>([]);
  const [entityBrokers, setEntityBrokers] = useState<EntityBroker[]>([]);
  const [shareBalances, setShareBalances] = useState<Map<string, ShareBalance>>(new Map());
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [selectedTransactions, setSelectedTransactions] = useState<Set<string>>(new Set());
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [approvalAction, setApprovalAction] = useState<'APPROVE' | 'REJECT'>('APPROVE');
  const [validityHours, setValidityHours] = useState('24');
  const [approvalNotes, setApprovalNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    entity_id: '',
    relationship_type: 'BROKER',
    entity_broker_id: '',
    selected_broker_name_id: '',
    share_id: '',
    transaction_type: 'BUY',
    order_type: 'DAY',
    transaction_date: new Date().toISOString().split('T')[0],
    no_of_shares: '',
    price_per_share: '',
    brokerage_fee_type_id: '',
    brokerage_fee_rate: '',
    fees: '',
    use_negotiated_fee: false
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (formData.entity_id && formData.share_id) {
      calculateShareBalance(formData.entity_id, formData.share_id);
    }
  }, [formData.entity_id, formData.share_id]);

  useEffect(() => {
    if (formData.no_of_shares && formData.price_per_share) {
      const totalAmount = parseFloat(formData.no_of_shares) * parseFloat(formData.price_per_share);

      if (!formData.use_negotiated_fee) {
        const matchingFeeType = brokerageFeeTypes.find(ft => {
          const minOk = ft.min_price === null || totalAmount >= ft.min_price;
          const maxOk = ft.max_price === null || totalAmount <= ft.max_price;
          return minOk && maxOk;
        });

        if (matchingFeeType) {
          setFormData(prev => ({
            ...prev,
            brokerage_fee_type_id: matchingFeeType.id,
            brokerage_fee_rate: matchingFeeType.rate.toString()
          }));
          calculateFees(matchingFeeType.rate);
        }
      } else if (formData.brokerage_fee_rate) {
        calculateFees(parseFloat(formData.brokerage_fee_rate));
      }
    }
  }, [formData.no_of_shares, formData.price_per_share, formData.use_negotiated_fee, brokerageFeeTypes]);

  async function loadData() {
    try {
      setLoading(true);

      const [transactionsRes, entitiesRes, sharesRes, banksRes, brokersRes, brokerageRes, entityBrokersRes] = await Promise.all([
        supabase.from('transactions').select('*').order('transaction_date', { ascending: false }),
        supabase.from('entities').select('id, name, current_balance').order('name'),
        supabase.from('shares').select('id, name, ticker').order('name'),
        supabase.from('banks').select('id, name, account_number, balance').order('name'),
        supabase.from('brokers').select('id, broker_name').eq('is_active', true).order('broker_name'),
        supabase.from('brokerage_fee_types').select('*').eq('is_active', true).order('min_price'),
        supabase.from('entity_brokers').select('*').eq('is_active', true)
      ]);

      if (transactionsRes.error) throw transactionsRes.error;
      if (entitiesRes.error) throw entitiesRes.error;
      if (sharesRes.error) throw sharesRes.error;
      if (banksRes.error) throw banksRes.error;
      if (brokersRes.error) throw brokersRes.error;
      if (brokerageRes.error) throw brokerageRes.error;
      if (entityBrokersRes.error) throw entityBrokersRes.error;

      setTransactions(transactionsRes.data || []);
      setEntities(entitiesRes.data || []);
      setShares(sharesRes.data || []);
      setBanks(banksRes.data || []);
      setBrokers(brokersRes.data || []);
      setBrokerageFeeTypes(brokerageRes.data || []);
      setEntityBrokers(entityBrokersRes.data || []);
    } catch (error) {
      console.error('Error loading data:', error);
      alert('Failed to load data');
    } finally {
      setLoading(false);
    }
  }

  async function calculateShareBalance(entityId: string, shareId: string) {
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('transaction_type, no_of_shares, price_per_share')
        .eq('entity_id', entityId)
        .eq('share_id', shareId);

      if (error) throw error;

      let totalShares = 0;
      let totalCost = 0;

      (data || []).forEach(txn => {
        const shares = Number(txn.no_of_shares) || 0;
        const price = Number(txn.price_per_share) || 0;

        if (txn.transaction_type === 'BUY') {
          totalShares += shares;
          totalCost += shares * price;
        } else if (txn.transaction_type === 'SELL') {
          totalShares -= shares;
        }
      });

      const avgCost = totalShares > 0 ? totalCost / totalShares : 0;

      setShareBalances(prev => new Map(prev).set(`${entityId}-${shareId}`, {
        share_id: shareId,
        total_shares: totalShares,
        avg_cost: avgCost
      }));
    } catch (error) {
      console.error('Error calculating share balance:', error);
    }
  }

  function calculateFees(rate: number) {
    const shares = parseFloat(formData.no_of_shares) || 0;
    const price = parseFloat(formData.price_per_share) || 0;
    const grossAmount = shares * price;
    const fees = (grossAmount * rate) / 100;
    setFormData(prev => ({ ...prev, fees: fees.toFixed(2) }));
  }

  function calculateTotalAmountGross() {
    const shares = parseFloat(formData.no_of_shares) || 0;
    const price = parseFloat(formData.price_per_share) || 0;
    return shares * price;
  }

  function calculateNetPricePerShare() {
    const shares = parseFloat(formData.no_of_shares) || 0;
    const price = parseFloat(formData.price_per_share) || 0;
    const fees = parseFloat(formData.fees) || 0;
    if (shares === 0) return 0;

    const grossAmount = shares * price;
    const netAmount = formData.transaction_type === 'BUY' ? grossAmount + fees : grossAmount - fees;
    return netAmount / shares;
  }

  function calculateTotalAmountNet() {
    const grossAmount = calculateTotalAmountGross();
    const fees = parseFloat(formData.fees) || 0;
    return formData.transaction_type === 'BUY' ? grossAmount + fees : grossAmount - fees;
  }

  function calculateAverageCostWithPurchase() {
    const key = `${formData.entity_id}-${formData.share_id}`;
    const balance = shareBalances.get(key);

    if (!balance) return 0;

    const newShares = parseFloat(formData.no_of_shares) || 0;
    const newPrice = parseFloat(formData.price_per_share) || 0;

    if (formData.transaction_type === 'BUY') {
      const totalShares = balance.total_shares + newShares;
      const totalCost = (balance.total_shares * balance.avg_cost) + (newShares * newPrice);
      return totalShares > 0 ? totalCost / totalShares : 0;
    } else {
      return balance.avg_cost;
    }
  }

  function getEntityName(entityId: string) {
    return entities.find(e => e.id === entityId)?.name || 'Unknown';
  }

  function getEntityBalance(entityId: string) {
    return entities.find(e => e.id === entityId)?.current_balance || 0;
  }

  function getBalanceColor(balance: number, requiredAmount: number) {
    if (balance >= requiredAmount * 1.5) return 'text-green-600';
    if (balance >= requiredAmount) return 'text-yellow-600';
    return 'text-red-600';
  }

  function getBalanceStatus(balance: number, requiredAmount: number) {
    if (balance >= requiredAmount * 1.5) return 'Excellent';
    if (balance >= requiredAmount) return 'Sufficient';
    return 'Insufficient';
  }

  function getBrokerName(brokerId: string | null) {
    if (!brokerId) return '-';
    return brokers.find(b => b.id === brokerId)?.broker_name || 'Unknown';
  }

  function getShareInfo(shareId: string) {
    const share = shares.find(s => s.id === shareId);
    return share ? `${share.ticker} - ${share.name}` : 'Unknown';
  }

  function resetForm() {
    setFormData({
      entity_id: '',
      relationship_type: 'BROKER',
      entity_broker_id: '',
      selected_broker_name_id: '',
      share_id: '',
      transaction_type: 'BUY',
      order_type: 'DAY',
      transaction_date: new Date().toISOString().split('T')[0],
      no_of_shares: '',
      price_per_share: '',
      brokerage_fee_type_id: '',
      brokerage_fee_rate: '',
      fees: '',
      use_negotiated_fee: false
    });
  }

  async function handleCreateTransaction(e: React.FormEvent) {
    e.preventDefault();

    if (!formData.entity_id || !formData.share_id || !formData.no_of_shares || !formData.price_per_share) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      setSubmitting(true);

      const totalAmountGross = calculateTotalAmountGross();
      const netPricePerShare = calculateNetPricePerShare();
      const totalAmountNet = calculateTotalAmountNet();

      const selectedEntityBroker = entityBrokers.find(eb => eb.id === formData.entity_broker_id);

      const { error } = await supabase.from('transactions').insert({
        entity_id: formData.entity_id,
        broker_id: selectedEntityBroker?.broker_id || null,
        bank_id: null,
        cds_account_id: selectedEntityBroker?.relationship_type === 'CUSTODIAN'
          ? selectedEntityBroker?.custodian_account_number
          : selectedEntityBroker?.broker_account_number,
        share_id: formData.share_id,
        transaction_type: formData.transaction_type,
        order_type: formData.order_type,
        transaction_date: formData.transaction_date,
        no_of_shares: parseFloat(formData.no_of_shares),
        price_per_share: parseFloat(formData.price_per_share),
        total_amount_gross: totalAmountGross,
        brokerage_fee_type_id: formData.brokerage_fee_type_id || null,
        brokerage_fee_rate: formData.brokerage_fee_rate ? parseFloat(formData.brokerage_fee_rate) : null,
        fees: parseFloat(formData.fees) || 0,
        net_price_per_share: netPricePerShare,
        total_amount: totalAmountNet,
        approval_status: 'DRAFT'
      });

      if (error) throw error;

      alert('Transaction created successfully');
      setShowModal(false);
      resetForm();
      loadData();
    } catch (error) {
      console.error('Error creating transaction:', error);
      alert('Failed to create transaction');
    } finally {
      setSubmitting(false);
    }
  }

  function toggleTransactionSelection(transactionId: string) {
    const newSelected = new Set(selectedTransactions);
    if (newSelected.has(transactionId)) {
      newSelected.delete(transactionId);
    } else {
      newSelected.add(transactionId);
    }
    setSelectedTransactions(newSelected);
  }

  function toggleAllTransactions() {
    const currentTransactions = activeTab === 'all'
      ? filteredTransactions.filter(t => t.approval_status === 'DRAFT')
      : [];

    if (selectedTransactions.size === currentTransactions.length && currentTransactions.length > 0) {
      setSelectedTransactions(new Set());
    } else {
      const allIds = currentTransactions.map(t => t.id);
      setSelectedTransactions(new Set(allIds));
    }
  }

  async function handleSendForApproval() {
    if (selectedTransactions.size === 0) {
      alert('Please select at least one transaction');
      return;
    }

    if (!validityHours || parseFloat(validityHours) <= 0) {
      alert('Please enter a valid duration');
      return;
    }

    try {
      setSubmitting(true);

      const hours = parseFloat(validityHours);
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + hours);

      const updates = Array.from(selectedTransactions).map(id =>
        supabase.from('transactions').update({
          approval_status: 'PENDING_APPROVAL',
          submitted_for_approval_at: new Date().toISOString(),
          approval_validity_hours: hours,
          approval_expires_at: expiresAt.toISOString(),
          submitted_by: 'Current User',
          updated_at: new Date().toISOString()
        }).eq('id', id)
      );

      const results = await Promise.all(updates);
      const errors = results.filter(r => r.error);

      if (errors.length > 0) {
        throw new Error('Some transactions failed to update');
      }

      alert(`${selectedTransactions.size} transaction(s) sent for approval`);
      setShowApprovalModal(false);
      setSelectedTransactions(new Set());
      setValidityHours('24');
      loadData();
    } catch (error) {
      console.error('Error sending for approval:', error);
      alert('Failed to send for approval');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleApprovalAction() {
    if (!selectedTransaction) return;

    if (approvalAction === 'REJECT' && !rejectionReason.trim()) {
      alert('Please provide a rejection reason');
      return;
    }

    try {
      setSubmitting(true);

      const updateData: any = {
        approval_status: approvalAction === 'APPROVE' ? 'APPROVED' : 'REJECTED',
        approved_by: 'Approver User',
        approval_date: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      if (approvalAction === 'APPROVE') {
        updateData.approval_notes = approvalNotes;
      } else {
        updateData.rejection_reason = rejectionReason;
      }

      const { error } = await supabase
        .from('transactions')
        .update(updateData)
        .eq('id', selectedTransaction.id);

      if (error) throw error;

      alert(`Transaction ${approvalAction === 'APPROVE' ? 'approved' : 'rejected'} successfully`);
      setShowApprovalActionModal(false);
      setSelectedTransaction(null);
      setApprovalNotes('');
      setRejectionReason('');
      loadData();
    } catch (error) {
      console.error('Error processing approval:', error);
      alert('Failed to process approval');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUploadApproval() {
    if (!selectedTransaction || !uploadFile) {
      alert('Please select a file to upload');
      return;
    }

    try {
      setSubmitting(true);

      const fileExt = uploadFile.name.split('.').pop();
      const fileName = `${selectedTransaction.id}_${Date.now()}.${fileExt}`;
      const filePath = `approvals/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, uploadFile);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('documents')
        .getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from('transactions')
        .update({
          approval_status: 'APPROVED',
          approved_by: 'Offline Approver',
          approval_date: new Date().toISOString(),
          offline_approval: true,
          approval_document_url: publicUrl,
          approval_document_name: uploadFile.name,
          approval_document_uploaded_at: new Date().toISOString(),
          approval_document_uploaded_by: 'Current User',
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedTransaction.id);

      if (updateError) throw updateError;

      alert('Approval document uploaded successfully');
      setShowUploadModal(false);
      setSelectedTransaction(null);
      setUploadFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      loadData();
    } catch (error) {
      console.error('Error uploading approval:', error);
      alert('Failed to upload approval document');
    } finally {
      setSubmitting(false);
    }
  }

  function handlePrintApproval(transaction: Transaction) {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Transaction Approval Request - ${transaction.id}</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              padding: 40px;
              max-width: 800px;
              margin: 0 auto;
            }
            .header {
              text-align: center;
              border-bottom: 2px solid #333;
              padding-bottom: 20px;
              margin-bottom: 30px;
            }
            .header h1 {
              margin: 0;
              font-size: 24px;
            }
            .section {
              margin-bottom: 30px;
            }
            .section h2 {
              font-size: 18px;
              border-bottom: 1px solid #ccc;
              padding-bottom: 10px;
              margin-bottom: 15px;
            }
            .field {
              display: flex;
              margin-bottom: 10px;
            }
            .field-label {
              font-weight: bold;
              width: 200px;
            }
            .field-value {
              flex: 1;
            }
            .signature-section {
              margin-top: 60px;
              display: flex;
              justify-content: space-between;
            }
            .signature-box {
              width: 45%;
            }
            .signature-line {
              border-top: 1px solid #333;
              margin-top: 60px;
              padding-top: 10px;
              text-align: center;
            }
            @media print {
              body {
                padding: 20px;
              }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Transaction Approval Request</h1>
            <p>Reference: ${transaction.id}</p>
          </div>

          <div class="section">
            <h2>Transaction Details</h2>
            <div class="field">
              <div class="field-label">Entity:</div>
              <div class="field-value">${getEntityName(transaction.entity_id)}</div>
            </div>
            <div class="field">
              <div class="field-label">Transaction Type:</div>
              <div class="field-value">${transaction.transaction_type}</div>
            </div>
            <div class="field">
              <div class="field-label">Order Type:</div>
              <div class="field-value">${transaction.order_type}</div>
            </div>
            <div class="field">
              <div class="field-label">Transaction Date:</div>
              <div class="field-value">${new Date(transaction.transaction_date).toLocaleDateString()}</div>
            </div>
            <div class="field">
              <div class="field-label">Share:</div>
              <div class="field-value">${getShareInfo(transaction.share_id)}</div>
            </div>
            <div class="field">
              <div class="field-label">Number of Shares:</div>
              <div class="field-value">${Number(transaction.no_of_shares).toLocaleString()}</div>
            </div>
            <div class="field">
              <div class="field-label">Price Per Share:</div>
              <div class="field-value">LKR ${Number(transaction.price_per_share).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
            </div>
          </div>

          <div class="section">
            <h2>Financial Summary</h2>
            <div class="field">
              <div class="field-label">Total Amount (Gross):</div>
              <div class="field-value">LKR ${Number(transaction.total_amount_gross).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
            </div>
            <div class="field">
              <div class="field-label">Brokerage Fee:</div>
              <div class="field-value">LKR ${Number(transaction.fees).toLocaleString(undefined, { minimumFractionDigits: 2 })} ${transaction.brokerage_fee_rate ? `(${transaction.brokerage_fee_rate}%)` : ''}</div>
            </div>
            <div class="field">
              <div class="field-label">Net Price Per Share:</div>
              <div class="field-value">LKR ${Number(transaction.net_price_per_share).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
            </div>
            <div class="field">
              <div class="field-label"><strong>Total Amount (Net):</strong></div>
              <div class="field-value"><strong>LKR ${Number(transaction.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong></div>
            </div>
          </div>

          <div class="section">
            <h2>Approval Information</h2>
            <div class="field">
              <div class="field-label">Submitted By:</div>
              <div class="field-value">${transaction.submitted_by || 'N/A'}</div>
            </div>
            <div class="field">
              <div class="field-label">Submitted On:</div>
              <div class="field-value">${transaction.submitted_for_approval_at ? new Date(transaction.submitted_for_approval_at).toLocaleString() : 'N/A'}</div>
            </div>
            <div class="field">
              <div class="field-label">Valid Until:</div>
              <div class="field-value">${transaction.approval_expires_at ? new Date(transaction.approval_expires_at).toLocaleString() : 'N/A'}</div>
            </div>
          </div>

          <div class="signature-section">
            <div class="signature-box">
              <div class="signature-line">Requested By</div>
            </div>
            <div class="signature-box">
              <div class="signature-line">Approved By</div>
            </div>
          </div>

          <script>
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  }

  function getTimeRemaining(transaction: Transaction): string {
    if (!transaction.approval_expires_at) return '';

    const now = new Date();
    const expiresAt = new Date(transaction.approval_expires_at);
    const diffMs = expiresAt.getTime() - now.getTime();

    if (diffMs <= 0) return 'Expired';

    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (diffHours > 24) {
      const days = Math.floor(diffHours / 24);
      return `${days}d ${diffHours % 24}h`;
    } else if (diffHours > 0) {
      return `${diffHours}h ${diffMinutes}m`;
    } else {
      return `${diffMinutes}m`;
    }
  }

  const filteredTransactions = transactions.filter(txn => {
    const entityName = getEntityName(txn.entity_id).toLowerCase();
    const shareInfo = getShareInfo(txn.share_id).toLowerCase();
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = entityName.includes(searchLower) || shareInfo.includes(searchLower);

    if (activeTab === 'pending') {
      return matchesSearch && txn.approval_status === 'PENDING_APPROVAL';
    }
    return matchesSearch;
  });

  const key = `${formData.entity_id}-${formData.share_id}`;
  const currentBalance = shareBalances.get(key);
  const entityBalance = formData.entity_id ? getEntityBalance(formData.entity_id) : 0;
  const requiredAmount = calculateTotalAmountNet();

  const availableEntityBrokers = formData.entity_id
    ? entityBrokers.filter(eb =>
        eb.entity_id === formData.entity_id &&
        eb.relationship_type === formData.relationship_type
      )
    : [];

  const selectedEntityBroker = entityBrokers.find(eb => eb.id === formData.entity_broker_id);

  const availableBrokerNames = formData.relationship_type === 'CUSTODIAN' ? brokers : [];

  const pendingCount = transactions.filter(t => t.approval_status === 'PENDING_APPROVAL').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Transactions</h1>
          <p className="text-gray-500 mt-1">Manage buy and sell transactions</p>
        </div>
        <div className="flex items-center space-x-3">
          {selectedTransactions.size > 0 && activeTab === 'all' && (
            <button
              onClick={() => setShowApprovalModal(true)}
              className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <Send className="w-5 h-5" />
              <span className="font-medium">Send for Approval ({selectedTransactions.size})</span>
            </button>
          )}
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            <span className="font-medium">New Transaction</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Total Transactions</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">{transactions.length}</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Buy Transactions</p>
              <p className="text-2xl font-bold text-green-600 mt-2">
                {transactions.filter(t => t.transaction_type === 'BUY').length}
              </p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Sell Transactions</p>
              <p className="text-2xl font-bold text-red-600 mt-2">
                {transactions.filter(t => t.transaction_type === 'SELL').length}
              </p>
            </div>
            <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
              <TrendingDown className="w-6 h-6 text-red-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Total Volume</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">
                LKR {transactions.reduce((sum, t) => sum + (Number(t.total_amount) || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200">
        <div className="border-b border-gray-200">
          <div className="flex space-x-1 p-2">
            <button
              onClick={() => {
                setActiveTab('all');
                setSelectedTransactions(new Set());
              }}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              All Transactions
            </button>
            <button
              onClick={() => {
                setActiveTab('pending');
                setSelectedTransactions(new Set());
              }}
              className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2 ${
                activeTab === 'pending'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Clock className="w-4 h-4" />
              <span>Pending Approvals</span>
              {pendingCount > 0 && (
                <span className="px-2 py-0.5 bg-orange-500 text-white text-xs rounded-full">
                  {pendingCount}
                </span>
              )}
            </button>
          </div>
        </div>

        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center space-x-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search transactions..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
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
                {activeTab === 'all' && (
                  <th className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={
                        selectedTransactions.size > 0 &&
                        selectedTransactions.size === filteredTransactions.filter(t => t.approval_status === 'DRAFT').length &&
                        filteredTransactions.filter(t => t.approval_status === 'DRAFT').length > 0
                      }
                      onChange={toggleAllTransactions}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                    />
                  </th>
                )}
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Entity</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Share</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Quantity</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Net Total</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredTransactions.map((transaction) => (
                <tr key={transaction.id} className="hover:bg-gray-50">
                  {activeTab === 'all' && (
                    <td className="px-4 py-4">
                      {transaction.approval_status === 'DRAFT' && (
                        <input
                          type="checkbox"
                          checked={selectedTransactions.has(transaction.id)}
                          onChange={() => toggleTransactionSelection(transaction.id)}
                          className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                        />
                      )}
                    </td>
                  )}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {new Date(transaction.transaction_date).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-bold text-gray-900">{getEntityName(transaction.entity_id)}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                      transaction.transaction_type === 'BUY' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {transaction.transaction_type}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900">{getShareInfo(transaction.share_id)}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                    {Number(transaction.no_of_shares).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900 text-right">
                    LKR {Number(transaction.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex flex-col space-y-1">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        transaction.approval_status === 'APPROVED' ? 'bg-green-100 text-green-800' :
                        transaction.approval_status === 'REJECTED' ? 'bg-red-100 text-red-800' :
                        transaction.approval_status === 'PENDING_APPROVAL' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {transaction.approval_status === 'PENDING_APPROVAL' ? 'PENDING' : transaction.approval_status}
                      </span>
                      {transaction.offline_approval && (
                        <span className="text-xs text-blue-600 font-medium">Offline</span>
                      )}
                      {transaction.approval_status === 'PENDING_APPROVAL' && getTimeRemaining(transaction) && (
                        <span className={`text-xs font-medium ${
                          getTimeRemaining(transaction) === 'Expired' ? 'text-red-600' : 'text-orange-600'
                        }`}>
                          {getTimeRemaining(transaction)}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => {
                          setSelectedTransaction(transaction);
                          setShowViewModal(true);
                        }}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="View Details"
                      >
                        <Eye className="w-5 h-5" />
                      </button>
                      {transaction.approval_status === 'PENDING_APPROVAL' && (
                        <>
                          <button
                            onClick={() => handlePrintApproval(transaction)}
                            className="p-2 text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
                            title="Print Approval Request"
                          >
                            <Printer className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => {
                              setSelectedTransaction(transaction);
                              setShowUploadModal(true);
                            }}
                            className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                            title="Upload Offline Approval"
                          >
                            <Upload className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => {
                              setSelectedTransaction(transaction);
                              setApprovalAction('APPROVE');
                              setShowApprovalActionModal(true);
                            }}
                            className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                            title="Approve"
                          >
                            <CheckCircle className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => {
                              setSelectedTransaction(transaction);
                              setApprovalAction('REJECT');
                              setShowApprovalActionModal(true);
                            }}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Reject"
                          >
                            <XCircle className="w-5 h-5" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredTransactions.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500">No transactions found</p>
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className={`rounded-xl shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col transition-colors ${
            formData.transaction_type === 'BUY' ? 'bg-green-50' : 'bg-red-50'
          }`}>
            <div className={`p-6 border-b ${
              formData.transaction_type === 'BUY' ? 'border-green-200 bg-green-100' : 'border-red-200 bg-red-100'
            }`}>
              <h2 className="text-2xl font-bold text-gray-900">
                New {formData.transaction_type === 'BUY' ? 'Buy' : 'Sell'} Transaction
              </h2>
            </div>
            <form onSubmit={handleCreateTransaction} className="flex flex-col flex-1 min-h-0">
              <div className="p-6 space-y-6 overflow-y-auto bg-white">
                <div className="grid grid-cols-1 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Entity <span className="text-red-600">*</span>
                    </label>
                    <select
                      value={formData.entity_id}
                      onChange={(e) => setFormData({ ...formData, entity_id: e.target.value, entity_broker_id: '' })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      <option value="">Select Entity</option>
                      {entities.map(entity => (
                        <option key={entity.id} value={entity.id}>{entity.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-3 gap-6">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Type <span className="text-red-600">*</span>
                      </label>
                      <select
                        value={formData.relationship_type}
                        onChange={(e) => setFormData({ ...formData, relationship_type: e.target.value, entity_broker_id: '', selected_broker_name_id: '' })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      >
                        <option value="BROKER">Broker</option>
                        <option value="CUSTODIAN">Custodian</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        {formData.relationship_type === 'CUSTODIAN' ? 'CDS Account ID' : 'Broker Account ID'} <span className="text-red-600">*</span>
                      </label>
                      <select
                        value={formData.entity_broker_id}
                        onChange={(e) => setFormData({ ...formData, entity_broker_id: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                        disabled={!formData.entity_id}
                      >
                        <option value="">Select Account</option>
                        {availableEntityBrokers.map(eb => (
                          <option key={eb.id} value={eb.id}>
                            {eb.relationship_type === 'CUSTODIAN' ? eb.custodian_account_number : eb.broker_account_number}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Broker Name {formData.relationship_type === 'CUSTODIAN' && <span className="text-red-600">*</span>}
                      </label>
                      {formData.relationship_type === 'CUSTODIAN' ? (
                        <select
                          value={formData.selected_broker_name_id}
                          onChange={(e) => setFormData({ ...formData, selected_broker_name_id: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          required
                        >
                          <option value="">Select Broker</option>
                          {availableBrokerNames.map(broker => (
                            <option key={broker.id} value={broker.id}>{broker.broker_name}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="text"
                          value={selectedEntityBroker ? getBrokerName(selectedEntityBroker.broker_id) : ''}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100"
                          disabled
                        />
                      )}
                    </div>
                  </div>

                  {entityBalance > 0 && requiredAmount > 0 && formData.transaction_type === 'BUY' && (
                    <div className={`p-4 rounded-lg border-2 ${
                      entityBalance >= requiredAmount * 1.5 ? 'bg-green-50 border-green-300' :
                      entityBalance >= requiredAmount ? 'bg-yellow-50 border-yellow-300' :
                      'bg-red-50 border-red-300'
                    }`}>
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="text-sm font-semibold text-gray-700">Available Balance</p>
                          <p className={`text-2xl font-bold ${getBalanceColor(entityBalance, requiredAmount)}`}>
                            LKR {entityBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-gray-700">Required</p>
                          <p className="text-lg font-bold text-gray-900">
                            LKR {requiredAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </p>
                          <p className={`text-xs font-semibold mt-1 ${getBalanceColor(entityBalance, requiredAmount)}`}>
                            {getBalanceStatus(entityBalance, requiredAmount)}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-3 gap-6">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Transaction Type <span className="text-red-600">*</span>
                      </label>
                      <select
                        value={formData.transaction_type}
                        onChange={(e) => setFormData({ ...formData, transaction_type: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      >
                        <option value="BUY">BUY</option>
                        <option value="SELL">SELL</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Order Type <span className="text-red-600">*</span>
                      </label>
                      <select
                        value={formData.order_type}
                        onChange={(e) => setFormData({ ...formData, order_type: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      >
                        <option value="DAY">Day Order</option>
                        <option value="GTC">GTC (Good Till Cancelled)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Transaction Date <span className="text-red-600">*</span>
                      </label>
                      <input
                        type="date"
                        value={formData.transaction_date}
                        onChange={(e) => setFormData({ ...formData, transaction_date: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </div>

                    <div className="col-span-3">
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Share <span className="text-red-600">*</span>
                      </label>
                      <select
                        value={formData.share_id}
                        onChange={(e) => setFormData({ ...formData, share_id: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      >
                        <option value="">Select Share</option>
                        {shares.map(share => (
                          <option key={share.id} value={share.id}>
                            {share.ticker} - {share.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {currentBalance && (
                    <div className="bg-blue-50 p-4 rounded-lg grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-gray-600">Current Share Balance</p>
                        <p className="text-sm font-semibold text-gray-900">{currentBalance.total_shares.toLocaleString()} shares</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600">Current Average Cost Per Share</p>
                        <p className="text-sm font-semibold text-gray-900">LKR {currentBalance.avg_cost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Number of Shares <span className="text-red-600">*</span>
                      </label>
                      <input
                        type="number"
                        step="1"
                        min="1"
                        value={formData.no_of_shares}
                        onChange={(e) => setFormData({ ...formData, no_of_shares: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="e.g., 100"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Price Per Share (LKR) <span className="text-red-600">*</span>
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={formData.price_per_share}
                        onChange={(e) => setFormData({ ...formData, price_per_share: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="e.g., 150.50"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Total Amount (Gross)
                      </label>
                      <div className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-900 font-semibold">
                        LKR {calculateTotalAmountGross().toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </div>
                    </div>

                    {formData.transaction_type === 'BUY' && currentBalance && (
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Average Cost After Purchase
                        </label>
                        <div className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-900 font-semibold">
                          LKR {calculateAverageCostWithPurchase().toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </div>
                      </div>
                    )}

                    <div className="col-span-2">
                      <div className="flex items-center space-x-4 mb-2">
                        <label className="block text-sm font-semibold text-gray-700">
                          Brokerage Fee Type
                        </label>
                        <label className="flex items-center space-x-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formData.use_negotiated_fee}
                            onChange={(e) => setFormData({ ...formData, use_negotiated_fee: e.target.checked })}
                            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                          />
                          <span className="text-sm font-medium text-gray-700">Use Negotiated Fee</span>
                        </label>
                      </div>
                      <select
                        value={formData.brokerage_fee_type_id}
                        onChange={(e) => {
                          const feeType = brokerageFeeTypes.find(ft => ft.id === e.target.value);
                          if (feeType) {
                            setFormData({ ...formData, brokerage_fee_type_id: e.target.value, brokerage_fee_rate: feeType.rate.toString() });
                            calculateFees(feeType.rate);
                          }
                        }}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        disabled={formData.use_negotiated_fee}
                      >
                        <option value="">Auto-select based on amount</option>
                        {brokerageFeeTypes.map(type => (
                          <option key={type.id} value={type.id}>
                            {type.name} ({type.rate}%)
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Brokerage Fee Rate (%)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.brokerage_fee_rate}
                        onChange={(e) => {
                          setFormData({ ...formData, brokerage_fee_rate: e.target.value });
                          const rate = parseFloat(e.target.value) || 0;
                          calculateFees(rate);
                        }}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="e.g., 0.30"
                        disabled={!formData.use_negotiated_fee}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Brokerage Fee (LKR)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.fees}
                        onChange={(e) => setFormData({ ...formData, fees: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="e.g., 50.00"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Net Price Per Share
                      </label>
                      <div className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-900 font-semibold">
                        LKR {calculateNetPricePerShare().toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </div>
                    </div>

                    <div className="col-span-2">
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Total Amount (Net)
                      </label>
                      <div className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-blue-50 text-blue-900 font-bold text-lg">
                        LKR {calculateTotalAmountNet().toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="p-6 border-t border-gray-200 flex justify-end space-x-4 bg-white">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    resetForm();
                  }}
                  className="px-6 py-2 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:bg-gray-400"
                  disabled={submitting}
                >
                  {submitting ? 'Creating...' : 'Create Transaction'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showViewModal && selectedTransaction && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">Transaction Details</h2>
            </div>
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-sm font-medium text-gray-500">Entity</p>
                  <p className="text-base font-bold text-gray-900 mt-1">{getEntityName(selectedTransaction.entity_id)}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Transaction Date</p>
                  <p className="text-base font-semibold text-gray-900 mt-1">
                    {new Date(selectedTransaction.transaction_date).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Transaction Type</p>
                  <p className="text-base font-semibold text-gray-900 mt-1">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${
                      selectedTransaction.transaction_type === 'BUY' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {selectedTransaction.transaction_type}
                    </span>
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Order Type</p>
                  <p className="text-base font-semibold text-gray-900 mt-1">{selectedTransaction.order_type}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-sm font-medium text-gray-500">Share</p>
                  <p className="text-base font-semibold text-gray-900 mt-1">{getShareInfo(selectedTransaction.share_id)}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Number of Shares</p>
                  <p className="text-base font-semibold text-gray-900 mt-1">
                    {Number(selectedTransaction.no_of_shares).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Price Per Share</p>
                  <p className="text-base font-semibold text-gray-900 mt-1">
                    LKR {Number(selectedTransaction.price_per_share).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Total Amount (Gross)</p>
                  <p className="text-base font-semibold text-gray-900 mt-1">
                    LKR {Number(selectedTransaction.total_amount_gross).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Brokerage Fee</p>
                  <p className="text-base font-semibold text-gray-900 mt-1">
                    LKR {Number(selectedTransaction.fees).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    {selectedTransaction.brokerage_fee_rate && (
                      <span className="text-sm text-gray-600 ml-2">
                        ({selectedTransaction.brokerage_fee_rate}%)
                      </span>
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Net Price Per Share</p>
                  <p className="text-base font-semibold text-gray-900 mt-1">
                    LKR {Number(selectedTransaction.net_price_per_share).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Total Amount (Net)</p>
                  <p className="text-lg font-bold text-blue-900 mt-1">
                    LKR {Number(selectedTransaction.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="col-span-2">
                  <p className="text-sm font-medium text-gray-500">CDS/Broker Account</p>
                  <p className="text-base font-semibold text-gray-900 mt-1">{selectedTransaction.cds_account_id || 'N/A'}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-sm font-medium text-gray-500">Approval Status</p>
                  <p className="text-base font-semibold text-gray-900 mt-1">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${
                      selectedTransaction.approval_status === 'APPROVED' ? 'bg-green-100 text-green-800' :
                      selectedTransaction.approval_status === 'REJECTED' ? 'bg-red-100 text-red-800' :
                      selectedTransaction.approval_status === 'PENDING_APPROVAL' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {selectedTransaction.approval_status}
                    </span>
                    {selectedTransaction.offline_approval && (
                      <span className="ml-2 text-sm text-blue-600 font-medium">(Offline Approval)</span>
                    )}
                  </p>
                </div>
                {selectedTransaction.approval_document_name && (
                  <div className="col-span-2">
                    <p className="text-sm font-medium text-gray-500">Approval Document</p>
                    <a
                      href={selectedTransaction.approval_document_url || '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-base font-semibold text-blue-600 hover:text-blue-800 mt-1 inline-block"
                    >
                      {selectedTransaction.approval_document_name}
                    </a>
                  </div>
                )}
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => {
                  setShowViewModal(false);
                  setSelectedTransaction(null);
                }}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {showUploadModal && selectedTransaction && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">Upload Offline Approval</h2>
              <p className="text-sm text-gray-500 mt-1">Upload proof of approval obtained offline</p>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  <strong>Transaction:</strong> {getShareInfo(selectedTransaction.share_id)}
                </p>
                <p className="text-sm text-blue-800 mt-1">
                  <strong>Amount:</strong> LKR {Number(selectedTransaction.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Approval Document <span className="text-red-600">*</span>
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Supported formats: PDF, JPG, PNG (Max 5MB)
                </p>
              </div>

              {uploadFile && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                  <p className="text-sm text-gray-700">
                    <strong>Selected:</strong> {uploadFile.name}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Size: {(uploadFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              )}
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end space-x-4">
              <button
                onClick={() => {
                  setShowUploadModal(false);
                  setSelectedTransaction(null);
                  setUploadFile(null);
                  if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                  }
                }}
                className="px-6 py-2 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                onClick={handleUploadApproval}
                className="px-6 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors disabled:bg-gray-400"
                disabled={submitting || !uploadFile}
              >
                {submitting ? 'Uploading...' : 'Upload & Approve'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showApprovalModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">Send for Approval</h2>
              <p className="text-sm text-gray-500 mt-1">Set validity period for approval</p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <p className="text-sm text-gray-600 mb-4">
                  Sending <span className="font-bold text-green-700">{selectedTransactions.size}</span> transaction(s) for approval
                </p>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Validity Period (Hours) <span className="text-red-600">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={validityHours}
                  onChange={(e) => setValidityHours(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., 24"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Transaction(s) will expire after this duration if not approved
                </p>
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end space-x-4">
              <button
                onClick={() => {
                  setShowApprovalModal(false);
                  setValidityHours('24');
                }}
                className="px-6 py-2 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                onClick={handleSendForApproval}
                className="px-6 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors disabled:bg-gray-400"
                disabled={submitting}
              >
                {submitting ? 'Sending...' : 'Send for Approval'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showApprovalActionModal && selectedTransaction && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">
                {approvalAction === 'APPROVE' ? 'Approve Transaction' : 'Reject Transaction'}
              </h2>
              <p className="text-sm text-gray-500 mt-1">Review transaction details</p>
            </div>
            <div className="p-6 space-y-6">
              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-500">Entity:</span>
                  <span className="text-sm font-bold text-gray-900">{getEntityName(selectedTransaction.entity_id)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-500">Share:</span>
                  <span className="text-sm font-bold text-gray-900">{getShareInfo(selectedTransaction.share_id)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-500">Type:</span>
                  <span className={`text-sm font-bold px-2 py-1 rounded ${
                    selectedTransaction.transaction_type === 'BUY' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {selectedTransaction.transaction_type}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-500">Quantity:</span>
                  <span className="text-sm font-bold text-gray-900">{Number(selectedTransaction.no_of_shares).toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-500">Price per Share:</span>
                  <span className="text-sm font-bold text-gray-900">
                    LKR {Number(selectedTransaction.price_per_share).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-500">Total Amount:</span>
                  <span className="text-sm font-bold text-gray-900">
                    LKR {Number(selectedTransaction.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-500">Submitted By:</span>
                  <span className="text-sm font-bold text-gray-900">{selectedTransaction.submitted_by || 'N/A'}</span>
                </div>
                {selectedTransaction.approval_expires_at && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-500">Expires:</span>
                    <span className="text-sm font-bold text-orange-600">
                      {getTimeRemaining(selectedTransaction)}
                    </span>
                  </div>
                )}
              </div>

              {approvalAction === 'APPROVE' ? (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Approval Notes (Optional)
                  </label>
                  <textarea
                    rows={3}
                    value={approvalNotes}
                    onChange={(e) => setApprovalNotes(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Add any notes about this approval..."
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Rejection Reason <span className="text-red-600">*</span>
                  </label>
                  <textarea
                    rows={4}
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Provide a detailed reason for rejection..."
                    required
                  />
                </div>
              )}
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end space-x-4">
              <button
                onClick={() => {
                  setShowApprovalActionModal(false);
                  setSelectedTransaction(null);
                  setApprovalNotes('');
                  setRejectionReason('');
                }}
                className="px-6 py-2 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                onClick={handleApprovalAction}
                className={`px-6 py-2 rounded-lg font-medium text-white transition-colors disabled:bg-gray-400 ${
                  approvalAction === 'APPROVE'
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-red-600 hover:bg-red-700'
                }`}
                disabled={submitting}
              >
                {submitting ? 'Processing...' : `${approvalAction === 'APPROVE' ? 'Approve' : 'Reject'} Transaction`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
