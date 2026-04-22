import { Plus, Search, FileText, Upload, Eye, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
interface PdfJsLib {
  GlobalWorkerOptions: { workerSrc: string };
  getDocument: (src: { data: ArrayBuffer }) => { promise: Promise<PdfDocument> };
}
interface PdfDocument { numPages: number; getPage: (n: number) => Promise<PdfPage>; }
interface PdfPage { getTextContent: () => Promise<{ items: Array<{ str: string; transform: number[] }> }>; }

const PDFJS_VERSION = '4.0.379';
const PDFJS_MODULE_URL = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/legacy/build/pdf.min.mjs`;
const PDFJS_WORKER_URL = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/legacy/build/pdf.worker.min.mjs`;

let pdfjsPromise: Promise<PdfJsLib> | null = null;

function loadPdfjs(): Promise<PdfJsLib> {
  if (!pdfjsPromise) {
    pdfjsPromise = (async () => {
      const lib = (await import(/* @vite-ignore */ PDFJS_MODULE_URL)) as PdfJsLib;
      lib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
      return lib;
    })();
  }
  return pdfjsPromise;
}

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
  total_amount_gross?: number;
  fees?: number;
  brokerage_fee_type_id?: string;
  brokerage_fee_rate?: number;
}

interface BrokerageFeeType {
  id: string;
  name: string;
  fee_breakdown_items: { name: string; rate: number }[];
}

interface FieldCompare {
  expected: number | null;
  matches: boolean;
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
  account_no?: string;
  broker_name?: string;
  broker_address?: string;
  buyer_name?: string;
  buyer_address?: string;
  note_type?: 'Buy' | 'Sell';
  page_total?: string;
  grand_total?: string;
}

interface ExtractedRow {
  contract_no: string;
  qty: number;
  security: string;
  rate: number;
  gross_value: number;
  brokerage: number;
  cds_fees: number;
  cse_fees: number;
  sec: number;
  stl: number;
  clearing_fee: number;
  foreign_br: number;
  amount: number;
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
  const [brokerageFeeTypes, setBrokerageFeeTypes] = useState<BrokerageFeeType[]>([]);
  const [fieldCompare, setFieldCompare] = useState<Record<string, FieldCompare>>({});
  const [extractedRows, setExtractedRows] = useState<ExtractedRow[]>([]);
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

