import { CheckCircle, XCircle, FileText, Eye, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface BuyAndSellNote {
  id: string;
  transaction_id: string;
  note_type: 'Buy' | 'Sell';
  note_number: string;
  contract_no?: string;
  broker?: string;
  broker_id?: string;
  dealer_name?: string;
  trade_date?: string;
  settlement_date?: string;
  file_url?: string;
  remarks?: string;
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
  status?: string;
  has_mismatch?: boolean;
  approval_notes?: string;
  approved_by?: string;
  approved_at?: string;
  created_at: string;
}

interface Transaction {
  id: string;
  entity_id: string;
  share_id: string;
  transaction_type: string;
  no_of_shares: number;
  price_per_share: number;
  total_amount: number;
  transaction_date?: string;
}

interface Entity {
  id: string;
  entity_id: string;
  name: string;
}

interface Share {
  id: string;
  ticker: string;
  share_name: string;
}

interface Broker {
  id: string;
  broker_name: string;
  contact_person_name?: string;
  contact_person_email?: string;
  contact_person_phone?: string;
  contact_person_designation?: string;
}

interface EntityBroker {
  id: string;
  entity_id: string;
  broker_id: string;
  broker_account_number?: string;
  custodian_account_number?: string;
}

type ModalAction = 'approve' | 'reject' | null;

export function BuyAndSellApprovals() {
  const [notes, setNotes] = useState<BuyAndSellNote[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [shares, setShares] = useState<Share[]>([]);
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [entityBrokers, setEntityBrokers] = useState<EntityBroker[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'PENDING_APPROVAL' | 'PROCESSED' | 'REJECTED' | 'all'>('PENDING_APPROVAL');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [modalAction, setModalAction] = useState<ModalAction>(null);
  const [selectedNote, setSelectedNote] = useState<BuyAndSellNote | null>(null);
  const [actionRemarks, setActionRemarks] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    try {
      setLoading(true);
      const [notesRes, txnRes, entitiesRes, sharesRes, brokersRes, ebRes] = await Promise.all([
        supabase.from('buy_sell_notes').select('*').order('created_at', { ascending: false }),
        supabase.from('transactions').select('id, entity_id, share_id, transaction_type, no_of_shares, price_per_share, total_amount, transaction_date'),
        supabase.from('entities').select('id, entity_id, name').order('name'),
        supabase.from('shares').select('id, ticker, share_name').order('share_name'),
        supabase.from('brokers').select('id, broker_name, contact_person_name, contact_person_email, contact_person_phone, contact_person_designation').eq('is_active', true),
        supabase.from('entity_brokers').select('id, entity_id, broker_id, broker_account_number, custodian_account_number'),
      ]);
      if (notesRes.error) throw notesRes.error;
      setNotes(notesRes.data || []);
      setTransactions(txnRes.data || []);
      setEntities(entitiesRes.data || []);
      setShares(sharesRes.data || []);
      setBrokers(brokersRes.data || []);
      setEntityBrokers(ebRes.data || []);
    } catch (err) {
      console.error('Error loading approvals data:', err);
    } finally {
      setLoading(false);
    }
  }

  function getDetails(note: BuyAndSellNote) {
    const txn = transactions.find(t => t.id === note.transaction_id);
    const entity = txn ? (entities.find(e => e.id === txn.entity_id) ?? null) : null;
    const share = txn ? (shares.find(s => s.id === txn.share_id) ?? null) : null;
    const broker = note.broker_id ? (brokers.find(b => b.id === note.broker_id) ?? null) : null;
    const eb = entity && note.broker_id
      ? (entityBrokers.find(e => e.entity_id === entity.id && e.broker_id === note.broker_id) ?? null)
      : null;
    return { entity, share, broker, eb };
  }

  function openModal(note: BuyAndSellNote, action: ModalAction) {
    setSelectedNote(note);
    setModalAction(action);
    setActionRemarks('');
  }

  function closeModal() {
    setModalAction(null);
    setSelectedNote(null);
    setActionRemarks('');
    setIsSubmitting(false);
  }

  async function sendBrokerNotification(
    note: BuyAndSellNote,
    action: 'APPROVED' | 'REJECTED',
    reviewRemarks: string,
    entity: Entity | null,
    share: Share | null,
    broker: Broker | null,
  ) {
    const brokerEmail = broker?.contact_person_email;
    if (!brokerEmail) return;

    const reviewedAt = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    const fmt = (n?: number | null) => n != null ? Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-';
    const fmtDate = (d?: string | null) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    await fetch(`${supabaseUrl}/functions/v1/send-transaction-email`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${anonKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'approval_notification',
        to: brokerEmail,
        notification: {
          action,
          contract_no: note.contract_no || note.note_number || '-',
          note_type: note.note_type,
          entity_name: entity?.name || '-',
          share_name: share?.share_name || '-',
          ticker: share?.ticker || '-',
          no_of_shares: note.no_of_shares?.toLocaleString() || '-',
          price_avg: fmt(note.price_avg),
          gross_amount: fmt(note.gross_amount),
          brokerage: fmt(note.brokerage),
          net_amount: fmt(note.net_amount),
          trade_date: fmtDate(note.trade_date),
          settlement_date: fmtDate(note.settlement_date),
          broker_name: broker?.broker_name || note.broker || '-',
          dealer_name: note.dealer_name || undefined,
          remarks: note.remarks || undefined,
          approval_notes: reviewRemarks || undefined,
          reviewed_by: 'Reviewer',
          reviewed_at: reviewedAt,
        },
      }),
    }).catch(err => console.error('Email notification failed:', err));
  }

  async function handleApprove() {
    if (!selectedNote) return;
    setIsSubmitting(true);
    try {
      const { entity, share, broker } = getDetails(selectedNote);
      if (!entity) throw new Error('Entity not found for this note');

      const reviewedAt = new Date().toISOString();

      const { error: noteErr } = await supabase
        .from('buy_sell_notes')
        .update({
          status: 'PROCESSED',
          approved_by: 'Reviewer',
          approved_at: reviewedAt,
          approval_notes: actionRemarks || null,
        })
        .eq('id', selectedNote.id);
      if (noteErr) throw noteErr;

      const totalNet = Number(selectedNote.net_amount) || 0;
      const transactionType = selectedNote.note_type === 'Buy' ? 'Deduction' : 'Addition';

      const { data: existing } = await supabase
        .from('cash_balance_ledger')
        .select('running_balance')
        .eq('entity_id', entity.id)
        .order('timestamp', { ascending: false })
        .limit(1);
      const lastBalance = existing && existing.length > 0 ? Number(existing[0].running_balance) : 0;
      const newBalance = transactionType === 'Addition' ? lastBalance + totalNet : lastBalance - totalNet;

      const { error: ledgerErr } = await supabase
        .from('cash_balance_ledger')
        .insert({
          type: transactionType,
          description: `${selectedNote.note_type} - ${selectedNote.contract_no || selectedNote.note_number} (Approved)`,
          code: selectedNote.contract_no || selectedNote.note_number,
          amount: totalNet,
          date: selectedNote.trade_date || null,
          running_balance: newBalance,
          on_hold_amount: 0,
          entity_id: entity.id,
          bank_id: null,
          reference_id: selectedNote.id,
          created_by: 'Reviewer',
          notes: actionRemarks || null,
        });
      if (ledgerErr) throw ledgerErr;

      await sendBrokerNotification(selectedNote, 'APPROVED', actionRemarks, entity, share, broker);

      await loadData();
      closeModal();
    } catch (err: any) {
      alert(`Failed to approve: ${err?.message || JSON.stringify(err)}`);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleReject() {
    if (!selectedNote || !actionRemarks.trim()) return;
    setIsSubmitting(true);
    try {
      const { entity, share, broker } = getDetails(selectedNote);

      const { error } = await supabase
        .from('buy_sell_notes')
        .update({
          status: 'REJECTED',
          approved_by: 'Reviewer',
          approved_at: new Date().toISOString(),
          approval_notes: actionRemarks,
        })
        .eq('id', selectedNote.id);
      if (error) throw error;

      await sendBrokerNotification(selectedNote, 'REJECTED', actionRemarks, entity, share, broker);

      await loadData();
      closeModal();
    } catch (err: any) {
      alert(`Failed to reject: ${err?.message || JSON.stringify(err)}`);
    } finally {
      setIsSubmitting(false);
    }
  }

const displayNotes = notes.filter(n => {
    const status = n.status || 'PROCESSED';
    if (filterStatus !== 'all' && status !== filterStatus) return false;
    if (!searchTerm) return true;
    const { entity, share, broker } = getDetails(n);
    const q = searchTerm.toLowerCase();
    return (
      (n.contract_no || n.note_number || '').toLowerCase().includes(q) ||
      (entity?.name || '').toLowerCase().includes(q) ||
      (share?.ticker || '').toLowerCase().includes(q) ||
      (broker?.broker_name || n.broker || '').toLowerCase().includes(q)
    );
  });

  const counts = {
    PENDING_APPROVAL: notes.filter(n => (n.status || 'PROCESSED') === 'PENDING_APPROVAL').length,
    PROCESSED: notes.filter(n => (n.status || 'PROCESSED') === 'PROCESSED').length,
    REJECTED: notes.filter(n => (n.status || 'PROCESSED') === 'REJECTED').length,
  };

  const statusCfg: Record<string, { label: string; cls: string }> = {
    PROCESSED: { label: 'Processed', cls: 'bg-green-100 text-green-800' },
    PENDING_APPROVAL: { label: 'Pending Approval', cls: 'bg-amber-100 text-amber-800' },
    REJECTED: { label: 'Rejected', cls: 'bg-red-100 text-red-800' },
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-1">Buy &amp; Sell Note Approvals</h1>
        <p className="text-gray-500 text-sm">Review uploaded contract notes with mismatches — approve, reject, or contact the broker.</p>
      </div>

      {/* Status filter tabs + search */}
      <div className="flex gap-3 mb-6 flex-wrap items-center">
        {(['PENDING_APPROVAL', 'PROCESSED', 'REJECTED', 'all'] as const).map(s => {
          const labels: Record<string, string> = { PENDING_APPROVAL: 'Pending', PROCESSED: 'Processed', REJECTED: 'Rejected', all: 'All' };
          const count = s === 'all' ? notes.length : counts[s] ?? 0;
          const active = filterStatus === s;
          const activeClasses: Record<string, string> = {
            PENDING_APPROVAL: 'bg-amber-500 text-white border-amber-500',
            PROCESSED: 'bg-green-600 text-white border-green-600',
            REJECTED: 'bg-red-600 text-white border-red-600',
            all: 'bg-gray-800 text-white border-gray-800',
          };
          return (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors flex items-center gap-2 ${active ? activeClasses[s] : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}
            >
              {labels[s]}
              <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${active ? 'bg-white bg-opacity-25' : 'bg-gray-100 text-gray-600'}`}>
                {count}
              </span>
            </button>
          );
        })}
        <div className="flex-1 flex justify-end">
          <input
            type="text"
            placeholder="Search notes..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="px-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="w-8 px-4 py-3"></th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Contract No</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Entity</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Security</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Type</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Broker</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Trade Date</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Net Amount</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {displayNotes.map(note => {
                const { entity, share, broker, eb } = getDetails(note);
                const status = note.status || 'PROCESSED';
                const scfg = statusCfg[status] || statusCfg['PROCESSED'];
                const isExpanded = expandedId === note.id;
                const isPending = status === 'PENDING_APPROVAL';

                return (
                  <>
                  <tr
                    key={note.id}
                    className={`hover:bg-gray-50 cursor-pointer transition-colors ${isExpanded ? 'bg-blue-50' : ''}`}
                    onClick={() => setExpandedId(isExpanded ? null : note.id)}
                  >
                    <td className="px-4 py-3 text-gray-400">
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-sm font-bold text-blue-600">{note.contract_no || note.note_number || '-'}</div>
                      {note.has_mismatch && (
                        <span className="inline-flex items-center gap-0.5 text-xs text-orange-600 font-medium mt-0.5">
                          <AlertTriangle className="w-3 h-3" /> Mismatch
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{entity?.name || '-'}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-sm font-semibold text-gray-900">{share?.share_name || '-'}</div>
                      <div className="text-xs text-gray-500 font-mono">{share?.ticker || ''}</div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${note.note_type === 'Buy' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {note.note_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{broker?.broker_name || note.broker || '-'}</div>
                      {note.dealer_name && <div className="text-xs text-gray-500">{note.dealer_name}</div>}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                      {note.trade_date ? new Date(note.trade_date).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-semibold text-gray-900 tabular-nums">
                      {note.net_amount != null ? `Rs. ${Number(note.net_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '-'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${scfg.cls}`}>
                        {isPending && <AlertTriangle className="w-3 h-3" />}
                        {status === 'PROCESSED' && <CheckCircle className="w-3 h-3" />}
                        {status === 'REJECTED' && <XCircle className="w-3 h-3" />}
                        {scfg.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                      {isPending ? (
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => openModal(note, 'approve')} className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
                            <CheckCircle className="w-3.5 h-3.5" /> Approve
                          </button>
                          <button onClick={() => openModal(note, 'reject')} className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors">
                            <XCircle className="w-3.5 h-3.5" /> Reject
                          </button>
{note.file_url && (
                            <a href={note.file_url} target="_blank" rel="noopener noreferrer" className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors">
                              <Eye className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          {note.file_url && (
                            <a href={note.file_url} target="_blank" rel="noopener noreferrer" className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors">
                              <Eye className="w-3.5 h-3.5" />
                            </a>
                          )}
                          {note.approval_notes && (
                            <span className="text-xs text-gray-500 max-w-[160px] truncate" title={note.approval_notes}>{note.approval_notes}</span>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>

                  {isExpanded && (
                    <tr key={`${note.id}-detail`} className="bg-blue-50 border-b border-blue-100">
                      <td colSpan={10} className="px-6 py-4">
                        {/* Broker + Transaction + Account info */}
                        <div className="grid grid-cols-3 gap-4 mb-4">
                          <div className="bg-white rounded-lg border border-gray-200 px-4 py-3">
                            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Broker</p>
                            <p className="text-sm font-bold text-gray-900">{broker?.broker_name || note.broker || '-'}</p>
                            {broker?.contact_person_name && <p className="text-xs text-gray-500 mt-0.5">{broker.contact_person_name}{broker.contact_person_designation ? ` · ${broker.contact_person_designation}` : ''}</p>}
                            {broker?.contact_person_email && <p className="text-xs text-blue-600 mt-0.5">{broker.contact_person_email}</p>}
                            {broker?.contact_person_phone && <p className="text-xs text-gray-500 mt-0.5">{broker.contact_person_phone}</p>}
                          </div>
                          <div className="bg-white rounded-lg border border-gray-200 px-4 py-3">
                            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Transaction</p>
                            <p className="text-sm font-bold text-gray-900">{share?.share_name || '-'} <span className="font-mono text-gray-500 text-xs">({share?.ticker || '-'})</span></p>
                            <p className="text-xs text-gray-600 mt-0.5">{entity?.name || '-'}</p>
                            <p className="text-xs text-gray-500 mt-0.5">{note.no_of_shares?.toLocaleString() || '-'} shares @ Rs.&nbsp;{note.price_avg?.toFixed(4) || '-'}</p>
                          </div>
                          <div className="bg-white rounded-lg border border-emerald-200 px-4 py-3">
                            <p className="text-xs font-semibold text-emerald-500 uppercase tracking-wide mb-1">Client Account</p>
                            <p className="text-sm font-bold text-gray-900 font-mono">{eb?.broker_account_number || '-'}</p>
                            {eb?.custodian_account_number && <p className="text-xs text-gray-500 mt-0.5">CDS: <span className="font-mono">{eb.custodian_account_number}</span></p>}
                            <div className="mt-2 pt-2 border-t border-gray-100">
                              <p className="text-xs font-semibold text-amber-500 uppercase tracking-wide mb-0.5">Settlement Date</p>
                              <p className="text-sm font-bold text-gray-900">
                                {note.settlement_date ? new Date(note.settlement_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Fee breakdown */}
                        <div className="grid grid-cols-4 gap-3">
                          {[
                            { label: 'Gross Amount', value: note.gross_amount },
                            { label: 'Brokerage', value: note.brokerage },
                            { label: 'SEC', value: note.sec },
                            { label: 'CSE / Exchange', value: note.exchange },
                            { label: 'CDS Fees', value: note.cds },
                            { label: 'Gov. Levy (STL)', value: note.gov_cess },
                            { label: 'Clearing Fees', value: note.clearing_fees },
                            { label: 'Net Amount', value: note.net_amount },
                          ].map(({ label, value }) => (
                            <div key={label} className="bg-white rounded-lg border border-gray-200 px-3 py-2">
                              <p className="text-xs text-gray-400 mb-0.5">{label}</p>
                              <p className={`text-sm font-semibold tabular-nums ${label === 'Net Amount' ? 'text-gray-900' : 'text-gray-700'}`}>
                                {value != null ? `Rs. ${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '-'}
                              </p>
                            </div>
                          ))}
                        </div>

                        {(note.remarks || note.approval_notes) && (
                          <div className="mt-3 flex gap-6 text-xs text-gray-500">
                            {note.remarks && <p><span className="font-semibold">Remarks:</span> {note.remarks}</p>}
                            {note.approval_notes && <p><span className="font-semibold">Review Notes:</span> {note.approval_notes}</p>}
                          </div>
                        )}
                        {note.approved_by && (
                          <p className="mt-1 text-xs text-gray-400">
                            Reviewed by {note.approved_by}{note.approved_at ? ` on ${new Date(note.approved_at).toLocaleDateString()}` : ''}
                          </p>
                        )}
                      </td>
                    </tr>
                  )}
                  </>
                );
              })}
            </tbody>
          </table>

          {displayNotes.length === 0 && (
            <div className="text-center py-16">
              <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">
                {filterStatus === 'PENDING_APPROVAL' ? 'No notes pending approval' : 'No notes found'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Approve Modal */}
      {modalAction === 'approve' && selectedNote && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center gap-3">
              <div className="w-9 h-9 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">Approve Note</h2>
                <p className="text-xs text-gray-500">{selectedNote.contract_no || selectedNote.note_number}</p>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm text-green-800">
                <p className="font-semibold mb-1">Cash balance will be updated</p>
                <p>Approving will create a {selectedNote.note_type === 'Buy' ? 'deduction' : 'addition'} of <span className="font-bold">Rs. {Number(selectedNote.net_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span> in the cash ledger.</p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Approval Notes <span className="font-normal text-gray-400">(optional)</span></label>
                <textarea
                  value={actionRemarks}
                  onChange={e => setActionRemarks(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="Add any notes about this approval..."
                />
              </div>
              <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
                <button onClick={closeModal} className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">Cancel</button>
                <button
                  onClick={handleApprove}
                  disabled={isSubmitting}
                  className="px-5 py-2 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  <CheckCircle className="w-4 h-4" />
                  {isSubmitting ? 'Processing...' : 'Approve & Process'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {modalAction === 'reject' && selectedNote && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center gap-3">
              <div className="w-9 h-9 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                <XCircle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">Reject Note</h2>
                <p className="text-xs text-gray-500">{selectedNote.contract_no || selectedNote.note_number}</p>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-800">
                Rejecting this note will mark it as rejected. The transaction will become available again for re-upload.
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Rejection Reason <span className="text-red-500">*</span></label>
                <textarea
                  value={actionRemarks}
                  onChange={e => setActionRemarks(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                  placeholder="Describe why this note is being rejected..."
                />
              </div>
              <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
                <button onClick={closeModal} className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">Cancel</button>
                <button
                  onClick={handleReject}
                  disabled={isSubmitting || !actionRemarks.trim()}
                  className="px-5 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  <XCircle className="w-4 h-4" />
                  {isSubmitting ? 'Rejecting...' : 'Confirm Reject'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
