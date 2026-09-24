/**
 * Loading holdings' ledgers, for screens that load on demand.
 *
 * Reports builds a report when a button is pressed rather than on mount, and
 * owns its own loading flag for all nine of its reports, so this hands back
 * stable loaders rather than state. What a holding is, and every figure in it,
 * lives in `shareGroups.service` and `shareReports.service`.
 */

import { useCallback } from 'react';
import { loadShareGroups } from '../services/shareGroups.service';
import {
  analyticsReport,
  detailedReport,
  type AnalyticsReportRow,
  type DetailedReport,
} from '../services/shareReports.service';
import type { ShareGroup } from '../services/shareLedger.service';

export interface UseShareLedger {
  /** Every holding in scope, rebuilt from the source tables. */
  loadGroups: (entityId?: string) => Promise<ShareGroup[]>;
  loadAnalyticsReport: (entityId?: string) => Promise<AnalyticsReportRow[]>;
  loadDetailedReport: (window: { from: string; to: string }, entityId?: string) => Promise<DetailedReport>;
}

export function useShareLedger(): UseShareLedger {
  const loadGroups = useCallback((entityId?: string) => loadShareGroups(entityId), []);
  const loadAnalyticsReport = useCallback(
    async (entityId?: string) => analyticsReport(await loadShareGroups(entityId)),
    [],
  );
  const loadDetailedReport = useCallback(
    async (window: { from: string; to: string }, entityId?: string) =>
      detailedReport(await loadShareGroups(entityId), window, new Date()),
    [],
  );
  return { loadGroups, loadAnalyticsReport, loadDetailedReport };
}

export type { AnalyticsReportRow, DetailedReport, DetailedReportRow } from '../services/shareReports.service';
