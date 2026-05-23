import {
  Plus,
  Search,
  FileText,
  Upload,
  Eye,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ClipboardList,
  Trash2,
  Pencil,
} from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
interface PdfJsLib {
  GlobalWorkerOptions: { workerSrc: string };
  getDocument: (src: { data: ArrayBuffer }) => {
    promise: Promise<PdfDocument>;
  };
}
interface PdfDocument {
  numPages: number;
  getPage: (n: number) => Promise<PdfPage>;
}
interface PdfPage {
  getTextContent: () => Promise<{
    items: Array<{ str: string; transform: number[] }>;
  }>;
}

const PDFJS_VERSION = "4.0.379";
const PDFJS_MODULE_URL = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/legacy/build/pdf.min.mjs`;
const PDFJS_WORKER_URL = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/legacy/build/pdf.worker.min.mjs`;

let pdfjsPromise: Promise<PdfJsLib> | null = null;

function loadPdfjs(): Promise<PdfJsLib> {
  if (!pdfjsPromise) {
    pdfjsPromise = (async () => {
      const lib = (await import(
        /* @vite-ignore */ PDFJS_MODULE_URL
      )) as PdfJsLib;
      lib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
      return lib;
    })();
  }
  return pdfjsPromise;
}

interface BuyAndSellNote {
  id: string;
  transaction_id: string;
  note_type: "Buy" | "Sell";
  note_number: string;
  broker?: string;
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
  status?: string;
  has_mismatch?: boolean;
  approval_notes?: string;
  approved_by?: string;
  approved_at?: string;
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
  share_name: string;
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
  broker_account_number?: string;
  custodian_account_number?: string;
  broker_name_id?: string;
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
  note_type?: "Buy" | "Sell";
  page_total?: string;
  grand_total?: string;
  security?: string;
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
  _settlement_date?: string; // per-row settlement date used by Trade Confirmation format
}

interface ManualRow {
  entity_id: string;
  share_id: string;
  note_type: "Buy" | "Sell";
  no_of_shares: string;
  settlement_date: string;
  total_cost: string;
  broker_cds_account: string;
}

interface EditNoteForm {
  id: string;
  note_type: "Buy" | "Sell";
  note_number: string;
  broker: string;
  dealer_name: string;
  trade_date: string;
  settlement_date: string;
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
  foreign_brokerage: string;
  remarks: string;
}

function emptyManualRow(): ManualRow {
  return {
    entity_id: "",
    share_id: "",
    note_type: "Buy",
    no_of_shares: "",
    settlement_date: new Date().toISOString().split("T")[0],
    total_cost: "",
    broker_cds_account: "",
  };
}

