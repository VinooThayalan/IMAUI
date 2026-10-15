import { useCallback } from 'react';
import { transactionPrintHtml } from '../lib/transactionPrint';
import {
  loadTransactionVersions,
  transactionPrintData,
  type TransactionPrintHeader,
  type VersionedTransaction,
} from '../services/transactionVersions.service';

/** Opens the "Transaction Approval Details" print: drafted, approved and broker-confirmed figures. */
export function useTransactionPrint(): (txn: VersionedTransaction, header: TransactionPrintHeader) => Promise<void> {
  return useCallback(async (txn, header) => {
    // Opened before the data loads, while the click still counts as user action.
    const win = window.open('', '_blank');
    if (!win) {
      alert('Please allow pop-ups to print the document');
      return;
    }
    win.document.write('<p style="font-family: Arial, sans-serif; padding: 40px;">Preparing document…</p>');
    try {
      const versions = await loadTransactionVersions(txn);
      win.document.open();
      win.document.write(transactionPrintHtml(transactionPrintData(txn, header, versions)));
      win.document.close();
    } catch (err) {
      console.error('Print transaction failed:', err);
      win.document.body.textContent = `Could not prepare the document: ${err instanceof Error ? err.message : String(err)}`;
    }
  }, []);
}