      const [notesRes, transactionsRes, entitiesRes, sharesRes, brokersRes, entityBrokersRes, feeTypesRes] = await Promise.all([
        supabase.from('buy_sell_notes').select('*').order('created_at', { ascending: false }),
        supabase.from('transactions').select('*').eq('approval_status', 'APPROVED').order('transaction_date', { ascending: false }),
        supabase.from('entities').select('id, entity_id, name').order('name'),
        supabase.from('shares').select('id, ticker, name').order('name'),
        supabase.from('brokers').select('id, broker_id, broker_name').eq('is_active', true).order('broker_name'),
        supabase.from('entity_brokers').select('*'),
        supabase.from('brokerage_fee_types').select('id, name, fee_breakdown_items')
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
    if (!file) return;
    if (file.type !== 'application/pdf') {
      alert('Please upload a PDF file');
      return;
    }
    if (!formData.transaction_id) {
      alert('Please select a transaction before uploading the contract note.');
      e.target.value = '';
      return;
    }
    setUploadedFile(file);
    void extractFromPdf(file);
  }

  function parseNumber(raw: string): number {
    const cleaned = raw.replace(/,/g, '').trim();
    const value = parseFloat(cleaned);
    return Number.isFinite(value) ? value : 0;
  }

  async function extractPdfText(file: File): Promise<{ items: { str: string; x: number; y: number; page: number }[]; rawText: string }> {
    const pdfjsLib = await loadPdfjs();
    const buffer = await file.arrayBuffer();
    const doc = await pdfjsLib.getDocument({ data: buffer }).promise;
    const items: { str: string; x: number; y: number; page: number }[] = [];
    const textParts: string[] = [];

    for (let pageNum = 1; pageNum <= doc.numPages; pageNum += 1) {
      const page = await doc.getPage(pageNum);
      const content = await page.getTextContent();
      for (const item of content.items as Array<{ str: string; transform: number[] }>) {
        const str = (item.str || '').trim();
        if (!str) continue;
        const x = item.transform[4];
        const y = item.transform[5];
        items.push({ str, x, y, page: pageNum });
        textParts.push(str);
      }
    }
    return { items, rawText: textParts.join(' ') };
  }

  function groupIntoRows(items: { str: string; x: number; y: number; page: number }[]): { str: string; x: number }[][] {
    const sorted = [...items].sort((a, b) => (a.page - b.page) || (b.y - a.y) || (a.x - b.x));
    const rows: { str: string; x: number; y: number; page: number }[][] = [];
    const tolerance = 3;
    for (const item of sorted) {
      const last = rows[rows.length - 1];
      if (last && last[0].page === item.page && Math.abs(last[0].y - item.y) <= tolerance) {
        last.push(item);
      } else {
        rows.push([item]);
      }
    }
    return rows.map(row => row.sort((a, b) => a.x - b.x).map(({ str, x }) => ({ str, x })));
  }

  const NUMERIC_TOKEN = /^-?[\d,]+(?:\.\d+)?$/;
  const SECURITY_TOKEN = /^[A-Z0-9]{2,8}\.[A-Z]\d{4}$/;
  const CONTRACT_TOKEN = /^\d{9,}$/;

  function parseBoughtNoteRows(rows: { str: string; x: number }[][]): ExtractedRow[] {
    const result: ExtractedRow[] = [];
    for (const row of rows) {
      if (row.length < 10) continue;
      const tokens = row.map(c => c.str);
      const contractIdx = tokens.findIndex(t => CONTRACT_TOKEN.test(t));
      if (contractIdx === -1) continue;
      const securityIdx = tokens.findIndex((t, i) => i > contractIdx && SECURITY_TOKEN.test(t));
      if (securityIdx === -1 || securityIdx <= contractIdx + 1) continue;

      const qty = parseNumber(tokens.slice(contractIdx + 1, securityIdx).filter(t => NUMERIC_TOKEN.test(t)).join(''));
      const security = tokens[securityIdx];
      const numeric = tokens.slice(securityIdx + 1).filter(t => NUMERIC_TOKEN.test(t)).map(parseNumber);
      if (numeric.length < 10) continue;

      const [rate, gross_value, brokerage, cds_fees, cse_fees, sec, stl, clearing_fee, foreign_br, amount] = numeric;

      result.push({
        contract_no: tokens[contractIdx],
        qty,
        security,
        rate,
        gross_value,
        brokerage,
        cds_fees,
        cse_fees,
        sec,
        stl,
        clearing_fee,
        foreign_br,
        amount,
      });
    }
    return result;
  }

  function extractHeader(rawText: string, rows: { str: string; x: number }[][]) {
    const accountMatch = rawText.match(/Account\s*No\.?\s*([A-Z0-9][A-Z0-9\-\/]+)/i);
    const txnDateMatch = rawText.match(/Transaction\s*Date\s*(\d{4}[\/\-]\d{2}[\/\-]\d{2})/i);
    const settleMatch = rawText.match(/Settlement\s*Date\s*(\d{4}[\/\-]\d{2}[\/\-]\d{2})/i);
    const pageTotalMatch = rawText.match(/Page\s*Total\s*([\d,]+(?:\.\d+)?)/i);
    const totalMatch = rawText.match(/\bTotal\b\s*([\d,]+\.\d+)\s*$/i)
      || rawText.match(/\bTotal\b\s+([\d,]+\.\d+)(?!\S)/i);

    const noteType: 'Buy' | 'Sell' = /\bSOLD\s*Note\b/i.test(rawText) ? 'Sell' : 'Buy';
    const toIso = (d: string | undefined) => d ? d.replace(/\//g, '-') : '';

    const firstPageRows = rows.slice(0, 12);
    const brokerRow = firstPageRows.find(r => /\b(securities|brokers?|stock|capital|financial)\b/i.test(r.map(c => c.str).join(' ')));
    const broker_name = brokerRow ? brokerRow.map(c => c.str).join(' ').trim() : '';

    const addressRow = firstPageRows.find(r => {
      const text = r.map(c => c.str).join(' ');
      return /\b(Sri\s*Lanka|Colombo|Mawatha|Road|Street|Lane)\b/i.test(text) && text !== broker_name;
    });
    const broker_address = addressRow ? addressRow.map(c => c.str).join(' ').trim() : '';

    const buyerStartIdx = rows.findIndex(r => /Name\s*&\s*Address\s*of\s*(Buyer|Seller)/i.test(r.map(c => c.str).join(' ')));
    let buyer_name = '';
    const buyer_address_parts: string[] = [];
    if (buyerStartIdx !== -1) {
      for (let i = buyerStartIdx + 1; i < Math.min(buyerStartIdx + 6, rows.length); i += 1) {
        const line = rows[i].map(c => c.str).join(' ').trim();
        if (!line || /Account\s*No/i.test(line) || /Bought\s+by\s+order/i.test(line)) break;
        if (!buyer_name) buyer_name = line;
        else buyer_address_parts.push(line);
      }
    }

    return {
      account_no: accountMatch?.[1]?.trim() || '',
      trade_date: toIso(txnDateMatch?.[1]),
      settlement: toIso(settleMatch?.[1]),
      broker_name,
      broker_address,
      buyer_name,
      buyer_address: buyer_address_parts.join(', '),
      note_type: noteType,
      page_total: pageTotalMatch?.[1]?.trim() || '',
      grand_total: totalMatch?.[1]?.trim() || '',
    };
  }

  async function extractFromPdf(file: File) {
    setIsExtracting(true);
    try {
      const { items, rawText } = await extractPdfText(file);
      const grouped = groupIntoRows(items);
      const rows = parseBoughtNoteRows(grouped);

      if (rows.length === 0) {
        alert('Could not extract line items from this PDF. Please verify it matches the standard BOUGHT/SOLD Note format.');
        setExtractedRows([]);
        return;
      }

      const header = extractHeader(rawText, grouped);

      const sum = (fn: (r: ExtractedRow) => number) => rows.reduce((s, r) => s + fn(r), 0);
      const totalShares = sum(r => r.qty);
      const totalGross = sum(r => r.gross_value);
      const totalBrokerage = sum(r => r.brokerage);
      const totalCds = sum(r => r.cds_fees);
      const totalCse = sum(r => r.cse_fees);
      const totalSec = sum(r => r.sec);
      const totalStl = sum(r => r.stl);
      const totalClearing = sum(r => r.clearing_fee);
      const totalForeign = sum(r => r.foreign_br);
      const totalAmount = sum(r => r.amount);
      const avgRate = totalShares > 0 ? totalGross / totalShares : 0;

      const today = new Date().toISOString().split('T')[0];
      const extracted: ExtractedData = {
        trade_date: header.trade_date || today,
        contract_no: rows[0]?.contract_no || '',
        no_of_shares: String(totalShares),
        price_avg: avgRate.toFixed(2),
        gross_amount: totalGross.toFixed(2),
        brokerage: totalBrokerage.toFixed(2),
        sec: totalSec.toFixed(2),
        exchange: totalCse.toFixed(2),
        cds: totalCds.toFixed(2),
        gov_cess: totalStl.toFixed(2),
        clearing_fees: totalClearing.toFixed(2),
        net_amount: totalAmount.toFixed(2),
        settlement: header.settlement || today,
        foreign_brokerage: totalForeign.toFixed(2),
        account_no: header.account_no,
        broker_name: header.broker_name,
        broker_address: header.broker_address,
        buyer_name: header.buyer_name,
        buyer_address: header.buyer_address,
        note_type: header.note_type,
        page_total: header.page_total,
        grand_total: header.grand_total,
      };

      setExtractedRows(rows);
      setExtractedData(extracted);
      setFormData(prev => ({
        ...prev,
        settlement_date: extracted.settlement || prev.settlement_date,
      }));
    } catch (err) {
      console.error('PDF extraction failed', err);
      alert('Failed to read the PDF. Please try another file.');
    } finally {
      setIsExtracting(false);
    }
  }

  function getExpectedFees(txn: Transaction) {
    const gross = Number(txn.total_amount_gross ?? txn.total_amount ?? 0);
    const feeType = brokerageFeeTypes.find(ft => ft.id === txn.brokerage_fee_type_id);
    const items = feeType?.fee_breakdown_items || [];

    const findRate = (patterns: string[]) => {
      const item = items.find(it => patterns.some(p => it.name?.toLowerCase().includes(p)));
      return item ? Number(item.rate) || 0 : 0;
    };

    const brokerageRate = findRate(['brokerage']);
    const secRate = findRate(['sec cess', 'sec ']);
    const exchangeRate = findRate(['cse', 'exchange']);
    const cdsRate = findRate(['cds']);
    const govRate = findRate(['iovy', 'cess', 'gov']);
    const clearingRate = findRate(['clearing']);

    return {
      brokerage: (gross * brokerageRate) / 100,
      sec: (gross * secRate) / 100,
      exchange: (gross * exchangeRate) / 100,
      cds: (gross * cdsRate) / 100,
      gov_cess: (gross * govRate) / 100,
      clearing_fees: (gross * clearingRate) / 100,
    };
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
    const compare: Record<string, FieldCompare> = {};

    if (!formData.transaction_id) {
      issues.push('Please select a transaction');
      setValidationIssues(issues);
      setFieldCompare({});
      return false;
    }

    const txn = transactions.find(t => t.id === formData.transaction_id);
    if (!txn) {
      issues.push('Selected transaction not found');
      setValidationIssues(issues);
      setFieldCompare({});
      return false;
    }

    const expectedGross = Number(txn.total_amount_gross ?? txn.total_amount ?? 0);
    const expectedFees = getExpectedFees(txn);

    const check = (key: string, label: string, actual: number, expected: number, tolerance: number) => {
      const matches = Math.abs(actual - expected) <= tolerance;
      compare[key] = { expected, matches };
      if (!matches) {
        issues.push(`${label} mismatch: Expected ${expected.toFixed(2)}, but PDF shows ${actual.toFixed(2)}`);
      }
    };

    check('no_of_shares', 'No of Shares', parseFloat(extractedData.no_of_shares) || 0, Number(txn.no_of_shares) || 0, 0.01);
    check('price_avg', 'Price/Avg', parseFloat(extractedData.price_avg) || 0, Number(txn.price_per_share) || 0, 0.01);
    check('gross_amount', 'Gross Amount', parseFloat(extractedData.gross_amount) || 0, expectedGross, 0.5);
    check('brokerage', 'Brokerage', parseFloat(extractedData.brokerage) || 0, expectedFees.brokerage, 1);
    check('sec', 'SEC', parseFloat(extractedData.sec) || 0, expectedFees.sec, 1);
    check('exchange', 'Exchange', parseFloat(extractedData.exchange) || 0, expectedFees.exchange, 1);
    check('cds', 'CDS', parseFloat(extractedData.cds) || 0, expectedFees.cds, 1);
    check('gov_cess', 'GOV CESS', parseFloat(extractedData.gov_cess) || 0, expectedFees.gov_cess, 1);
    check('clearing_fees', 'Clearing Fees', parseFloat(extractedData.clearing_fees) || 0, expectedFees.clearing_fees, 1);

    setFieldCompare(compare);
    setValidationIssues(issues);
    calculateTotals();
    return issues.length === 0;
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
    setFieldCompare({});
    setExtractedRows([]);
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

              {extractedRows.length > 0 && (
                <div className="border border-gray-300 rounded-lg overflow-hidden">
                  <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <div className="flex items-center space-x-2">
                        <h3 className="text-sm font-semibold text-gray-800">Extracted Line Items</h3>
                        {extractedData.note_type && (
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${
                            extractedData.note_type === 'Buy' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {extractedData.note_type === 'Buy' ? 'BOUGHT Note' : 'SOLD Note'}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-700 mt-1 font-medium">
                        {extractedData.broker_name || 'Broker'}
                      </p>
                      {extractedData.broker_address && (
                        <p className="text-xs text-gray-500">{extractedData.broker_address}</p>
                      )}
                    </div>
                    <div className="text-xs">
                      {extractedData.buyer_name && (
                        <p className="text-gray-700 font-medium">
                          {extractedData.note_type === 'Sell' ? 'Seller' : 'Buyer'}: {extractedData.buyer_name}
                        </p>
                      )}
                      {extractedData.buyer_address && (
                        <p className="text-gray-500">{extractedData.buyer_address}</p>
                      )}
                      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-gray-600">
                        {extractedData.account_no && <span>Account: <span className="font-semibold text-gray-800">{extractedData.account_no}</span></span>}
                        {extractedData.trade_date && <span>Trade: <span className="font-semibold text-gray-800">{extractedData.trade_date}</span></span>}
                        {extractedData.settlement && <span>Settlement: <span className="font-semibold text-gray-800">{extractedData.settlement}</span></span>}
                      </div>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="px-3 py-2 text-left font-semibold text-gray-700">Contract No</th>
                          <th className="px-3 py-2 text-right font-semibold text-gray-700">Qty</th>
                          <th className="px-3 py-2 text-left font-semibold text-gray-700">Security</th>
                          <th className="px-3 py-2 text-right font-semibold text-gray-700">Rate</th>
                          <th className="px-3 py-2 text-right font-semibold text-gray-700">Gross Value</th>
                          <th className="px-3 py-2 text-right font-semibold text-gray-700">Brokerage</th>
                          <th className="px-3 py-2 text-right font-semibold text-gray-700">CDS Fees</th>
                          <th className="px-3 py-2 text-right font-semibold text-gray-700">CSE Fees</th>
                          <th className="px-3 py-2 text-right font-semibold text-gray-700">SEC</th>
                          <th className="px-3 py-2 text-right font-semibold text-gray-700">STL</th>
                          <th className="px-3 py-2 text-right font-semibold text-gray-700">Clearing Fee</th>
                          <th className="px-3 py-2 text-right font-semibold text-gray-700">Foreign Br.</th>
                          <th className="px-3 py-2 text-right font-semibold text-gray-700">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {extractedRows.map((row, idx) => (
                          <tr key={idx} className="hover:bg-gray-50">
                            <td className="px-3 py-2 text-gray-800">{row.contract_no}</td>
                            <td className="px-3 py-2 text-right text-gray-800">{row.qty.toLocaleString()}</td>
                            <td className="px-3 py-2 text-gray-800">{row.security}</td>
                            <td className="px-3 py-2 text-right text-gray-800">{row.rate.toFixed(2)}</td>
                            <td className="px-3 py-2 text-right text-gray-800">{row.gross_value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                            <td className="px-3 py-2 text-right text-gray-800">{row.brokerage.toFixed(2)}</td>
                            <td className="px-3 py-2 text-right text-gray-800">{row.cds_fees.toFixed(2)}</td>
                            <td className="px-3 py-2 text-right text-gray-800">{row.cse_fees.toFixed(2)}</td>
                            <td className="px-3 py-2 text-right text-gray-800">{row.sec.toFixed(2)}</td>
                            <td className="px-3 py-2 text-right text-gray-800">{row.stl.toFixed(2)}</td>
                            <td className="px-3 py-2 text-right text-gray-800">{row.clearing_fee.toFixed(2)}</td>
                            <td className="px-3 py-2 text-right text-gray-800">{row.foreign_br.toFixed(2)}</td>
                            <td className="px-3 py-2 text-right font-semibold text-gray-900">{row.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-gray-50">
                        <tr className="border-t-2 border-gray-300 font-semibold">
                          <td className="px-3 py-2 text-gray-900" colSpan={1}>Total</td>
                          <td className="px-3 py-2 text-right text-gray-900">{extractedRows.reduce((s, r) => s + r.qty, 0).toLocaleString()}</td>
                          <td className="px-3 py-2"></td>
                          <td className="px-3 py-2"></td>
                          <td className="px-3 py-2 text-right text-gray-900">{extractedRows.reduce((s, r) => s + r.gross_value, 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                          <td className="px-3 py-2 text-right text-gray-900">{extractedRows.reduce((s, r) => s + r.brokerage, 0).toFixed(2)}</td>
                          <td className="px-3 py-2 text-right text-gray-900">{extractedRows.reduce((s, r) => s + r.cds_fees, 0).toFixed(2)}</td>
                          <td className="px-3 py-2 text-right text-gray-900">{extractedRows.reduce((s, r) => s + r.cse_fees, 0).toFixed(2)}</td>
                          <td className="px-3 py-2 text-right text-gray-900">{extractedRows.reduce((s, r) => s + r.sec, 0).toFixed(2)}</td>
                          <td className="px-3 py-2 text-right text-gray-900">{extractedRows.reduce((s, r) => s + r.stl, 0).toFixed(2)}</td>
                          <td className="px-3 py-2 text-right text-gray-900">{extractedRows.reduce((s, r) => s + r.clearing_fee, 0).toFixed(2)}</td>
                          <td className="px-3 py-2 text-right text-gray-900">{extractedRows.reduce((s, r) => s + r.foreign_br, 0).toFixed(2)}</td>
                          <td className="px-3 py-2 text-right text-gray-900">{extractedRows.reduce((s, r) => s + r.amount, 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        </tr>
                        {(extractedData.page_total || extractedData.grand_total) && (
                          <tr>
                            <td colSpan={11} className="px-3 py-2 text-right text-gray-500">From PDF &mdash; PageTotal / Total</td>
                            <td className="px-3 py-2 text-right text-gray-700">{extractedData.page_total || '-'}</td>
                            <td className="px-3 py-2 text-right font-bold text-gray-900">{extractedData.grand_total || '-'}</td>
                          </tr>
                        )}
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}

              {(() => {
                const pdfOnlyRows: { label: string; value: string }[] = [
                  { label: 'Trade Date', value: extractedData.trade_date || '-' },
                  { label: 'Contract No', value: extractedData.contract_no || '-' },
                  { label: 'Net Amount', value: extractedData.net_amount ? `Rs. ${extractedData.net_amount}` : '-' },
                  { label: 'Settlement', value: extractedData.settlement || '-' },
                  { label: 'Foreign Brokerage', value: extractedData.foreign_brokerage ? `Rs. ${extractedData.foreign_brokerage}` : '-' },
                ];

                const comparedRows: { key: string; label: string; value: string; isAmount: boolean }[] = [
                  { key: 'no_of_shares', label: 'No of Shares', value: extractedData.no_of_shares || '-', isAmount: false },
                  { key: 'price_avg', label: 'Price/Avg', value: extractedData.price_avg ? `Rs. ${extractedData.price_avg}` : '-', isAmount: true },
                  { key: 'gross_amount', label: 'Gross Amount', value: extractedData.gross_amount ? `Rs. ${extractedData.gross_amount}` : '-', isAmount: true },
                  { key: 'brokerage', label: 'Brokerage', value: extractedData.brokerage ? `Rs. ${extractedData.brokerage}` : '-', isAmount: true },
                  { key: 'sec', label: 'SEC', value: extractedData.sec ? `Rs. ${extractedData.sec}` : '-', isAmount: true },
                  { key: 'exchange', label: 'Exchange', value: extractedData.exchange ? `Rs. ${extractedData.exchange}` : '-', isAmount: true },
                  { key: 'cds', label: 'CDS', value: extractedData.cds ? `Rs. ${extractedData.cds}` : '-', isAmount: true },
                  { key: 'gov_cess', label: 'GOV CESS', value: extractedData.gov_cess ? `Rs. ${extractedData.gov_cess}` : '-', isAmount: true },
                  { key: 'clearing_fees', label: 'Clearing Fees', value: extractedData.clearing_fees ? `Rs. ${extractedData.clearing_fees}` : '-', isAmount: true },
                ];

                return (
                  <div className="border border-gray-300 rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="px-4 py-2 text-left font-semibold text-gray-700">Field Name</th>
                          <th className="px-4 py-2 text-left font-semibold text-gray-700">PDF Value</th>
                          <th className="px-4 py-2 text-left font-semibold text-gray-700">Expected (from transaction)</th>
                          <th className="px-4 py-2 text-left font-semibold text-gray-700">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {comparedRows.map(row => {
                          const cmp = fieldCompare[row.key];
                          const matches = cmp?.matches;
                          const expectedText = cmp?.expected != null
                            ? (row.isAmount ? `Rs. ${Number(cmp.expected).toFixed(2)}` : String(Number(cmp.expected)))
                            : '-';
                          return (
                            <tr key={row.key} className={cmp ? (matches ? 'bg-green-50' : 'bg-red-50') : ''}>
                              <td className="px-4 py-2 font-medium text-gray-900">{row.label}</td>
                              <td className="px-4 py-2 text-gray-700">{row.value}</td>
                              <td className="px-4 py-2 text-gray-700">{expectedText}</td>
                              <td className="px-4 py-2">
                                {cmp ? (
                                  matches ? (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800">
                                      <CheckCircle className="w-3 h-3 mr-1" /> Matching
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800">
                                      <XCircle className="w-3 h-3 mr-1" /> Mismatch
                                    </span>
                                  )
                                ) : (
                                  <span className="text-xs text-gray-400">-</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                        {pdfOnlyRows.map(row => (
                          <tr key={row.label}>
                            <td className="px-4 py-2 font-medium text-gray-900">{row.label}</td>
                            <td className="px-4 py-2 text-gray-700">{row.value}</td>
                            <td className="px-4 py-2 text-gray-400 text-xs">From PDF</td>
                            <td className="px-4 py-2 text-gray-400 text-xs">Not compared</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })()}

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