export function BuyAndSellNotes() {
  const [showModal, setShowModal] = useState(false);
  const [showProcessModal, setShowProcessModal] = useState(false);
  const [showManualModal, setShowManualModal] = useState(false);
  const [editNote, setEditNote] = useState<EditNoteForm | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [manualRows, setManualRows] = useState<ManualRow[]>([emptyManualRow()]);
  const [isSavingManual, setIsSavingManual] = useState(false);
  const [notes, setNotes] = useState<BuyAndSellNote[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [shares, setShares] = useState<Share[]>([]);
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [entityBrokers, setEntityBrokers] = useState<EntityBroker[]>([]);
  const [brokerageFeeTypes, setBrokerageFeeTypes] = useState<
    BrokerageFeeType[]
  >([]);
  const [banks, setBanks] = useState<
    Array<{
      id: string;
      entity_id: string;
      name: string;
      account_number: string | null;
    }>
  >([]);
  const [fieldCompare, setFieldCompare] = useState<
    Record<string, FieldCompare>
  >({});
  const [extractedRows, setExtractedRows] = useState<ExtractedRow[]>([]);
  const [debugRawText, setDebugRawText] = useState<string>("");
  const [expandedNoteId, setExpandedNoteId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [filterNoteType, setFilterNoteType] = useState("");
  const [txnSearchTerm, setTxnSearchTerm] = useState("");
  const [txnDropdownOpen, setTxnDropdownOpen] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [viewingFileNoteId, setViewingFileNoteId] = useState<string | null>(
    null,
  );
  const [isExtracting, setIsExtracting] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedData, setExtractedData] = useState<ExtractedData>({
    trade_date: "",
    contract_no: "",
    no_of_shares: "",
    price_avg: "",
    gross_amount: "",
    brokerage: "",
    sec: "",
    exchange: "",
    cds: "",
    gov_cess: "",
    clearing_fees: "",
    net_amount: "",
    settlement: "",
    foreign_brokerage: "",
  });
  const [formData, setFormData] = useState({
    transaction_id: "",
    broker_id: "",
    dealer_name: "",
    entity_account_number: "",
    settlement_date: new Date().toISOString().split("T")[0],
    remarks: "",
  });
  const [validationIssues, setValidationIssues] = useState<string[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);

      const [
        notesRes,
        transactionsRes,
        entitiesRes,
        sharesRes,
        brokersRes,
        entityBrokersRes,
        feeTypesRes,
        banksRes,
      ] = await Promise.all([
        supabase
          .from("buy_sell_notes")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase
          .from("transactions")
          .select("*")
          .in("approval_status", ["APPROVED", "AUTO_APPROVED"])
          .order("transaction_date", { ascending: false }),
        supabase.from("entities").select("id, entity_id, name").order("name"),
        supabase
          .from("shares")
          .select("id, ticker, share_name")
          .order("share_name"),
        supabase
          .from("brokers")
          .select("id, broker_id, broker_name")
          .eq("is_active", true)
          .order("broker_name"),
        supabase.from("entity_brokers").select("*"),
        supabase
          .from("brokerage_fee_types")
          .select("id, name, fee_breakdown_items"),
        supabase
          .from("banks")
          .select("id, entity_id, name, account_number")
          .eq("is_active", true),
      ]);

      if (notesRes.error) throw notesRes.error;
      if (transactionsRes.error) throw transactionsRes.error;
      if (entitiesRes.error) throw entitiesRes.error;
      if (sharesRes.error) throw sharesRes.error;
      if (brokersRes.error) throw brokersRes.error;

      const allNotes = notesRes.data || [];
      const allTxns = transactionsRes.data || [];
      // Exclude transactions that already have a PROCESSED note linked
      const linkedTxnIds = new Set(
        allNotes
          .filter((n: any) => n.status === "PROCESSED")
          .map((n: any) => n.transaction_id)
          .filter(Boolean),
      );
      setNotes(allNotes);
      setAllTransactions(allTxns);
      setTransactions(allTxns.filter((t: any) => !linkedTxnIds.has(t.id)));
      setEntities(entitiesRes.data || []);
      setShares(sharesRes.data || []);
      setBrokers(brokersRes.data || []);
      setEntityBrokers(entityBrokersRes.data || []);
      setBrokerageFeeTypes(
        (feeTypesRes.data || []).map((ft: BrokerageFeeType) => ({
          ...ft,
          fee_breakdown_items:
            typeof ft.fee_breakdown_items === "string"
              ? JSON.parse(ft.fee_breakdown_items)
              : ft.fee_breakdown_items || [],
        })),
      );
      setBanks(banksRes.data || []);
    } catch (error) {
      console.error("Error loading data:", error);
      alert("Failed to load data");
    } finally {
      setLoading(false);
    }
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf") {
      alert("Please upload a PDF file");
      return;
    }
    setUploadedFile(file);
    void extractFromPdf(file);
  }

  function parseNumber(raw: string): number {
    const cleaned = raw.replace(/,/g, "").trim();
    const value = parseFloat(cleaned);
    return Number.isFinite(value) ? value : 0;
  }

  async function extractPdfText(
    file: File,
  ): Promise<{
    items: { str: string; x: number; y: number; page: number; width: number }[];
    rawText: string;
  }> {
    const pdfjsLib = await loadPdfjs();
    const buffer = await file.arrayBuffer();
    const doc = await pdfjsLib.getDocument({ data: buffer }).promise;
    const items: { str: string; x: number; y: number; page: number; width: number }[] = [];
    const textParts: string[] = [];

    for (let pageNum = 1; pageNum <= doc.numPages; pageNum += 1) {
      const page = await doc.getPage(pageNum);
      const content = await page.getTextContent();
      for (const item of content.items as Array<{
        str: string;
        transform: number[];
        width?: number;
      }>) {
        const str = (item.str || "").trim();
        if (!str) continue;
        const x = item.transform[4];
        const y = item.transform[5];
        const width = item.width ?? 0;
        items.push({ str, x, y, page: pageNum, width });
        textParts.push(str);
      }
    }
    return { items, rawText: textParts.join(" ") };
  }

  function groupIntoRows(
    items: { str: string; x: number; y: number; page: number }[],
    tolerance = 4,
  ): { str: string; x: number }[][] {
    const sorted = [...items].sort(
      (a, b) => a.page - b.page || b.y - a.y || a.x - b.x,
    );
    const rows: { str: string; x: number; y: number; page: number }[][] = [];
    for (const item of sorted) {
      const last = rows[rows.length - 1];
      if (
        last &&
        last[0].page === item.page &&
        Math.abs(last[0].y - item.y) <= tolerance
      ) {
        last.push(item);
      } else {
        rows.push([item]);
      }
    }
    return rows.map((row) =>
      row.sort((a, b) => a.x - b.x).map(({ str, x }) => ({ str, x })),
    );
  }

  const NUMERIC_TOKEN = /^-?[\d,]+(?:\.\d+)?$/;
  // Matches both dotted tickers (DFCC.N0000) and plain uppercase words (AMBEON)
  const SECURITY_TOKEN = /^[A-Z][A-Z0-9]{1,12}(?:\.[A-Z0-9]+)*$/;
  const CONTRACT_TOKEN = /^\d{7,}$/;

  function mergeAdjacentTokens(tokens: string[]): string[] {
    const merged: string[] = [];
    for (let i = 0; i < tokens.length; i += 1) {
      const prev = merged[merged.length - 1];
      const cur = tokens[i];
      if (
        prev &&
        /[\d,.]$/.test(prev) &&
        /^[\d,.]/.test(cur) &&
        (prev + cur).match(/^[\d,]+(?:\.\d+)?$/)
      ) {
        merged[merged.length - 1] = prev + cur;
      } else {
        merged.push(cur);
      }
    }
    return merged;
  }

  function parseBoughtNoteRows(
    rows: { str: string; x: number }[][],
  ): ExtractedRow[] {
    const result: ExtractedRow[] = [];
    for (const row of rows) {
      if (row.length < 5) continue;
      const rawTokens = row.map((c) => c.str).filter(Boolean);
      const tokens = mergeAdjacentTokens(rawTokens);
      const contractIdx = tokens.findIndex((t) => CONTRACT_TOKEN.test(t));
      if (contractIdx === -1) continue;

      let securityIdx = tokens.findIndex(
        (t, i) => i > contractIdx && SECURITY_TOKEN.test(t),
      );
      if (securityIdx === -1) {
        // Fallback: first non-numeric ALL-CAPS word after contractIdx that isn't a known header word
        const SKIP_WORDS = /^(BOUGHT|SOLD|TOTAL|PAGE|BUYER|SELLER|ACCOUNT|IMPORTANT|THIS|THE|AND|FOR|BY|OF|AS|IN|IS|NOT)$/i;
        securityIdx = tokens.findIndex(
          (t, i) =>
            i > contractIdx &&
            /^[A-Z][A-Z0-9.]{2,}$/.test(t) &&
            !NUMERIC_TOKEN.test(t) &&
            !SKIP_WORDS.test(t),
        );
      }
      if (securityIdx === -1 || securityIdx <= contractIdx) continue;

      const qtyTokens = tokens
        .slice(contractIdx + 1, securityIdx)
        .filter((t) => NUMERIC_TOKEN.test(t));
      if (qtyTokens.length === 0) continue;
      const qty = parseNumber(qtyTokens.join(""));

      const security = tokens[securityIdx];
      const numeric = tokens
        .slice(securityIdx + 1)
        .filter((t) => NUMERIC_TOKEN.test(t))
        .map(parseNumber);
      if (numeric.length < 4) continue;

      const pad = (idx: number) => numeric[idx] ?? 0;
      const amount = numeric[numeric.length - 1] ?? 0;
      const head = numeric.slice(0, numeric.length - 1);
      const [
        rate,
        gross_value,
        brokerage,
        cds_fees,
        cse_fees,
        sec,
        stl,
        clearing_fee,
        foreign_br,
      ] = [
        head[0] ?? pad(0),
        head[1] ?? pad(1),
        head[2] ?? pad(2),
        head[3] ?? pad(3),
        head[4] ?? pad(4),
        head[5] ?? pad(5),
        head[6] ?? pad(6),
        head[7] ?? pad(7),
        head[8] ?? 0,
      ];

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

  // Detect Capital TRUST "Trade Confirmation" format
  function isTradeConfirmation(rawText: string): boolean {
    return (
      /TRADE\s+CONFIRMATION/i.test(rawText) ||
      /CDS\s+Account\s+Number\s*[:\s]+[A-Z]{2,5}-\d{3,5}/i.test(rawText)
    );
  }

  // Parse rows from Trade Confirmation format:
  // Trade Date | Contract No | No of Shares | Price/Avg | Gross Amount | Brokerage | SEC | Exchange | CDS | GOV CESS | Net Amount | Settlement | Foreign Brokerage | Clearing Fees
  function parseTradeConfirmationRows(rawText: string): ExtractedRow[] {
    const out: ExtractedRow[] = [];
    const NUM = "[\\d,]+(?:\\.\\d+)?";
    // Row pattern: date  contractNo  qty  price  gross  brokerage  sec  exchange  cds  govcess  netAmount  settlementDate  foreignBrokerage  clearingFees
    const DATE = "\\d{2}/\\d{2}/\\d{4}";
    const rowPattern = new RegExp(
      `(${DATE})\\s+(\\d{7,})\\s+(${NUM})\\s+(${NUM})\\s+(${NUM})\\s+` +
        `(${NUM})\\s+(${NUM})\\s+(${NUM})\\s+(${NUM})\\s+(${NUM})\\s+` +
        `(${NUM})\\s+(${DATE})\\s+(${NUM})(?:\\s+(${NUM}))?`,
      "g",
    );
    let m: RegExpExecArray | null;
    while ((m = rowPattern.exec(rawText)) !== null) {
      out.push({
        contract_no: m[2],
        qty: parseNumber(m[3]),
        rate: parseNumber(m[4]),
        gross_value: parseNumber(m[5]),
        brokerage: parseNumber(m[6]),
        sec: parseNumber(m[7]),
        cse_fees: parseNumber(m[8]),
        cds_fees: parseNumber(m[9]),
        stl: parseNumber(m[10]),
        amount: parseNumber(m[11]),
        // m[12] = settlement date (per-row), m[13] = foreign brokerage, m[14] = clearing fee
        foreign_br: parseNumber(m[13] ?? "0"),
        clearing_fee: parseNumber(m[14] ?? "0"),
        // Derive security from context (populated in extractFromPdf after header parsing)
        security: "",
        _settlement_date: m[12],
      });
    }
    return out;
  }

  function parseRowsFromRawText(rawText: string): ExtractedRow[] {
    const out: ExtractedRow[] = [];
    const NUM = "[\\d,]+(?:\\.\\d+)?";
    // Matches dotted tickers (DFCC.N0000) AND plain uppercase names (AMBEON, COMB, DIAL)
    const TICKER = "[A-Z][A-Z0-9]{2,12}(?:\\.[A-Z0-9]*)?";

    let m: RegExpExecArray | null;

    // Pattern A: contractNo  TICKER  qty  rate  10 more numbers
    // (covers formats where ticker comes before qty in raw text)
    const tickerFirstPattern = new RegExp(
      `(\\d{7,})\\s+(${TICKER})\\s+(${NUM})\\s+` +
        `(${NUM})\\s+(${NUM})\\s+(${NUM})\\s+(${NUM})\\s+(${NUM})\\s+` +
        `(${NUM})\\s+(${NUM})\\s+(${NUM})\\s+(${NUM})\\s+(${NUM})`,
      "g",
    );
    while ((m = tickerFirstPattern.exec(rawText)) !== null) {
      out.push({
        contract_no: m[1],
        security: m[2],
        qty: parseNumber(m[3]),
        rate: parseNumber(m[4]),
        gross_value: parseNumber(m[5]),
        brokerage: parseNumber(m[6]),
        cds_fees: parseNumber(m[7]),
        cse_fees: parseNumber(m[8]),
        sec: parseNumber(m[9]),
        stl: parseNumber(m[10]),
        clearing_fee: parseNumber(m[11]),
        foreign_br: parseNumber(m[12]),
        amount: parseNumber(m[13]),
      });
    }
    if (out.length > 0) return out;

    // Pattern B: contractNo  qty  TICKER  rate  10 more numbers (visual left-to-right order)
    const qtyFirstPattern = new RegExp(
      `(\\d{7,})\\s+(${NUM})\\s+(${TICKER})\\s+` +
        `(${NUM})\\s+(${NUM})\\s+(${NUM})\\s+(${NUM})\\s+(${NUM})\\s+` +
        `(${NUM})\\s+(${NUM})\\s+(${NUM})\\s+(${NUM})\\s+(${NUM})`,
      "g",
    );
    while ((m = qtyFirstPattern.exec(rawText)) !== null) {
      out.push({
        contract_no: m[1],
        qty: parseNumber(m[2]),
        security: m[3],
        rate: parseNumber(m[4]),
        gross_value: parseNumber(m[5]),
        brokerage: parseNumber(m[6]),
        cds_fees: parseNumber(m[7]),
        cse_fees: parseNumber(m[8]),
        sec: parseNumber(m[9]),
        stl: parseNumber(m[10]),
        clearing_fee: parseNumber(m[11]),
        foreign_br: parseNumber(m[12]),
        amount: parseNumber(m[13]),
      });
    }
    if (out.length > 0) return out;

    // Loose fallback: contractNo  TICKER  qty  then any 8–12 numbers
    const looser = new RegExp(
      `(\\d{7,})\\s+(${TICKER})\\s+(${NUM})((?:\\s+${NUM}){8,12})`,
      "g",
    );
    while ((m = looser.exec(rawText)) !== null) {
      const nums = m[4].trim().split(/\s+/).map(parseNumber);
      if (nums.length < 8) continue;
      out.push({
        contract_no: m[1],
        security: m[2],
        qty: parseNumber(m[3]),
        rate: nums[0] ?? 0,
        gross_value: nums[1] ?? 0,
        brokerage: nums[2] ?? 0,
        cds_fees: nums[3] ?? 0,
        cse_fees: nums[4] ?? 0,
        sec: nums[5] ?? 0,
        stl: nums[6] ?? 0,
        clearing_fee: nums[7] ?? 0,
        foreign_br: nums[8] ?? 0,
        amount: nums[9] ?? 0,
      });
    }
    return out;
  }

  function parseRowsByXColumns(
    items: { str: string; x: number; y: number; page: number; width: number }[],
    securityHint = "",
  ): ExtractedRow[] {
    // Group items into rows using tolerance-based approach (same as groupIntoRows)
    // Tolerance 5 ensures multi-page PDFs where same-row items differ by up to 5 Y units work correctly
    const ROW_Y_TOL = 5;
    const sortedItems = [...items].sort((a, b) => a.page - b.page || b.y - a.y || a.x - b.x);
    const groups: (typeof items)[] = [];
    for (const it of sortedItems) {
      const last = groups[groups.length - 1];
      if (last && last[0].page === it.page && Math.abs(last[0].y - it.y) <= ROW_Y_TOL) {
        last.push(it);
      } else {
        groups.push([it]);
      }
    }
    const rowList = groups
      .map((r) => [...r].sort((a, b) => a.x - b.x))
      .sort((a, b) => a[0].page - b[0].page || b[0].y - a[0].y);

    // Find the column header row — supports both Bought Note ("qty","security") and
    // Trade Confirmation ("no of shares" / "shares", "contract no", "net amount") column names
    const headerRow = rowList.find((r) => {
      const text = r
        .map((i) => i.str)
        .join(" ")
        .toLowerCase();
      const hasContract = text.includes("contract");
      const hasQtyOrShares =
        text.includes("qty") ||
        text.includes("shares") ||
        text.includes("no of shares");
      const hasAmount =
        text.includes("amount") ||
        text.includes("gross") ||
        text.includes("net");
      return hasContract && hasQtyOrShares && hasAmount;
    });
    if (!headerRow) return [];

    // Also collect the next row in case multi-line headers (e.g. "No of" on one line, "Shares" below)
    const headerY = headerRow[0].y;
    const headerPage = headerRow[0].page;
    const headerRowIdx = rowList.indexOf(headerRow);
    // Merge any continuation row that appears within 15 pts below and has no numbers
    const continuationRow = rowList[headerRowIdx + 1];
    let combinedHeaderItems = [...headerRow];
    if (
      continuationRow &&
      continuationRow[0].page === headerPage &&
      Math.abs(continuationRow[0].y - headerY) <= 15 &&
      !continuationRow.some((i) => /\d/.test(i.str))
    ) {
      combinedHeaderItems.push(...continuationRow);
    }
    // Sort combined header items by X position to ensure correct column order
    combinedHeaderItems = combinedHeaderItems.sort((a, b) => a.x - b.x);

    const colX: Record<string, number> = {};
    
    for (let i = 0; i < combinedHeaderItems.length; i += 1) {
      const item = combinedHeaderItems[i];
      const s = item.str.toLowerCase().trim();
      const nextStr = combinedHeaderItems[i + 1]?.str.toLowerCase().trim();
      
      // Store the RIGHT EDGE of each header token (item.x + item.width).
      // For right-aligned columns, all data values end at the same X as the header's right edge,
      // so comparing right edges is more accurate than comparing left edges.
      const rx = item.x + item.width;
      if (s.startsWith("contract")) {
        colX.contract = colX.contract ?? rx;
      }
      // "No of Shares" or "No of ..." as a single token OR separate tokens
      else if (s.startsWith("no of") || (s === "no" && nextStr === "of")) {
        colX.qty = colX.qty ?? rx;
        if (s === "no") i += 1;  // Skip the "of" token if separate
      }
      // Standalone "No" (from "Contract No")
      else if (s === "no") {
        colX.contract = colX.contract ?? rx;
      }
      // Skip standalone "of" if we've already processed "No of"
      else if (s === "of" && !colX.qty) {
        /* skip */
      }
      else if (s === "qty" || s === "shares" || s === "share") {
        colX.qty = rx;
      }
      else if (s.startsWith("security")) colX.security = rx;
      else if (s === "rate" || s === "price/avg" || s === "price") {
        colX.rate = rx;
      }
      else if (s.startsWith("gross")) colX.gross = rx;
      else if (s.startsWith("brokerage")) colX.brokerage = rx;
      else if (s.startsWith("cds")) colX.cds = rx;
      else if (s.startsWith("cse") || s === "exchange") colX.cse = rx;
      else if (s === "sec") colX.sec = rx;
      else if (s === "stl" || s === "gov" || s === "gov cess" || s === "cess")
        colX.stl = colX.stl ?? rx;
      else if (s.startsWith("clearing") || s === "clearing") {
        colX.clearing = rx;
      }
      else if (s.startsWith("foreign")) colX.foreign = rx;
      else if (s === "amount" || s === "net amount" || s === "netamount") colX.amount = rx;
      else if (s === "settlement") colX.settlement = rx;
      else if (s === "net") colX.amount = rx;
    }

    // Build Voronoi column boundaries sorted by X position.
    // Each column "owns" the midpoint range between itself and its neighbors.
    const colEntries = (Object.entries(colX) as [string, number][]).sort((a, b) => a[1] - b[1]);

    const out: ExtractedRow[] = [];

    const nearest = (row: typeof headerRow, x: number, tolerance = 40) => {
      let best: (typeof headerRow)[number] | null = null;
      let bestDist = Infinity;
      for (const it of row) {
        const d = Math.abs(it.x - x);
        if (d < bestDist && d <= tolerance) {
          best = it;
          bestDist = d;
        }
      }
      return best?.str ?? "";
    };

    // Voronoi-based column value extractor using RIGHT EDGES.
    // colX stores the right edge of each column header (item.x + item.width).
    // Data items are also matched by their right edge (item.x + item.width),
    // because in right-aligned columns every value ends at the same X position
    // regardless of the value's length. This prevents small numbers (which start
    // further right) from crossing into the next column's region.
    const rEdge = (it: { x: number; width: number }) => it.x + it.width;
    const voronoiGet = (row: typeof headerRow, colName: string): string => {
      const idx = colEntries.findIndex(([k]) => k === colName);
      if (idx === -1) return "";
      const colRightEdge = colEntries[idx][1]; // already the right edge
      const leftBound = idx > 0 ? (colEntries[idx - 1][1] + colRightEdge) / 2 : -Infinity;
      const rightBound = idx < colEntries.length - 1 ? (colRightEdge + colEntries[idx + 1][1]) / 2 : Infinity;
      // Filter candidates whose right edge falls within this column's Voronoi region
      const candidates = row.filter(item => {
        const re = rEdge(item);
        return re > leftBound && re <= rightBound;
      });
      if (candidates.length === 0) return "";
      // Return the candidate whose right edge is closest to the column's right edge
      return candidates.reduce((best, item) =>
        Math.abs(rEdge(item) - colRightEdge) < Math.abs(rEdge(best) - colRightEdge) ? item : best
      ).str;
    };

    for (const row of rowList) {
      if (row[0].page < headerPage) continue;
      if (row[0].page === headerPage && row[0].y >= headerY) continue;
      const joined = row.map((i) => i.str).join(" ");
      // Accept rows that contain a 7+ digit contract number anywhere (Trade Confirmation rows start with a date)
      if (!/\b\d{7,}\b/.test(joined)) continue;
      // Skip total/summary rows
      if (
        /^\s*(total|page\s*total|net\s*settlement|purchase\s*total|sales\s*total)/i.test(
          joined,
        )
      )
        continue;
      // Skip separator rows (dashes/equals)
      if (/^[\s\-=]+$/.test(joined)) continue;

      const contract = voronoiGet(row, "contract") || nearest(row, colX.contract ?? row[0].x, 80);
      if (!CONTRACT_TOKEN.test(contract)) continue;

      const settlementStr = colX.settlement !== undefined ? voronoiGet(row, "settlement") : "";

      out.push({
        contract_no: contract,
        qty: parseNumber(voronoiGet(row, "qty")),
        security: securityHint || voronoiGet(row, "security"),
        rate: parseNumber(voronoiGet(row, "rate")),
        gross_value: parseNumber(voronoiGet(row, "gross")),
        brokerage: parseNumber(voronoiGet(row, "brokerage")),
        cds_fees: parseNumber(voronoiGet(row, "cds")),
        cse_fees: parseNumber(voronoiGet(row, "cse")),
        sec: parseNumber(voronoiGet(row, "sec")),
        stl: parseNumber(voronoiGet(row, "stl")),
        clearing_fee: parseNumber(voronoiGet(row, "clearing")),
        foreign_br: parseNumber(voronoiGet(row, "foreign")),
        amount: parseNumber(voronoiGet(row, "amount")),
        _settlement_date: settlementStr || undefined,
      });
    }
    return out;
  }

  // Convert dd/mm/yyyy → yyyy-mm-dd
  function dmyToIso(d: string): string {
    const parts = d.split("/");
    if (parts.length === 3 && parts[0].length === 2)
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    return d.replace(/\//g, "-");
  }

  function extractHeader(
    rawText: string,
    rows: { str: string; x: number }[][],
    extractedRows?: ExtractedRow[],
  ) {
    const toIso = (d: string | undefined) => (d ? d.replace(/\//g, "-") : "");

    // ── Trade Confirmation format (Capital TRUST) ──────────────────────────
    if (isTradeConfirmation(rawText)) {
      // Account number: "CDS Account Number : DSA-4328-LC/00"
      const accountMatch =
        rawText.match(
          /CDS\s+Account\s+Number\s*[:\s]+([A-Z0-9][A-Z0-9\-\/]+)/i,
        ) || rawText.match(/\b([A-Z]{2,5}-\d{3,5}-[A-Z]{2,3}\/\d{2,3})\b/);

      // Transaction date: "Transaction Date : 04/03/2026" or "Transaction Date 04/03/2026" (dd/mm/yyyy)
      const txnDateRaw =
        rawText.match(
          /Transaction\s*Date\s*[:\s]*(\d{2}\/\d{2}\/\d{4})/i,
        )?.[1] ||
        rawText.match(
          /Transaction\s*Date\s*[:\s]*(\d{4}[\/\-]\d{2}[\/\-]\d{2})/i,
        )?.[1];
      const trade_date = txnDateRaw
        ? txnDateRaw.match(/^\d{2}\//)
          ? dmyToIso(txnDateRaw)
          : toIso(txnDateRaw)
        : "";

      // Settlement: take the first settlement date from the data rows (per-row in this format)
      const firstSettlement = extractedRows?.[0]?._settlement_date || "";
      const settlement = firstSettlement
        ? firstSettlement.match(/^\d{2}\//)
          ? dmyToIso(firstSettlement)
          : toIso(firstSettlement)
        : "";

      // Buyer name: "To : METROCORP (PVT) LTD"
      const toMatch = rawText.match(
        /\bTo\b\s*[:\s]+([A-Z][A-Z0-9\s(),.&/-]{3,60})/,
      );
      const buyer_name = toMatch?.[1]?.trim().replace(/\s+/g, " ") || "";

      // Note type: "Purchase of" = Buy, "Sale of" / "Sold" = Sell
      const noteType: "Buy" | "Sell" = /\bSale\s+of\b|\bSold\b/i.test(rawText)
        ? "Sell"
        : "Buy";

      // Broker name: company heading at top (lines before TRADE CONFIRMATION)
      const firstPageRows = rows.slice(0, 10);
      const brokerRow = firstPageRows.find((r) =>
        /\b(securities|brokers?|stock|capital|financial)\b/i.test(
          r.map((c) => c.str).join(" "),
        ),
      );
      const broker_name = brokerRow
        ? brokerRow
            .map((c) => c.str)
            .join(" ")
            .trim()
        : "";
      const addressRow = firstPageRows.find((r) => {
        const text = r.map((c) => c.str).join(" ");
        return (
          /\b(Sri\s*Lanka|Colombo|Mawatha|Road|Street|Lane)\b/i.test(text) &&
          text !== broker_name
        );
      });
      const broker_address = addressRow
        ? addressRow
            .map((c) => c.str)
            .join(" ")
            .trim()
        : "";

      // Net settlement total
      const netSettleMatch = rawText.match(
        /Net\s+Settlement\s+Value\s+([\d,]+(?:\.\d+)?)/i,
      );
      const grand_total = netSettleMatch?.[1] || "";

      // Security ticker: "Purchase of DFCC BANK PLC ( DFCC.N0000 / ..."
      const securityMatch = rawText.match(
        /(?:Purchase|Sale)\s+of\s+[^(]+\(\s*([A-Z][A-Z0-9.]{2,})/i,
      );
      const security = securityMatch?.[1]?.trim() || "";

      return {
        account_no: accountMatch?.[1]?.trim() || "",
        trade_date,
        settlement,
        broker_name,
        broker_address,
        buyer_name,
        buyer_address: "",
        note_type: noteType,
        page_total: "",
        grand_total,
        security,
      };
    }

    // ── Bought/Sold Note format ────────────────────────────────────────────
    let accountMatch = rawText.match(
      /Account\s*No\.?\s*([A-Z0-9][A-Z0-9\-\/]+)/i,
    );
    let txnDateMatch = rawText.match(
      /Transaction\s*Date\s*(\d{4}[\/\-]\d{2}[\/\-]\d{2})/i,
    );
    let settleMatch = rawText.match(
      /Settlement\s*Date\s*(\d{4}[\/\-]\d{2}[\/\-]\d{2})/i,
    );

    if (!txnDateMatch || !settleMatch || !accountMatch) {
      const jumbled = rawText.match(
        /(\d{4}[\/\-]\d{2}[\/\-]\d{2})\s+([A-Z]{2,}[A-Z0-9\-\/]+)\s+(?:Buyer|Seller)\s+(\d{4}[\/\-]\d{2}[\/\-]\d{2})/i,
      );
      if (jumbled) {
        txnDateMatch =
          txnDateMatch || ([null, jumbled[1]] as unknown as RegExpMatchArray);
        accountMatch =
          accountMatch || ([null, jumbled[2]] as unknown as RegExpMatchArray);
        settleMatch =
          settleMatch || ([null, jumbled[3]] as unknown as RegExpMatchArray);
      }
    }
    if (!accountMatch) {
      accountMatch = rawText.match(
        /\b([A-Z]{2,5}-\d{3,5}-[A-Z]{2,3}\/\d{2})\b/,
      );
    }
    const pageTotalMatch = rawText.match(/Page\s*Total\s*([\d,]+(?:\.\d+)?)/i);
    const totalMatch =
      rawText.match(/\bTotal\b\s*([\d,]+\.\d+)\s*$/i) ||
      rawText.match(/\bTotal\b\s+([\d,]+\.\d+)(?!\S)/i);

    const noteType: "Buy" | "Sell" = /\bSOLD\s*Note\b/i.test(rawText)
      ? "Sell"
      : "Buy";

    const firstPageRows = rows.slice(0, 12);
    const brokerRow = firstPageRows.find((r) =>
      /\b(securities|brokers?|stock|capital|financial)\b/i.test(
        r.map((c) => c.str).join(" "),
      ),
    );
    const broker_name = brokerRow
      ? brokerRow
          .map((c) => c.str)
          .join(" ")
          .trim()
      : "";

    const addressRow = firstPageRows.find((r) => {
      const text = r.map((c) => c.str).join(" ");
      return (
        /\b(Sri\s*Lanka|Colombo|Mawatha|Road|Street|Lane)\b/i.test(text) &&
        text !== broker_name
      );
    });
    const broker_address = addressRow
      ? addressRow
          .map((c) => c.str)
          .join(" ")
          .trim()
      : "";

    const buyerStartIdx = rows.findIndex((r) =>
      /Name\s*&\s*Address\s*of\s*(Buyer|Seller)/i.test(
        r.map((c) => c.str).join(" "),
      ),
    );
    let buyer_name = "";
    const buyer_address_parts: string[] = [];
    if (buyerStartIdx !== -1) {
      for (
        let i = buyerStartIdx + 1;
        i < Math.min(buyerStartIdx + 6, rows.length);
        i += 1
      ) {
        const line = rows[i]
          .map((c) => c.str)
          .join(" ")
          .trim();
        if (
          !line ||
          /Account\s*No/i.test(line) ||
          /Bought\s+by\s+order/i.test(line)
        )
          break;
        if (!buyer_name) buyer_name = line;
        else buyer_address_parts.push(line);
      }
    }
    if (!buyer_name) {
      const buyerJumbled = rawText.match(
        /(?:Bought|Sold)\s+([A-Z][A-Z0-9\s(),.&/-]+?)\s+(\d{4}[\/\-]\d{2}[\/\-]\d{2})/,
      );
      if (buyerJumbled) {
        const parts = buyerJumbled[1].split(/\s+NO\.|,\s*NO\./i);
        buyer_name = parts[0]?.trim() || "";
        if (parts[1]) buyer_address_parts.push("NO." + parts[1].trim());
      }
    }

    return {
      account_no: accountMatch?.[1]?.trim() || "",
      trade_date: toIso(txnDateMatch?.[1]),
      settlement: toIso(settleMatch?.[1]),
      broker_name,
      broker_address,
      buyer_name,
      buyer_address: buyer_address_parts.join(", "),
      note_type: noteType,
      page_total: pageTotalMatch?.[1]?.trim() || "",
      grand_total: totalMatch?.[1]?.trim() || "",
      security: "",
    };
  }

  async function extractFromPdf(file: File) {
    setIsExtracting(true);
    try {
      const { items, rawText } = await extractPdfText(file);
      const grouped = groupIntoRows(items);

      // Extract security hint early for Trade Confirmation (security is in doc header, not per-row)
      const securityHint = (() => {
        const m = rawText.match(
          /(?:Purchase|Sale)\s+of\s+[^(]+\(\s*([A-Z][A-Z0-9.]{2,})/i,
        );
        return m?.[1]?.trim() || "";
      })();

      let rows: ExtractedRow[] = [];
      if (isTradeConfirmation(rawText)) {
        // For Trade Confirmation, the X-position parser is most reliable since raw text is jumbled.
        // Try it first, fall back to the regex parser, then the raw-text regex patterns.
        rows = parseRowsByXColumns(items, securityHint);
        if (rows.length === 0) rows = parseTradeConfirmationRows(rawText);
      }
      if (rows.length === 0) rows = parseBoughtNoteRows(grouped);
      if (rows.length === 0) rows = parseRowsByXColumns(items);
      if (rows.length === 0) rows = parseRowsFromRawText(rawText);

      if (rows.length === 0) {
        console.warn("PDF raw text (no rows parsed):", rawText);
        setDebugRawText(rawText);
        setExtractedRows([]);
        return;
      }
      setDebugRawText("");

      const header = extractHeader(rawText, grouped, rows);

      // Backfill security ticker into Trade Confirmation rows (it's in the doc header, not per-row)
      if (header.security || securityHint) {
        const sec = header.security || securityHint;
        rows = rows.map((r) => (r.security ? r : { ...r, security: sec }));
      }

      const sum = (fn: (r: ExtractedRow) => number) =>
        rows.reduce((s, r) => s + fn(r), 0);
      const totalShares = sum((r) => r.qty);
      const totalGross = sum((r) => r.gross_value);
      const totalBrokerage = sum((r) => r.brokerage);
      const totalCds = sum((r) => r.cds_fees);
      const totalCse = sum((r) => r.cse_fees);
      const totalSec = sum((r) => r.sec);
      const totalStl = sum((r) => r.stl);
      const totalClearing = sum((r) => r.clearing_fee);
      const totalForeign = sum((r) => r.foreign_br);
      const totalAmount = sum((r) => r.amount);
      const avgRate = totalShares > 0 ? totalGross / totalShares : 0;

      const today = new Date().toISOString().split("T")[0];
      const extracted: ExtractedData = {
        trade_date: header.trade_date || today,
        contract_no: rows[0]?.contract_no || "",
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

      const noteType = (extracted.note_type || "").toLowerCase();
      const typeOk = (t: Transaction) =>
        !noteType || t.transaction_type?.toLowerCase() === noteType;

      // Group rows by security ticker and sum their quantities
      const securityTotals: Record<string, number> = {};
      for (const row of rows) {
        const ticker = row.security.split(".")[0].toUpperCase();
        securityTotals[ticker] = (securityTotals[ticker] || 0) + row.qty;
      }

      // Try to auto-map to a single transaction using total qty per security
      let bestCandidate: Transaction | undefined;
      for (const [ticker, totalQty] of Object.entries(securityTotals)) {
        const share = shares.find((s) => s.ticker?.toUpperCase() === ticker);
        // Only auto-map when we can confirm the share exists in the system
        if (!share) continue;
        const shareOk = (t: Transaction) => t.share_id === share.id;
        // Prefer exact total qty match, then any matching share+type
        bestCandidate =
          transactions.find(
            (t) =>
              shareOk(t) &&
              typeOk(t) &&
              Math.abs(Number(t.no_of_shares) - totalQty) < 0.01,
          ) || transactions.find((t) => shareOk(t) && typeOk(t));
        if (bestCandidate) break;
      }

      setFormData((prev) => ({
        ...prev,
        transaction_id: bestCandidate?.id || "",
        settlement_date: extracted.settlement || prev.settlement_date,
      }));
    } catch (err) {
      console.error("PDF extraction failed", err);
      alert("Failed to read the PDF. Please try another file.");
    } finally {
      setIsExtracting(false);
    }
  }

  function getExpectedFees(txn: Transaction) {
    const computedGross =
      (Number(txn.no_of_shares) || 0) * (Number(txn.price_per_share) || 0);
    const gross =
      computedGross > 0
        ? computedGross
        : Number(txn.total_amount_gross ?? txn.total_amount ?? 0);
    const feeType = brokerageFeeTypes.find(
      (ft) => ft.id === txn.brokerage_fee_type_id,
    );
    const rawItems = feeType?.fee_breakdown_items;
    const items: { name: string; rate: number }[] =
      typeof rawItems === "string" ? JSON.parse(rawItems) : rawItems || [];

    const findRate = (patterns: string[], excludes: string[] = []) => {
      const item = items.find((it) => {
        const name = (it.name || "").toLowerCase();
        if (excludes.some((e) => name.includes(e))) return false;
        return patterns.some((p) => name.includes(p));
      });
      return item ? Number(item.rate) || 0 : 0;
    };

    const brokerageRate = findRate(
      ["brokerage"],
      ["sec", "cse", "cds", "clearing", "levy", "cess"],
    );
    const secRate = findRate(
      ["sec cess", "sec fees", "sec fee"],
      ["share transaction", "levy"],
    );
    const exchangeRate = findRate(["cse fees", "cse fee", "cse", "exchange"]);
    const cdsRate = findRate(["cds fees", "cds fee", "cds"]);
    const govRate = findRate([
      "share transaction levy",
      "share transaction",
      "stl",
      "levy",
    ]);
    const clearingRate = findRate(["clearing"]);

    return {
      brokerage: (gross * brokerageRate) / 100,
      sec: (gross * secRate) / 100,
      exchange: (gross * exchangeRate) / 100,
      cds: (gross * cdsRate) / 100,
      gov_cess: (gross * govRate) / 100,
      clearing_fees: (gross * clearingRate) / 100,
    };
  }

  function validateExtractedData() {
    const issues: string[] = [];
    const compare: Record<string, FieldCompare> = {};

    if (!formData.transaction_id) {
      issues.push("Please select a transaction to map this note to");
      setValidationIssues(issues);
      setFieldCompare({});
      return false;
    }

    const txn = transactions.find((t) => t.id === formData.transaction_id);

    if (txn) {
      const expectedShares = Number(txn.no_of_shares) || 0;
      const expectedGross = expectedShares * (Number(txn.price_per_share) || 0);
      const expectedFees = getExpectedFees(txn);
      const expectedAvgPrice = Number(txn.price_per_share) || 0;
      const expectedNet = Number(txn.total_amount) || 0;

      const pdfShares = extractedRows.reduce((s, r) => s + r.qty, 0);
      const pdfGross = extractedRows.reduce((s, r) => s + r.gross_value, 0);
      const pdfBrokerage = extractedRows.reduce((s, r) => s + r.brokerage, 0);
      const pdfSec = extractedRows.reduce((s, r) => s + r.sec, 0);
      const pdfExchange = extractedRows.reduce((s, r) => s + r.cse_fees, 0);
      const pdfCds = extractedRows.reduce((s, r) => s + r.cds_fees, 0);
      const pdfStl = extractedRows.reduce((s, r) => s + r.stl, 0);
      const pdfClearing = extractedRows.reduce((s, r) => s + r.clearing_fee, 0);
      const pdfAvgPrice = pdfShares > 0 ? pdfGross / pdfShares : 0;
      const pdfNet = extractedRows.reduce((s, r) => s + r.amount, 0);

      const check = (
        key: string,
        actual: number,
        expected: number,
        tolerance: number,
      ) => {
        compare[key] = {
          expected,
          matches: Math.abs(actual - expected) <= tolerance,
        };
      };
      check("no_of_shares", pdfShares, expectedShares, 0.01);
      check("price_avg", pdfAvgPrice, expectedAvgPrice, 0.01);
      check("gross_amount", pdfGross, expectedGross, 0.5);
      check("brokerage", pdfBrokerage, expectedFees.brokerage, 1);
      check("sec", pdfSec, expectedFees.sec, 1);
      check("exchange", pdfExchange, expectedFees.exchange, 1);
      check("cds", pdfCds, expectedFees.cds, 1);
      check("gov_cess", pdfStl, expectedFees.gov_cess, 1);
      check("clearing_fees", pdfClearing, expectedFees.clearing_fees, 1);
      check("net_amount", pdfNet, expectedNet, 1);
    }

    setFieldCompare(compare);
    setValidationIssues(issues);
    return issues.length === 0;
  }

  function handleProcessClick() {
    if (!uploadedFile) {
      alert("Please upload a PDF first");
      return;
    }
    if (extractedRows.length === 0) {
      alert("Please wait for PDF extraction to complete");
      return;
    }
    validateExtractedData();
    setShowProcessModal(true);
  }

  async function uploadNoteFile(file: File): Promise<string | null> {
    const ext = file.name.split(".").pop() || "pdf";
    const path = `buy-sell-notes/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage
      .from("transaction-documents")
      .upload(path, file, { upsert: false });
    if (error) {
      console.error("File upload error:", error);
      return null;
    }
    return path;
  }

  async function handleViewFile(note: BuyAndSellNote) {
    if (!note.file_url) return;
    setViewingFileNoteId(note.id);
    try {
      // If it looks like a storage path (no http), generate a signed URL
      if (!note.file_url.startsWith("http")) {
        const { data, error } = await supabase.storage
          .from("transaction-documents")
          .createSignedUrl(note.file_url, 3600);
        if (error || !data?.signedUrl) {
          alert("Could not retrieve file. It may have been deleted.");
          return;
        }
        window.open(data.signedUrl, "_blank");
      } else {
        window.open(note.file_url, "_blank");
      }
    } finally {
      setViewingFileNoteId(null);
    }
  }

  function buildNotePayload(
    selectedTransaction: Transaction,
    noteType: "Buy" | "Sell",
    status: string,
    hasMismatch: boolean,
    storagePath?: string | null,
  ) {
    const totalShares = extractedRows.reduce((s, r) => s + r.qty, 0);
    const totalGross = extractedRows.reduce((s, r) => s + r.gross_value, 0);
    const totalNet = extractedRows.reduce((s, r) => s + r.amount, 0);
    const avgPrice = totalShares > 0 ? totalGross / totalShares : 0;
    const contractNo =
      extractedRows[0]?.contract_no || extractedData.contract_no || "";
    const selectedBroker = brokers.find((b) => b.id === formData.broker_id);
    const brokerName =
      selectedBroker?.broker_name || extractedData.broker_name || "";
    return {
      payload: {
        transaction_id: formData.transaction_id,
        note_type: noteType,
        note_number: contractNo || "N/A",
        broker: brokerName,
        broker_id: formData.broker_id || null,
        dealer_name: formData.dealer_name || null,
        transaction_date: extractedData.trade_date || null,
        settlement_date:
          extractedData.settlement || formData.settlement_date || null,
        file_url: storagePath ?? uploadedFile?.name ?? null,
        remarks: formData.remarks || null,
        trade_date: extractedData.trade_date || null,
        contract_no: contractNo,
        no_of_shares: totalShares,
        price_avg: avgPrice,
        gross_amount: totalGross,
        brokerage: extractedRows.reduce((s, r) => s + r.brokerage, 0),
        sec: extractedRows.reduce((s, r) => s + r.sec, 0),
        exchange: extractedRows.reduce((s, r) => s + r.cse_fees, 0),
        cds: extractedRows.reduce((s, r) => s + r.cds_fees, 0),
        gov_cess: extractedRows.reduce((s, r) => s + r.stl, 0),
        clearing_fees: extractedRows.reduce((s, r) => s + r.clearing_fee, 0),
        net_amount: totalNet,
        foreign_brokerage: extractedRows.reduce((s, r) => s + r.foreign_br, 0),
        status,
        has_mismatch: hasMismatch,
      },
      totalNet,
      contractNo,
    };
  }

  async function handleApproval() {
    if (!formData.transaction_id) {
      alert("Please select a transaction");
      return;
    }
    if (isProcessing) return;
    setIsProcessing(true);
    try {
      const selectedTransaction = transactions.find(
        (t) => t.id === formData.transaction_id,
      );
      if (!selectedTransaction) {
        alert("Selected transaction not found");
        return;
      }
      const entity = entities.find(
        (e) => e.id === selectedTransaction.entity_id,
      );
      if (!entity) {
        alert("Entity not found for the selected transaction");
        return;
      }

      const rawType = selectedTransaction.transaction_type?.toUpperCase();
      const noteType: "Buy" | "Sell" = rawType === "SELL" ? "Sell" : "Buy";
      const allMatch =
        Object.values(fieldCompare).length > 0 &&
        Object.values(fieldCompare).every((c) => c.matches);

      const storagePath = uploadedFile
        ? await uploadNoteFile(uploadedFile)
        : null;
      const { payload, totalNet, contractNo } = buildNotePayload(
        selectedTransaction,
        noteType,
        "PROCESSED",
        !allMatch,
        storagePath,
      );

      const { data: insertedNote, error: insertError } = await supabase
        .from("buy_sell_notes")
        .insert(payload)
        .select()
        .maybeSingle();
      if (insertError) throw insertError;

      const transactionType = noteType === "Buy" ? "Deduction" : "Addition";
      const { data: existing } = await supabase
        .from("cash_balance_ledger")
        .select("running_balance")
        .eq("entity_id", entity.id)
        .order("timestamp", { ascending: false })
        .limit(1);
      const lastBalance =
        existing && existing.length > 0
          ? Number(existing[0].running_balance)
          : 0;
      const newBalance =
        transactionType === "Addition"
          ? lastBalance + totalNet
          : lastBalance - totalNet;

      const { error: ledgerError } = await supabase
        .from("cash_balance_ledger")
        .insert({
          type: transactionType,
          description: `${selectedTransaction.transaction_type} - ${contractNo}`,
          code: contractNo,
          amount: totalNet,
          date: extractedData.trade_date || null,
          running_balance: newBalance,
          on_hold_amount: 0,
          entity_id: entity.id,
          bank_id: null,
          reference_id: insertedNote?.id || null,
          created_by: "System",
          notes: formData.remarks || null,
        });
      if (ledgerError) throw ledgerError;

      await loadData();
      handleCloseModals();
      alert(
        "Buy/sell note approved and processed. Cash balance has been updated.",
      );
    } catch (error: any) {
      console.error("Error processing note:", error);
      alert(
        `Failed to process note:\n\n${error?.message || JSON.stringify(error)}`,
      );
    } finally {
      setIsProcessing(false);
    }
  }

  async function handleSendForApproval() {
    if (!formData.transaction_id) {
      alert("Please select a transaction");
      return;
    }
    if (isProcessing) return;
    setIsProcessing(true);
    try {
      const selectedTransaction = transactions.find(
        (t) => t.id === formData.transaction_id,
      );
      if (!selectedTransaction) {
        alert("Selected transaction not found");
        return;
      }

      const rawType = selectedTransaction.transaction_type?.toUpperCase();
      const noteType: "Buy" | "Sell" = rawType === "SELL" ? "Sell" : "Buy";
      const storagePath = uploadedFile
        ? await uploadNoteFile(uploadedFile)
        : null;
      const { payload } = buildNotePayload(
        selectedTransaction,
        noteType,
        "PENDING_APPROVAL",
        true,
        storagePath,
      );

      const { error } = await supabase.from("buy_sell_notes").insert(payload);
      if (error) throw error;

      await loadData();
      handleCloseModals();
      alert(
        "Note saved with mismatches. Sent for approval — no cash balance changes made yet.",
      );
    } catch (error: any) {
      console.error("Error sending for approval:", error);
      alert(
        `Failed to save note:\n\n${error?.message || JSON.stringify(error)}`,
      );
    } finally {
      setIsProcessing(false);
    }
  }

  function handleReject() {
    if (!confirm("Are you sure you want to cancel this upload?")) return;
    handleCloseModals();
  }

  function updateManualRow(idx: number, field: keyof ManualRow, value: string) {
    setManualRows((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r)),
    );
  }

  function addManualRow() {
    setManualRows((prev) => [...prev, emptyManualRow()]);
  }

  function removeManualRow(idx: number) {
    setManualRows((prev) =>
      prev.length === 1 ? [emptyManualRow()] : prev.filter((_, i) => i !== idx),
    );
  }

  async function handleSaveManual() {
    const validRows = manualRows.filter(
      (r) =>
        r.entity_id &&
        r.share_id &&
        r.no_of_shares &&
        r.total_cost &&
        r.settlement_date,
    );
    if (validRows.length === 0) {
      alert(
        "Please fill in at least one row with Entity, Share, No. of Shares, Settlement Date, and Total Cost.",
      );
      return;
    }

    setIsSavingManual(true);
    try {
      for (const row of validRows) {
        const entity = entities.find((e) => e.id === row.entity_id);
        if (!entity) continue;

        const qty = parseFloat(row.no_of_shares) || 0;
        const totalCost = parseFloat(row.total_cost) || 0;
        const pricePerShare = qty > 0 ? totalCost / qty : 0;

        // Create transaction record
        const { data: insertedTxn, error: txnError } = await supabase
          .from("transactions")
          .insert({
            entity_id: row.entity_id,
            share_id: row.share_id,
            transaction_type: row.note_type === "Buy" ? "BUY" : "SELL",
            order_type: "DAY",
            transaction_date: row.settlement_date,
            no_of_shares: qty,
            price_per_share: pricePerShare,
            total_amount_gross: totalCost,
            fees: 0,
            net_price_per_share: pricePerShare,
            total_amount: totalCost,
            approval_status: "APPROVED",
            cds_account_id: row.broker_cds_account || null,
          })
          .select()
          .maybeSingle();

        if (txnError) throw txnError;

        // Create buy/sell note linked to the transaction
        // broker column is NOT NULL in schema — use account info or placeholder
        const { data: insertedNote, error: noteError } = await supabase
          .from("buy_sell_notes")
          .insert({
            transaction_id: insertedTxn!.id,
            note_type: row.note_type,
            note_number: `MAN-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${String(Date.now()).slice(-5)}`,
            broker: row.broker_cds_account || "Manual Entry",
            settlement_date: row.settlement_date,
            transaction_date: row.settlement_date,
            trade_date: row.settlement_date,
            no_of_shares: qty,
            price_avg: pricePerShare,
            gross_amount: totalCost,
            net_amount: totalCost,
          })
          .select()
          .maybeSingle();

        if (noteError) throw noteError;

        // Update cash ledger — use entity.id (UUID), not entity.entity_id (code string)
        const transactionType =
          row.note_type === "Buy" ? "Deduction" : "Addition";
        const { data: existing } = await supabase
          .from("cash_balance_ledger")
          .select("running_balance")
          .eq("entity_id", entity.id)
          .order("timestamp", { ascending: false })
          .limit(1);
        const lastBalance =
          existing && existing.length > 0
            ? Number(existing[0].running_balance)
            : 0;
        const newBalance =
          transactionType === "Addition"
            ? lastBalance + totalCost
            : lastBalance - totalCost;

        const { error: ledgerError } = await supabase
          .from("cash_balance_ledger")
          .insert({
            type: transactionType,
            description: `${row.note_type} - ${shares.find((s) => s.id === row.share_id)?.ticker || ""}`,
            amount: totalCost,
            date: row.settlement_date,
            running_balance: newBalance,
            on_hold_amount: 0,
            entity_id: entity.id,
            bank_id: null,
            reference_id: insertedNote?.id || null,
            created_by: "System",
          });

        if (ledgerError) throw ledgerError;
      }

      await loadData();
      setShowManualModal(false);
      setManualRows([emptyManualRow()]);
      alert(
        `${validRows.length} record${validRows.length === 1 ? "" : "s"} saved successfully.`,
      );
    } catch (error: unknown) {
      console.error("Error saving manual entries:", error);
      const msg =
        error instanceof Error
          ? error.message
          : typeof error === "object" && error !== null && "message" in error
            ? String((error as { message: unknown }).message)
            : String(error);
      alert(`Failed to save entries: ${msg}`);
    } finally {
      setIsSavingManual(false);
    }
  }

  function openEditNote(note: BuyAndSellNote) {
    setEditNote({
      id: note.id,
      note_type: note.note_type,
      note_number: note.note_number || "",
      broker: note.broker || "",
      dealer_name: note.dealer_name || "",
      trade_date: note.trade_date || "",
      settlement_date: note.settlement_date || "",
      contract_no: note.contract_no || "",
      no_of_shares: note.no_of_shares != null ? String(note.no_of_shares) : "",
      price_avg: note.price_avg != null ? String(note.price_avg) : "",
      gross_amount: note.gross_amount != null ? String(note.gross_amount) : "",
      brokerage: note.brokerage != null ? String(note.brokerage) : "",
      sec: note.sec != null ? String(note.sec) : "",
      exchange: note.exchange != null ? String(note.exchange) : "",
      cds: note.cds != null ? String(note.cds) : "",
      gov_cess: note.gov_cess != null ? String(note.gov_cess) : "",
      clearing_fees:
        note.clearing_fees != null ? String(note.clearing_fees) : "",
      net_amount: note.net_amount != null ? String(note.net_amount) : "",
      foreign_brokerage:
        note.foreign_brokerage != null ? String(note.foreign_brokerage) : "",
      remarks: note.remarks || "",
    });
  }

  async function handleSaveEdit() {
    if (!editNote) return;
    setIsSavingEdit(true);
    try {
      const { error } = await supabase
        .from("buy_sell_notes")
        .update({
          note_type: editNote.note_type,
          note_number: editNote.note_number || `NOTE-${Date.now()}`,
          broker: editNote.broker || "Unknown",
          dealer_name: editNote.dealer_name || null,
          trade_date: editNote.trade_date || null,
          settlement_date: editNote.settlement_date,
          contract_no: editNote.contract_no || null,
          no_of_shares:
            editNote.no_of_shares !== "" ? Number(editNote.no_of_shares) : null,
          price_avg:
            editNote.price_avg !== "" ? Number(editNote.price_avg) : null,
          gross_amount:
            editNote.gross_amount !== "" ? Number(editNote.gross_amount) : null,
          brokerage:
            editNote.brokerage !== "" ? Number(editNote.brokerage) : null,
          sec: editNote.sec !== "" ? Number(editNote.sec) : null,
          exchange: editNote.exchange !== "" ? Number(editNote.exchange) : null,
          cds: editNote.cds !== "" ? Number(editNote.cds) : null,
          gov_cess: editNote.gov_cess !== "" ? Number(editNote.gov_cess) : null,
          clearing_fees:
            editNote.clearing_fees !== ""
              ? Number(editNote.clearing_fees)
              : null,
          net_amount:
            editNote.net_amount !== "" ? Number(editNote.net_amount) : null,
          foreign_brokerage:
            editNote.foreign_brokerage !== ""
              ? Number(editNote.foreign_brokerage)
              : null,
          remarks: editNote.remarks || null,
        })
        .eq("id", editNote.id);
      if (error) throw error;
      await loadData();
      setEditNote(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(`Failed to save: ${msg}`);
    } finally {
      setIsSavingEdit(false);
    }
  }

  async function handleDeleteNote(id: string) {
    if (
      !confirm(
        "Delete this buy/sell note? The corresponding cash balance entry will also be reversed.",
      )
    )
      return;
    setDeletingId(id);
    try {
      // Find ledger entry linked to this note
      const { data: ledgerEntry } = await supabase
        .from("cash_balance_ledger")
        .select("id, entity_id, amount, timestamp, type")
        .eq("reference_id", id)
        .maybeSingle();

      // Delete the buy/sell note
      const { error: deleteError } = await supabase
        .from("buy_sell_notes")
        .delete()
        .eq("id", id);
      if (deleteError) throw deleteError;

      // Reverse the cash ledger entry and recompute running balances
      if (ledgerEntry) {
        const { error: ledgerDeleteError } = await supabase
          .from("cash_balance_ledger")
          .delete()
          .eq("id", ledgerEntry.id);
        if (ledgerDeleteError) throw ledgerDeleteError;

        // Recompute running balances for all subsequent entries of the same entity
        const { data: subsequentEntries } = await supabase
          .from("cash_balance_ledger")
          .select("id, type, amount, timestamp")
          .eq("entity_id", ledgerEntry.entity_id)
          .gte("timestamp", ledgerEntry.timestamp)
          .order("timestamp", { ascending: true });

        if (subsequentEntries && subsequentEntries.length > 0) {
          // Get balance just before the deleted entry
          const { data: priorEntry } = await supabase
            .from("cash_balance_ledger")
            .select("running_balance")
            .eq("entity_id", ledgerEntry.entity_id)
            .lt("timestamp", ledgerEntry.timestamp)
            .order("timestamp", { ascending: false })
            .limit(1)
            .maybeSingle();

          let runningBal = priorEntry ? Number(priorEntry.running_balance) : 0;
          for (const entry of subsequentEntries) {
            runningBal =
              entry.type === "Addition"
                ? runningBal + Number(entry.amount)
                : runningBal - Number(entry.amount);
            await supabase
              .from("cash_balance_ledger")
              .update({ running_balance: runningBal })
              .eq("id", entry.id);
          }
        }
      }

      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(`Failed to delete: ${msg}`);
    } finally {
      setDeletingId(null);
    }
  }

  function handleCloseModals() {
    setShowModal(false);
    setShowProcessModal(false);
    setUploadedFile(null);
    setExtractedData({
      trade_date: "",
      contract_no: "",
      no_of_shares: "",
      price_avg: "",
      gross_amount: "",
      brokerage: "",
      sec: "",
      exchange: "",
      cds: "",
      gov_cess: "",
      clearing_fees: "",
      net_amount: "",
      settlement: "",
      foreign_brokerage: "",
    });
    setFormData({
      transaction_id: "",
      broker_id: "",
      dealer_name: "",
      entity_account_number: "",
      settlement_date: new Date().toISOString().split("T")[0],
      remarks: "",
    });
    setValidationIssues([]);
    setFieldCompare({});
    setExtractedRows([]);
    setDebugRawText("");
    setIsProcessing(false);
  }

  const filteredNotes = notes.filter((note) => {
    const txn = transactions.find((t) => t.id === note.transaction_id);
    const noteEntity = txn
      ? entities.find((e) => e.id === txn.entity_id)
      : undefined;
    const noteShare = txn
      ? shares.find((s) => s.id === txn.share_id)
      : undefined;
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch =
      !searchTerm ||
      note.note_number?.toLowerCase().includes(searchLower) ||
      note.dealer_name?.toLowerCase().includes(searchLower) ||
      note.contract_no?.toLowerCase().includes(searchLower) ||
      noteEntity?.name?.toLowerCase().includes(searchLower) ||
      noteShare?.ticker?.toLowerCase().includes(searchLower);
    const matchesDateFrom =
      !filterDateFrom ||
      (note.trade_date || note.settlement_date) >= filterDateFrom;
    const matchesDateTo =
      !filterDateTo ||
      (note.trade_date || note.settlement_date) <= filterDateTo;
    const matchesType = !filterNoteType || note.note_type === filterNoteType;
    return matchesSearch && matchesDateFrom && matchesDateTo && matchesType;
  });

  const availableEntityAccounts =
    formData.broker_id && formData.transaction_id
      ? (() => {
          const transaction = transactions.find(
            (t) => t.id === formData.transaction_id,
          );
          if (!transaction) return [];
          const entity = entities.find((e) => e.id === transaction.entity_id);
          if (!entity) return [];
          return entityBrokers.filter(
            (eb) =>
              eb.entity_id === entity.entity_id &&
              eb.broker_id === formData.broker_id,
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
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setShowManualModal(true)}
              className="flex items-center space-x-2 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-800 transition-colors"
            >
              <ClipboardList className="w-5 h-5" />
              <span>Manual Entry</span>
            </button>
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-5 h-5" />
              <span>Upload Note</span>
            </button>
          </div>
        </div>
        <p className="text-gray-600">
          Upload and process contract notes for approved buy/sell transactions
        </p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6 p-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex-1 min-w-48 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search by contract no, entity, ticker, dealer..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <label className="text-xs font-semibold text-gray-500 whitespace-nowrap">
              From
            </label>
            <input
              type="date"
              value={filterDateFrom}
              onChange={(e) => setFilterDateFrom(e.target.value)}
              className="px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <label className="text-xs font-semibold text-gray-500 whitespace-nowrap">
              To
            </label>
            <input
              type="date"
              value={filterDateTo}
              onChange={(e) => setFilterDateTo(e.target.value)}
              className="px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={filterNoteType}
            onChange={(e) => setFilterNoteType(e.target.value)}
            className="px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Types</option>
            <option value="Buy">Buy</option>
            <option value="Sell">Sell</option>
          </select>
          {(filterDateFrom || filterDateTo || filterNoteType) && (
            <button
              onClick={() => {
                setFilterDateFrom("");
                setFilterDateTo("");
                setFilterNoteType("");
              }}
              className="px-2.5 py-1.5 text-xs font-medium text-gray-500 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase w-4"></th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                  Entity
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                  Ticker
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                  Type
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                  Trade Date
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">
                  Shares
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">
                  Price
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">
                  Net Amount
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                  Settlement
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredNotes.map((note) => {
                const matchedTxn = allTransactions.find(
                  (t) => t.id === note.transaction_id,
                );
                const noteEntity = matchedTxn
                  ? entities.find((e) => e.id === matchedTxn.entity_id)
                  : undefined;
                const noteShare = matchedTxn
                  ? shares.find((s) => s.id === matchedTxn.share_id)
                  : undefined;
                const noteBroker = note.broker_id
                  ? brokers.find((b) => b.id === note.broker_id)
                  : null;
                const noteStatus = note.status || "PROCESSED";
                const isExpanded = expandedNoteId === note.id;

                const statusCfg: Record<
                  string,
                  { label: string; cls: string }
                > = {
                  PROCESSED: {
                    label: "Processed",
                    cls: "bg-green-100 text-green-800",
                  },
                  PENDING_APPROVAL: {
                    label: "Pending Approval",
                    cls: "bg-amber-100 text-amber-800",
                  },
                  APPROVED: {
                    label: "Approved",
                    cls: "bg-blue-100 text-blue-800",
                  },
                };
                const scfg = statusCfg[noteStatus] || statusCfg["PROCESSED"];

                return (
                  <>
                    <tr
                      key={note.id}
                      className={`hover:bg-gray-50 cursor-pointer transition-colors ${isExpanded ? "bg-blue-50" : ""}`}
                      onClick={() =>
                        setExpandedNoteId(isExpanded ? null : note.id)
                      }
                    >
                      <td className="px-4 py-3 text-gray-400">
                        <svg
                          className={`w-3.5 h-3.5 transition-transform ${isExpanded ? "rotate-90" : ""}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 5l7 7-7 7"
                          />
                        </svg>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {noteEntity?.name || "-"}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="inline-flex px-2 py-0.5 rounded text-xs font-semibold bg-gray-100 text-gray-700 font-mono">
                          {noteShare?.ticker || "-"}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                            note.note_type === "Buy"
                              ? "bg-green-100 text-green-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {note.note_type}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                        {note.trade_date
                          ? new Date(note.trade_date).toLocaleDateString()
                          : "-"}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 text-right tabular-nums">
                        {note.no_of_shares?.toLocaleString() || "-"}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 text-right tabular-nums">
                        {note.price_avg
                          ? `Rs. ${note.price_avg.toFixed(2)}`
                          : "-"}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold text-gray-900 text-right tabular-nums">
                        {note.net_amount
                          ? `Rs. ${note.net_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                          : "-"}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                        {note.settlement_date
                          ? new Date(note.settlement_date).toLocaleDateString()
                          : "-"}
                      </td>
                      <td
                        className="px-4 py-3 whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${scfg.cls}`}
                        >
                          {noteStatus === "PENDING_APPROVAL" && (
                            <AlertTriangle className="w-3 h-3" />
                          )}
                          {noteStatus === "PROCESSED" && (
                            <CheckCircle className="w-3 h-3" />
                          )}
                          {scfg.label}
                        </span>
                        {note.has_mismatch && noteStatus === "PROCESSED" && (
                          <span className="ml-1 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-700">
                            Mismatch
                          </span>
                        )}
                      </td>
                      <td
                        className="px-4 py-3 whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center space-x-1">
                          {note.file_url && (
                            <button
                              onClick={() => handleViewFile(note)}
                              disabled={viewingFileNoteId === note.id}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50"
                              title="View uploaded file"
                            >
                              {viewingFileNoteId === note.id ? (
                                <span className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin inline-block" />
                              ) : (
                                <Eye className="w-4 h-4" />
                              )}
                            </button>
                          )}
                          <button
                            onClick={() => openEditNote(note)}
                            className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteNote(note.id)}
                            disabled={deletingId === note.id}
                            className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr
                        key={`${note.id}-detail`}
                        className="bg-blue-50 border-b border-blue-100"
                      >
                        <td colSpan={11} className="px-6 py-4">
                          <div className="grid grid-cols-3 gap-4 mb-4">
                            <div className="bg-white rounded-lg border border-gray-200 px-4 py-3">
                              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-0.5">
                                Contract No.
                              </p>
                              <p className="text-sm font-bold text-gray-900 font-mono">
                                {note.contract_no || note.note_number || "-"}
                              </p>
                            </div>
                            <div className="bg-white rounded-lg border border-sky-200 px-4 py-3">
                              <p className="text-xs font-semibold text-sky-500 uppercase tracking-wide mb-0.5">
                                Share
                              </p>
                              <p className="text-sm font-bold text-gray-900">
                                {noteShare?.share_name || "-"}
                              </p>
                              <p className="text-xs text-gray-500 font-mono mt-0.5">
                                {noteShare?.ticker || ""}
                              </p>
                            </div>
                            <div className="bg-white rounded-lg border border-gray-200 px-4 py-3">
                              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-0.5">
                                Avg. Price
                              </p>
                              <p className="text-sm font-bold text-gray-900">
                                {note.price_avg != null
                                  ? `Rs. ${Number(note.price_avg).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                                  : "-"}
                              </p>
                              <p className="text-xs text-gray-500 mt-0.5">
                                {note.no_of_shares != null
                                  ? `${Number(note.no_of_shares).toLocaleString()} shares`
                                  : ""}
                              </p>
                            </div>
                          </div>
                          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                            <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
                              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                                Fee Breakdown
                              </p>
                            </div>
                            <div className="grid grid-cols-4 gap-0 divide-x divide-gray-100 text-sm">
                              {[
                                {
                                  label: "Gross Amount",
                                  value: note.gross_amount,
                                },
                                { label: "Brokerage", value: note.brokerage },
                                { label: "SEC", value: note.sec },
                                {
                                  label: "CSE / Exchange",
                                  value: note.exchange,
                                },
                                { label: "CDS Fees", value: note.cds },
                                {
                                  label: "Gov. Levy (STL)",
                                  value: note.gov_cess,
                                },
                                {
                                  label: "Clearing Fees",
                                  value: note.clearing_fees,
                                },
                                { label: "Net Amount", value: note.net_amount },
                              ].map(({ label, value }) => (
                                <div key={label} className="px-4 py-3">
                                  <p className="text-xs text-gray-500 mb-0.5">
                                    {label}
                                  </p>
                                  <p
                                    className={`text-sm font-semibold ${label === "Net Amount" ? "text-gray-900 text-base" : "text-gray-700"}`}
                                  >
                                    {value != null
                                      ? `Rs. ${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                                      : "-"}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                          <div className="mt-3 flex items-center gap-4">
                            {note.remarks && (
                              <p className="text-xs text-gray-500">
                                <span className="font-semibold">Remarks:</span>{" "}
                                {note.remarks}
                              </p>
                            )}
                            {note.file_url && (
                              <button
                                onClick={() => handleViewFile(note)}
                                disabled={viewingFileNoteId === note.id}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-50 ml-auto"
                              >
                                {viewingFileNoteId === note.id ? (
                                  <span className="w-3.5 h-3.5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin inline-block" />
                                ) : (
                                  <Eye className="w-3.5 h-3.5" />
                                )}
                                View Document
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[98vh] flex flex-col">
            <div className="border-b border-gray-200 px-5 py-3">
              <h2 className="text-base font-bold text-gray-900">
                Upload Buy/Sell Note
              </h2>
              <p className="text-xs text-blue-600 mt-0.5">
                Select the matching approved transaction, upload the PDF, then
                review &amp; process.
              </p>
            </div>

            <div className="px-5 py-3 space-y-3 overflow-y-auto flex-1">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Transaction <span className="text-red-500">*</span>
                </label>
                {(() => {
                  const selectedTxn = transactions.find(
                    (t) => t.id === formData.transaction_id,
                  );
                  const selectedShare = selectedTxn
                    ? shares.find((s) => s.id === selectedTxn.share_id)
                    : undefined;
                  const selectedEntity = selectedTxn
                    ? entities.find((e) => e.id === selectedTxn.entity_id)
                    : undefined;
                  const txnSearchLower = txnSearchTerm.toLowerCase();
                  const filteredTxns = transactions.filter((t) => {
                    const sh = shares.find((s) => s.id === t.share_id);
                    const en = entities.find((e) => e.id === t.entity_id);
                    const label =
                      `${t.transaction_type} ${sh?.ticker || ""} ${en?.name || ""} ${Number(t.no_of_shares).toLocaleString()} ${Number(t.price_per_share).toFixed(4)} ${t.transaction_date || ""}`.toLowerCase();
                    return !txnSearchTerm || label.includes(txnSearchLower);
                  });
                  return (
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => {
                          setTxnDropdownOpen(!txnDropdownOpen);
                          setTxnSearchTerm("");
                        }}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 text-sm border rounded-lg transition-colors text-left ${txnDropdownOpen ? "border-blue-500 ring-2 ring-blue-100" : "border-gray-300 hover:border-gray-400"} bg-white`}
                      >
                        {selectedTxn ? (
                          <span className="flex items-center gap-2 min-w-0">
                            <span
                              className={`text-xs font-semibold px-1.5 py-0.5 rounded flex-shrink-0 ${selectedTxn.transaction_type === "BUY" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}
                            >
                              {selectedTxn.transaction_type}
                            </span>
                            <span className="font-mono font-bold text-gray-900 flex-shrink-0">
                              {selectedShare?.ticker || "?"}
                            </span>
                            <span className="text-gray-600 truncate">
                              {selectedEntity?.name || "?"}
                            </span>
                            <span className="text-gray-400 flex-shrink-0 text-xs">
                              {Number(
                                selectedTxn.no_of_shares,
                              ).toLocaleString()}{" "}
                              @ {Number(selectedTxn.price_per_share).toFixed(4)}
                            </span>
                          </span>
                        ) : (
                          <span className="text-gray-400">
                            Select pending transaction...
                          </span>
                        )}
                        <svg
                          className={`w-4 h-4 text-gray-400 flex-shrink-0 ml-2 transition-transform ${txnDropdownOpen ? "rotate-180" : ""}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 9l-7 7-7-7"
                          />
                        </svg>
                      </button>

                      {txnDropdownOpen && (
                        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
                          <div className="flex items-center gap-2 px-2.5 py-2 border-b border-gray-100">
                            <Search className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                            <input
                              type="text"
                              autoFocus
                              value={txnSearchTerm}
                              onChange={(e) => setTxnSearchTerm(e.target.value)}
                              placeholder="Type to search..."
                              className="flex-1 text-sm focus:outline-none"
                            />
                            {txnSearchTerm && (
                              <button
                                type="button"
                                onClick={() => setTxnSearchTerm("")}
                                className="text-gray-400 hover:text-gray-600 text-xs flex-shrink-0"
                              >
                                ✕
                              </button>
                            )}
                          </div>
                          <div className="max-h-48 overflow-y-auto">
                            {filteredTxns.length === 0 ? (
                              <div className="px-3 py-3 text-xs text-gray-400 italic text-center">
                                No transactions match
                              </div>
                            ) : (
                              filteredTxns.map((t) => {
                                const sh = shares.find(
                                  (s) => s.id === t.share_id,
                                );
                                const en = entities.find(
                                  (e) => e.id === t.entity_id,
                                );
                                const isSelected =
                                  t.id === formData.transaction_id;
                                return (
                                  <button
                                    key={t.id}
                                    type="button"
                                    onClick={() => {
                                      const entity = entities.find(
                                        (e) => e.id === t.entity_id,
                                      );
                                      const matchingEb = entity
                                        ? entityBrokers.find(
                                            (eb) =>
                                              eb.entity_id === entity.id &&
                                              eb.broker_id,
                                          )
                                        : null;
                                      setFormData({
                                        ...formData,
                                        transaction_id: t.id,
                                        broker_id:
                                          matchingEb?.broker_id ||
                                          formData.broker_id,
                                      });
                                      setTxnDropdownOpen(false);
                                      setTxnSearchTerm("");
                                    }}
                                    className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2 border-b border-gray-50 last:border-0 transition-colors ${isSelected ? "bg-blue-50" : "hover:bg-gray-50"}`}
                                  >
                                    <span
                                      className={`font-semibold px-1.5 py-0.5 rounded flex-shrink-0 ${t.transaction_type === "BUY" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}
                                    >
                                      {t.transaction_type}
                                    </span>
                                    <span className="font-mono font-bold text-gray-800 flex-shrink-0">
                                      {sh?.ticker || "?"}
                                    </span>
                                    <span className="text-gray-600 truncate flex-1">
                                      {en?.name || "?"}
                                    </span>
                                    <span className="text-gray-400 flex-shrink-0">
                                      {Number(t.no_of_shares).toLocaleString()}{" "}
                                      @ {Number(t.price_per_share).toFixed(4)}
                                    </span>
                                    {t.transaction_date && (
                                      <span className="text-gray-400 flex-shrink-0">
                                        {new Date(
                                          t.transaction_date,
                                        ).toLocaleDateString()}
                                      </span>
                                    )}
                                  </button>
                                );
                              })
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>

              {(() => {
                const selTxn = transactions.find(
                  (t) => t.id === formData.transaction_id,
                );
                if (!selTxn) return null;
                const selEntity = entities.find(
                  (e) => e.id === selTxn.entity_id,
                );
                const selShare = shares.find((s) => s.id === selTxn.share_id);
                const selBroker = formData.broker_id
                  ? brokers.find((b) => b.id === formData.broker_id)
                  : null;
                const selEb =
                  selEntity && formData.broker_id
                    ? entityBrokers.find(
                        (eb) =>
                          eb.entity_id === selEntity.id &&
                          eb.broker_id === formData.broker_id,
                      )
                    : null;
                const entityBank = selEntity
                  ? banks.find((b) => b.entity_id === selEntity.id)
                  : null;
                return (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-2">
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-white rounded border border-blue-100 px-3 py-2">
                        <p className="text-gray-400 font-semibold uppercase tracking-wide mb-0.5">
                          Entity
                        </p>
                        <p className="font-bold text-gray-900">
                          {selEntity?.name || "-"}
                        </p>
                      </div>
                      <div className="bg-white rounded border border-blue-100 px-3 py-2">
                        <p className="text-gray-400 font-semibold uppercase tracking-wide mb-0.5">
                          Transaction Date
                        </p>
                        <p className="font-bold text-gray-900">
                          {selTxn.transaction_date
                            ? new Date(
                                selTxn.transaction_date,
                              ).toLocaleDateString("en-GB", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              })
                            : "-"}
                        </p>
                        <p className="text-gray-500 mt-0.5">
                          {selTxn.transaction_type} ·{" "}
                          {Number(selTxn.no_of_shares).toLocaleString()} @
                          Rs.&nbsp;{Number(selTxn.price_per_share).toFixed(4)}
                        </p>
                      </div>
                      {selBroker && (
                        <div className="bg-white rounded border border-blue-100 px-3 py-2">
                          <p className="text-gray-400 font-semibold uppercase tracking-wide mb-0.5">
                            Broker
                          </p>
                          <p className="font-bold text-gray-900">
                            {selBroker.broker_name}
                          </p>
                          {selEb?.broker_account_number && (
                            <p className="text-gray-500 mt-0.5">
                              Client A/C:{" "}
                              <span className="font-mono">
                                {selEb.broker_account_number}
                              </span>
                            </p>
                          )}
                          {selEb?.custodian_account_number && (
                            <p className="text-gray-500 mt-0.5">
                              CDS:{" "}
                              <span className="font-mono">
                                {selEb.custodian_account_number}
                              </span>
                            </p>
                          )}
                        </div>
                      )}
                      {entityBank && (
                        <div className="bg-white rounded border border-blue-100 px-3 py-2">
                          <p className="text-gray-400 font-semibold uppercase tracking-wide mb-0.5">
                            Entity Bank Account
                          </p>
                          <p className="font-bold text-gray-900">
                            {entityBank.name}
                          </p>
                          {entityBank.account_number && (
                            <p className="text-gray-500 mt-0.5 font-mono">
                              {entityBank.account_number}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    Broker <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.broker_id}
                    onChange={(e) =>
                      setFormData({ ...formData, broker_id: e.target.value })
                    }
                    className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    Contact Person
                  </label>
                  <input
                    type="text"
                    value={formData.dealer_name}
                    onChange={(e) =>
                      setFormData({ ...formData, dealer_name: e.target.value })
                    }
                    className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter contact person name"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Upload PDF <span className="text-red-500">*</span>
                </label>
                <div className="flex items-center gap-2">
                  <Upload className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={handleFileUpload}
                    className="flex-1 px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                {isExtracting && (
                  <div className="mt-1.5 text-xs text-blue-600 flex items-center gap-1.5">
                    <div className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                    <span>Extracting data from PDF...</span>
                  </div>
                )}
                {uploadedFile && !isExtracting && extractedRows.length > 0 && (
                  <div className="mt-1.5 text-xs text-green-600 flex items-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>
                      {uploadedFile.name} — {extractedRows.length} line item
                      {extractedRows.length === 1 ? "" : "s"} extracted
                    </span>
                  </div>
                )}
                {uploadedFile &&
                  !isExtracting &&
                  extractedRows.length === 0 &&
                  debugRawText && (
                    <div className="mt-2 bg-amber-50 border border-amber-300 rounded-lg p-2.5">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-amber-900">
                            Could not auto-extract line items
                          </p>
                          <p className="text-xs text-amber-700 mt-0.5">
                            PDF layout does not match expected patterns.
                          </p>
                          <textarea
                            readOnly
                            value={debugRawText}
                            className="mt-1.5 w-full h-28 text-xs font-mono p-1.5 border border-amber-300 rounded bg-white text-gray-700"
                          />
                        </div>
                      </div>
                    </div>
                  )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Remarks
                </label>
                <textarea
                  value={formData.remarks}
                  onChange={(e) =>
                    setFormData({ ...formData, remarks: e.target.value })
                  }
                  rows={2}
                  className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Additional notes..."
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 px-5 py-3 border-t border-gray-200">
              <button
                type="button"
                onClick={handleCloseModals}
                className="px-4 py-1.5 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleProcessClick}
                disabled={
                  !uploadedFile || isExtracting || !formData.transaction_id
                }
                className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                Review & Process
              </button>
            </div>
          </div>
        </div>
      )}

      {showProcessModal &&
        (() => {
          const txn = transactions.find(
            (t) => t.id === formData.transaction_id,
          );
          const txnEntity = txn
            ? entities.find((e) => e.id === txn.entity_id)
            : null;
          const txnShare = txn
            ? shares.find((s) => s.id === txn.share_id)
            : null;

          const pdfShares = extractedRows.reduce((s, r) => s + r.qty, 0);
          const pdfGross = extractedRows.reduce((s, r) => s + r.gross_value, 0);
          const pdfBrokerage = extractedRows.reduce(
            (s, r) => s + r.brokerage,
            0,
          );
          const pdfSec = extractedRows.reduce((s, r) => s + r.sec, 0);
          const pdfExchange = extractedRows.reduce((s, r) => s + r.cse_fees, 0);
          const pdfCds = extractedRows.reduce((s, r) => s + r.cds_fees, 0);
          const pdfStl = extractedRows.reduce((s, r) => s + r.stl, 0);
          const pdfClearing = extractedRows.reduce(
            (s, r) => s + r.clearing_fee,
            0,
          );
          const pdfForeignBr = extractedRows.reduce(
            (s, r) => s + r.foreign_br,
            0,
          );
          const pdfNet = extractedRows.reduce((s, r) => s + r.amount, 0);
          const pdfAvgPrice = pdfShares > 0 ? pdfGross / pdfShares : 0;

          const fmtAmt = (v: number) =>
            `Rs. ${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
          const fmtNum = (v: number) => v.toLocaleString();

          const comparedFields: {
            key: string;
            label: string;
            pdfValue: string;
          }[] = [
            {
              key: "no_of_shares",
              label: "No. of Shares",
              pdfValue: fmtNum(pdfShares),
            },
            {
              key: "price_avg",
              label: "Avg Price",
              pdfValue: fmtAmt(pdfAvgPrice),
            },
            {
              key: "gross_amount",
              label: "Gross Amount",
              pdfValue: fmtAmt(pdfGross),
            },
            {
              key: "brokerage",
              label: "Brokerage",
              pdfValue: fmtAmt(pdfBrokerage),
            },
            { key: "sec", label: "SEC", pdfValue: fmtAmt(pdfSec) },
            {
              key: "exchange",
              label: "CSE / Exchange",
              pdfValue: fmtAmt(pdfExchange),
            },
            { key: "cds", label: "CDS Fees", pdfValue: fmtAmt(pdfCds) },
            {
              key: "gov_cess",
              label: "Share Transaction Levy",
              pdfValue: fmtAmt(pdfStl),
            },
            {
              key: "clearing_fees",
              label: "Clearing Fees",
              pdfValue: fmtAmt(pdfClearing),
            },
            {
              key: "net_amount",
              label: "Net Amount",
              pdfValue: fmtAmt(pdfNet),
            },
          ];

          const isBuy = txn?.transaction_type?.toUpperCase() === "BUY";

          return (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-xl shadow-xl max-w-5xl w-full max-h-[90vh] overflow-y-auto">
                <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">
                      cess Contract Note
                    </h2>
                    {txn && (
                      <p className="text-sm text-gray-500 mt-0.5">
                        Mapped to:{" "}
                        <span className="font-semibold text-gray-700">
                          {txn.transaction_type} — {txnShare?.ticker} —{" "}
                          {txnEntity?.name} —{" "}
                          {Number(txn.no_of_shares).toLocaleString()} shares @{" "}
                          {Number(txn.price_per_share).toFixed(2)}
                        </span>
                      </p>
                    )}
                  </div>
                  {extractedData.note_type && (
                    <span
                      className={`inline-flex px-3 py-1 rounded-full text-sm font-semibold ${
                        extractedData.note_type === "Buy"
                          ? "bg-green-100 text-green-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {extractedData.note_type === "Buy"
                        ? "BOUGHT Note"
                        : "SOLD Note"}
                    </span>
                  )}
                </div>

                <div className="p-6 space-y-6">
                  {/* Broker / Client A/C / Settlement summary */}
                  {(() => {
                    const selectedBroker = formData.broker_id
                      ? brokers.find((b) => b.id === formData.broker_id)
                      : null;
                    const settlementDate =
                      extractedData.settlement || formData.settlement_date;
                    const txnForAc =
                      transactions.find(
                        (t) => t.id === formData.transaction_id,
                      ) ||
                      allTransactions.find(
                        (t) => t.id === formData.transaction_id,
                      );
                    const entityForAc = txnForAc
                      ? entities.find((e) => e.id === txnForAc.entity_id)
                      : null;
                    const matchedEb = entityForAc
                      ? entityBrokers.find(
                          (eb) =>
                            eb.entity_id === entityForAc.id &&
                            eb.broker_id === formData.broker_id,
                        )
                      : null;
                    const clientAc =
                      matchedEb?.broker_account_number ||
                      matchedEb?.custodian_account_number ||
                      extractedData.account_no ||
                      null;
                    return (
                      <div className="grid grid-cols-3 gap-3">
                        <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2.5">
                          <p className="text-xs font-semibold text-blue-500 uppercase tracking-wide mb-0.5">
                            Broker
                          </p>
                          <p className="text-sm font-bold text-blue-900">
                            {selectedBroker?.broker_name || "-"}
                          </p>
                        </div>
                        <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2.5">
                          <p className="text-xs font-semibold text-emerald-500 uppercase tracking-wide mb-0.5">
                            Client A/C Number
                          </p>
                          <p className="text-sm font-bold text-emerald-900 font-mono">
                            {clientAc || "-"}
                          </p>
                        </div>
                        <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
                          <p className="text-xs font-semibold text-amber-500 uppercase tracking-wide mb-0.5">
                            Settlement Date
                          </p>
                          <p className="text-sm font-bold text-amber-900">
                            {settlementDate
                              ? new Date(settlementDate).toLocaleDateString(
                                  "en-GB",
                                  {
                                    day: "2-digit",
                                    month: "short",
                                    year: "numeric",
                                  },
                                )
                              : "-"}
                          </p>
                        </div>
                      </div>
                    );
                  })()}

                  {validationIssues.length > 0 && (
                    <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4">
                      <div className="flex items-start space-x-2">
                        <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                        <div>
                          <h3 className="font-semibold text-red-800 mb-2">
                            Validation Issues
                          </h3>
                          <ul className="list-disc list-inside space-y-1 text-sm text-red-700">
                            {validationIssues.map((issue, idx) => (
                              <li key={idx}>{issue}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* PDF header info */}
                  {(extractedData.broker_name ||
                    extractedData.buyer_name ||
                    extractedData.trade_date) && (
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 grid grid-cols-2 gap-4 text-sm">
                      <div>
                        {extractedData.broker_name && (
                          <p className="font-semibold text-gray-800">
                            {extractedData.broker_name}
                          </p>
                        )}
                        {extractedData.broker_address && (
                          <p className="text-gray-500 text-xs mt-0.5">
                            {extractedData.broker_address}
                          </p>
                        )}
                      </div>
                      <div className="space-y-1 text-xs text-gray-600">
                        {extractedData.buyer_name && (
                          <p>
                            <span className="text-gray-400">
                              {extractedData.note_type === "Sell"
                                ? "Seller"
                                : "Buyer"}
                              :
                            </span>{" "}
                            <span className="font-semibold text-gray-700">
                              {extractedData.buyer_name}
                            </span>
                          </p>
                        )}
                        {extractedData.account_no && (
                          <p>
                            <span className="text-gray-400">Account:</span>{" "}
                            <span className="font-semibold text-gray-700">
                              {extractedData.account_no}
                            </span>
                          </p>
                        )}
                        {extractedData.trade_date && (
                          <p>
                            <span className="text-gray-400">Trade Date:</span>{" "}
                            <span className="font-semibold text-gray-700">
                              {extractedData.trade_date}
                            </span>
                          </p>
                        )}
                        {extractedData.settlement && (
                          <p>
                            <span className="text-gray-400">Settlement:</span>{" "}
                            <span className="font-semibold text-gray-700">
                              {extractedData.settlement}
                            </span>
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Extracted PDF line items — read only */}
                  {extractedRows.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 mb-2">
                        Extracted Line Items from PDF
                      </h3>
                      <div className="border border-gray-200 rounded-lg overflow-hidden">
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead className="bg-gray-100">
                              <tr>
                                <th className="px-3 py-2 text-left font-semibold text-gray-600">
                                  Contract No
                                </th>
                                <th className="px-3 py-2 text-left font-semibold text-gray-600">
                                  Security
                                </th>
                                <th className="px-3 py-2 text-right font-semibold text-gray-600">
                                  Qty
                                </th>
                                <th className="px-3 py-2 text-right font-semibold text-gray-600">
                                  Rate
                                </th>
                                <th className="px-3 py-2 text-right font-semibold text-gray-600">
                                  Gross Value
                                </th>
                                <th className="px-3 py-2 text-right font-semibold text-gray-600">
                                  Brokerage
                                </th>
                                <th className="px-3 py-2 text-right font-semibold text-gray-600">
                                  CDS
                                </th>
                                <th className="px-3 py-2 text-right font-semibold text-gray-600">
                                  CSE
                                </th>
                                <th className="px-3 py-2 text-right font-semibold text-gray-600">
                                  SEC
                                </th>
                                <th className="px-3 py-2 text-right font-semibold text-gray-600">
                                  STL
                                </th>
                                <th className="px-3 py-2 text-right font-semibold text-gray-600">
                                  Clearing
                                </th>
                                {extractedRows.some(
                                  (r) => r.foreign_br > 0,
                                ) && (
                                  <th className="px-3 py-2 text-right font-semibold text-gray-600">
                                    Foreign Br.
                                  </th>
                                )}
                                <th className="px-3 py-2 text-right font-semibold text-gray-600">
                                  Net Amount
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {extractedRows.map((row, idx) => (
                                <tr key={idx} className="hover:bg-gray-50">
                                  <td className="px-3 py-2 text-gray-700 font-mono">
                                    {row.contract_no}
                                  </td>
                                  <td className="px-3 py-2 text-gray-700 font-semibold">
                                    {row.security}
                                  </td>
                                  <td className="px-3 py-2 text-right text-gray-700">
                                    {row.qty.toLocaleString()}
                                  </td>
                                  <td className="px-3 py-2 text-right text-gray-700">
                                    {row.rate.toFixed(2)}
                                  </td>
                                  <td className="px-3 py-2 text-right text-gray-700">
                                    {row.gross_value.toLocaleString(undefined, {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    })}
                                  </td>
                                  <td className="px-3 py-2 text-right text-gray-700">
                                    {row.brokerage.toFixed(2)}
                                  </td>
                                  <td className="px-3 py-2 text-right text-gray-700">
                                    {row.cds_fees.toFixed(2)}
                                  </td>
                                  <td className="px-3 py-2 text-right text-gray-700">
                                    {row.cse_fees.toFixed(2)}
                                  </td>
                                  <td className="px-3 py-2 text-right text-gray-700">
                                    {row.sec.toFixed(2)}
                                  </td>
                                  <td className="px-3 py-2 text-right text-gray-700">
                                    {row.stl.toFixed(2)}
                                  </td>
                                  <td className="px-3 py-2 text-right text-gray-700">
                                    {row.clearing_fee.toFixed(2)}
                                  </td>
                                  {extractedRows.some(
                                    (r) => r.foreign_br > 0,
                                  ) && (
                                    <td className="px-3 py-2 text-right text-gray-700">
                                      {row.foreign_br.toFixed(2)}
                                    </td>
                                  )}
                                  <td className="px-3 py-2 text-right font-semibold text-gray-900">
                                    {row.amount.toLocaleString(undefined, {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    })}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                              <tr className="font-semibold text-gray-800">
                                <td className="px-3 py-2" colSpan={2}>
                                  Totals
                                </td>
                                <td className="px-3 py-2 text-right">
                                  {pdfShares.toLocaleString()}
                                </td>
                                <td className="px-3 py-2 text-right">
                                  {pdfAvgPrice.toFixed(2)}
                                </td>
                                <td className="px-3 py-2 text-right">
                                  {pdfGross.toLocaleString(undefined, {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })}
                                </td>
                                <td className="px-3 py-2 text-right">
                                  {pdfBrokerage.toFixed(2)}
                                </td>
                                <td className="px-3 py-2 text-right">
                                  {pdfCds.toFixed(2)}
                                </td>
                                <td className="px-3 py-2 text-right">
                                  {pdfExchange.toFixed(2)}
                                </td>
                                <td className="px-3 py-2 text-right">
                                  {pdfSec.toFixed(2)}
                                </td>
                                <td className="px-3 py-2 text-right">
                                  {pdfStl.toFixed(2)}
                                </td>
                                <td className="px-3 py-2 text-right">
                                  {pdfClearing.toFixed(2)}
                                </td>
                                {extractedRows.some(
                                  (r) => r.foreign_br > 0,
                                ) && (
                                  <td className="px-3 py-2 text-right">
                                    {pdfForeignBr.toFixed(2)}
                                  </td>
                                )}
                                <td className="px-3 py-2 text-right">
                                  {pdfNet.toLocaleString(undefined, {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })}
                                </td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Comparison table: PDF totals vs transaction */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">
                      PDF Totals vs Transaction
                    </h3>
                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-100">
                          <tr>
                            <th className="px-4 py-2.5 text-left font-semibold text-gray-600">
                              Field
                            </th>
                            <th className="px-4 py-2.5 text-right font-semibold text-gray-600">
                              PDF Total
                            </th>
                            <th className="px-4 py-2.5 text-right font-semibold text-gray-600">
                              Transaction (Expected)
                            </th>
                            <th className="px-4 py-2.5 text-center font-semibold text-gray-600">
                              Status
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {comparedFields.map((field) => {
                            const cmp = fieldCompare[field.key];
                            const matches = cmp?.matches;
                            const expectedText =
                              cmp?.expected != null
                                ? field.key === "no_of_shares"
                                  ? Number(cmp.expected).toLocaleString()
                                  : fmtAmt(Number(cmp.expected))
                                : "-";
                            return (
                              <tr
                                key={field.key}
                                className={
                                  cmp
                                    ? matches
                                      ? "bg-green-50"
                                      : "bg-red-50"
                                    : "bg-white"
                                }
                              >
                                <td className="px-4 py-2.5 font-medium text-gray-800">
                                  {field.label}
                                </td>
                                <td className="px-4 py-2.5 text-right text-gray-700 font-mono">
                                  {field.pdfValue}
                                </td>
                                <td className="px-4 py-2.5 text-right text-gray-700 font-mono">
                                  {expectedText}
                                </td>
                                <td className="px-4 py-2.5 text-center">
                                  {cmp ? (
                                    matches ? (
                                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800">
                                        <CheckCircle className="w-3 h-3 mr-1" />
                                        Match
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800">
                                        <XCircle className="w-3 h-3 mr-1" />
                                        Mismatch
                                      </span>
                                    )
                                  ) : (
                                    <span className="text-xs text-gray-400">
                                      —
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Settlement summary */}
                  <div className="grid grid-cols-3 gap-4">
                    <div
                      className={`rounded-lg p-4 border-2 ${isBuy ? "bg-blue-50 border-blue-200" : "bg-gray-50 border-gray-200"}`}
                    >
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                        Purchase Total
                      </p>
                      <p className="text-xl font-bold text-gray-900">
                        {fmtAmt(isBuy ? pdfNet : 0)}
                      </p>
                    </div>
                    <div
                      className={`rounded-lg p-4 border-2 ${!isBuy ? "bg-blue-50 border-blue-200" : "bg-gray-50 border-gray-200"}`}
                    >
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                        Sales Total
                      </p>
                      <p className="text-xl font-bold text-gray-900">
                        {fmtAmt(!isBuy ? pdfNet : 0)}
                      </p>
                    </div>
                    <div className="rounded-lg p-4 border-2 border-gray-800 bg-gray-900">
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
                        Net Settlement Value
                      </p>
                      <p className="text-xl font-bold text-white">
                        {fmtAmt(isBuy ? -pdfNet : pdfNet)}
                      </p>
                    </div>
                  </div>

                  {(() => {
                    const allMatch =
                      Object.values(fieldCompare).length > 0 &&
                      Object.values(fieldCompare).every((c) => c.matches);
                    const anyMismatch = Object.values(fieldCompare).some(
                      (c) => !c.matches,
                    );
                    return (
                      <div className="pt-4 border-t border-gray-200 space-y-3">
                        {anyMismatch && (
                          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
                            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0 text-amber-600" />
                            <div>
                              <p className="font-semibold">
                                Fields do not match the transaction
                              </p>
                              <p className="mt-0.5">
                                This note must be sent for approval before it
                                can be processed. An approver will review the
                                discrepancies.
                              </p>
                            </div>
                          </div>
                        )}
                        {allMatch && (
                          <div className="flex items-start gap-2 bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-800">
                            <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-green-600" />
                            <div>
                              <p className="font-semibold">
                                All fields match the transaction
                              </p>
                              <p className="mt-0.5">
                                Ready to approve and process. The note will be
                                recorded and the cash balance updated.
                              </p>
                            </div>
                          </div>
                        )}
                        <div className="flex justify-end space-x-3">
                          <button
                            type="button"
                            onClick={handleReject}
                            className="px-5 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors flex items-center space-x-2 text-sm"
                          >
                            <XCircle className="w-4 h-4" />
                            <span>Cancel</span>
                          </button>
                          {anyMismatch ? (
                            <button
                              type="button"
                              onClick={handleSendForApproval}
                              disabled={isProcessing}
                              className="px-5 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors flex items-center space-x-2 text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                              <AlertTriangle className="w-4 h-4" />
                              <span>
                                {isProcessing
                                  ? "Saving..."
                                  : "Send for Approval"}
                              </span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={handleApproval}
                              disabled={isProcessing}
                              className="px-5 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2 text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                              <CheckCircle className="w-4 h-4" />
                              <span>
                                {isProcessing
                                  ? "Processing..."
                                  : "Approve & Process"}
                              </span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
          );
        })()}

      {editNote && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  Edit Buy/Sell Note
                </h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  Contract No: {editNote.contract_no || editNote.note_number}
                </p>
              </div>
              <button
                onClick={() => setEditNote(null)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                    Type
                  </label>
                  <select
                    value={editNote.note_type}
                    onChange={(e) =>
                      setEditNote({
                        ...editNote,
                        note_type: e.target.value as "Buy" | "Sell",
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Buy">Buy</option>
                    <option value="Sell">Sell</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                    Note / Contract No.
                  </label>
                  <input
                    type="text"
                    value={editNote.note_number}
                    onChange={(e) =>
                      setEditNote({ ...editNote, note_number: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                    Broker
                  </label>
                  <input
                    type="text"
                    value={editNote.broker}
                    onChange={(e) =>
                      setEditNote({ ...editNote, broker: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                    Contact Person
                  </label>
                  <input
                    type="text"
                    value={editNote.dealer_name}
                    onChange={(e) =>
                      setEditNote({ ...editNote, dealer_name: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                    Trade Date
                  </label>
                  <input
                    type="date"
                    value={editNote.trade_date}
                    onChange={(e) =>
                      setEditNote({ ...editNote, trade_date: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                    Settlement Date
                  </label>
                  <input
                    type="date"
                    value={editNote.settlement_date}
                    onChange={(e) =>
                      setEditNote({
                        ...editNote,
                        settlement_date: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="border-t border-gray-200 pt-4">
                <p className="text-xs font-semibold text-gray-400 uppercase mb-3">
                  Fee Breakdown
                </p>
                <div className="grid grid-cols-3 gap-3">
                  {(
                    [
                      ["no_of_shares", "No. of Shares"],
                      ["price_avg", "Avg Price"],
                      ["gross_amount", "Gross Amount"],
                      ["brokerage", "Brokerage"],
                      ["sec", "SEC"],
                      ["exchange", "Exchange (CSE)"],
                      ["cds", "CDS"],
                      ["gov_cess", "Gov Cess / STL"],
                      ["clearing_fees", "Clearing Fees"],
                      ["foreign_brokerage", "Foreign Brokerage"],
                      ["net_amount", "Net Amount"],
                    ] as [keyof EditNoteForm, string][]
                  ).map(([field, label]) => (
                    <div key={field}>
                      <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                        {label}
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={editNote[field]}
                        onChange={(e) =>
                          setEditNote({ ...editNote, [field]: e.target.value })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                  Remarks
                </label>
                <textarea
                  rows={2}
                  value={editNote.remarks}
                  onChange={(e) =>
                    setEditNote({ ...editNote, remarks: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-gray-200">
                <button
                  onClick={() => setEditNote(null)}
                  className="px-5 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={isSavingEdit}
                  className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm disabled:opacity-50 flex items-center space-x-2"
                >
                  {isSavingEdit && (
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  )}
                  <span>{isSavingEdit ? "Saving..." : "Save Changes"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showManualModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-7xl my-6">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-xl flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  Manual Entry — Past Transactions
                </h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  Record historical buy/sell transactions. Each row creates a
                  transaction and buy/sell note so portfolio costs are accurate.
                </p>
              </div>
              <button
                onClick={() => {
                  setShowManualModal(false);
                  setManualRows([emptyManualRow()]);
                }}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6">
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-gray-800 text-white">
                      <th className="px-2 py-2.5 text-left font-semibold whitespace-nowrap w-8">
                        #
                      </th>
                      <th className="px-2 py-2.5 text-left font-semibold whitespace-nowrap min-w-[160px]">
                        Entity <span className="text-red-300">*</span>
                      </th>
                      <th className="px-2 py-2.5 text-left font-semibold whitespace-nowrap min-w-[160px]">
                        Share <span className="text-red-300">*</span>
                      </th>
                      <th className="px-2 py-2.5 text-left font-semibold whitespace-nowrap min-w-[80px]">
                        Buy / Sell <span className="text-red-300">*</span>
                      </th>
                      <th className="px-2 py-2.5 text-right font-semibold whitespace-nowrap min-w-[100px]">
                        No. of Shares <span className="text-red-300">*</span>
                      </th>
                      <th className="px-2 py-2.5 text-left font-semibold whitespace-nowrap min-w-[120px]">
                        Settlement Date <span className="text-red-300">*</span>
                      </th>
                      <th className="px-2 py-2.5 text-right font-semibold whitespace-nowrap min-w-[140px]">
                        Total Purchase / Sales Cost{" "}
                        <span className="text-red-300">*</span>
                      </th>
                      <th className="px-2 py-2.5 text-left font-semibold whitespace-nowrap min-w-[140px]">
                        Broker / CDS Account
                      </th>
                      <th className="px-2 py-2.5 w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {manualRows.map((row, idx) => {
                      const rowReady =
                        row.entity_id &&
                        row.share_id &&
                        row.no_of_shares &&
                        row.total_cost &&
                        row.settlement_date;
                      return (
                        <tr
                          key={idx}
                          className={`border-b border-gray-200 ${rowReady ? "bg-white" : "bg-gray-50"}`}
                        >
                          <td className="px-2 py-1.5 text-gray-400 text-center">
                            {idx + 1}
                          </td>

                          {/* Entity */}
                          <td className="px-1 py-1">
                            <select
                              value={row.entity_id}
                              onChange={(e) =>
                                updateManualRow(
                                  idx,
                                  "entity_id",
                                  e.target.value,
                                )
                              }
                              className="w-full px-1.5 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
                            >
                              <option value="">Select entity...</option>
                              {entities.map((e) => (
                                <option key={e.id} value={e.id}>
                                  {e.name}
                                </option>
                              ))}
                            </select>
                          </td>

                          {/* Share */}
                          <td className="px-1 py-1">
                            <select
                              value={row.share_id}
                              onChange={(e) =>
                                updateManualRow(idx, "share_id", e.target.value)
                              }
                              className="w-full px-1.5 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
                            >
                              <option value="">Select share...</option>
                              {shares.map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.ticker} — {s.share_name}
                                </option>
                              ))}
                            </select>
                          </td>

                          {/* Buy / Sell */}
                          <td className="px-1 py-1">
                            <select
                              value={row.note_type}
                              onChange={(e) =>
                                updateManualRow(
                                  idx,
                                  "note_type",
                                  e.target.value,
                                )
                              }
                              className="w-full px-1.5 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
                            >
                              <option value="Buy">Buy</option>
                              <option value="Sell">Sell</option>
                            </select>
                          </td>

                          {/* No. of shares */}
                          <td className="px-1 py-1">
                            <input
                              type="number"
                              step="1"
                              min="0"
                              value={row.no_of_shares}
                              onChange={(e) =>
                                updateManualRow(
                                  idx,
                                  "no_of_shares",
                                  e.target.value,
                                )
                              }
                              placeholder="0"
                              className="w-full px-1.5 py-1 border border-gray-300 rounded text-xs text-right focus:outline-none focus:ring-1 focus:ring-blue-400"
                            />
                          </td>

                          {/* Settlement date */}
                          <td className="px-1 py-1">
                            <input
                              type="date"
                              value={row.settlement_date}
                              onChange={(e) =>
                                updateManualRow(
                                  idx,
                                  "settlement_date",
                                  e.target.value,
                                )
                              }
                              className="w-full px-1.5 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                            />
                          </td>

                          {/* Total cost */}
                          <td className="px-1 py-1">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={row.total_cost}
                              onChange={(e) =>
                                updateManualRow(
                                  idx,
                                  "total_cost",
                                  e.target.value,
                                )
                              }
                              placeholder="0.00"
                              className="w-full px-1.5 py-1 border border-gray-300 rounded text-xs text-right focus:outline-none focus:ring-1 focus:ring-blue-400"
                            />
                          </td>

                          {/* Broker / CDS account */}
                          <td className="px-1 py-1">
                            <input
                              type="text"
                              value={row.broker_cds_account}
                              onChange={(e) =>
                                updateManualRow(
                                  idx,
                                  "broker_cds_account",
                                  e.target.value,
                                )
                              }
                              placeholder="Broker or CDS account no."
                              className="w-full px-1.5 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                            />
                          </td>

                          {/* Delete */}
                          <td className="px-1 py-1 text-center">
                            <button
                              onClick={() => removeManualRow(idx)}
                              className="p-1 text-gray-400 hover:text-red-500 transition-colors rounded"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 flex items-center justify-between">
                <button
                  onClick={addManualRow}
                  className="flex items-center space-x-1.5 px-4 py-2 text-sm text-blue-600 border border-blue-300 rounded-lg hover:bg-blue-50 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Row</span>
                </button>

                <div className="flex items-center space-x-3">
                  <p className="text-xs text-gray-500">
                    {
                      manualRows.filter(
                        (r) =>
                          r.entity_id &&
                          r.share_id &&
                          r.no_of_shares &&
                          r.total_cost &&
                          r.settlement_date,
                      ).length
                    }{" "}
                    of {manualRows.length} rows ready
                  </p>
                  <button
                    onClick={() => {
                      setShowManualModal(false);
                      setManualRows([emptyManualRow()]);
                    }}
                    className="px-5 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveManual}
                    disabled={isSavingManual}
                    className="flex items-center space-x-2 px-6 py-2 text-sm bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSavingManual ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4" />
                        <span>Save All</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-xs text-amber-700">
                  <span className="font-semibold">Note:</span> Fields marked{" "}
                  <span className="text-red-500">*</span> are required. Each
                  saved row creates a transaction and buy/sell note. The total
                  purchase/sales cost is used directly — price per share is
                  calculated automatically. Cash balance is updated immediately
                  upon saving.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
