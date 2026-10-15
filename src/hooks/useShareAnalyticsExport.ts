/** Share Analytics downloads: the holding list and a holding's breakdown, as XLSX or CSV. */

import { useCallback } from 'react';
import { downloadExport, type ExportFormat } from '../lib/exportTable';
import {
  detailExport,
  detailFilename,
  summaryExport,
  summaryFilename,
} from '../services/shareAnalyticsExport.service';
import type { ComputedRow, ShareGroup } from '../services/shareLedger.service';

export interface ShareAnalyticsExport {
  exportSummary: (
    groups: ShareGroup[],
    activityRows: (group: ShareGroup) => ComputedRow[],
    /** Entity name, or `all`, for the file name. */
    label: string,
    format: ExportFormat,
  ) => void;
  /** Event rows on or after `from`. */
  exportDetail: (group: ShareGroup, format: ExportFormat, from?: string) => void;
}

export function useShareAnalyticsExport(): ShareAnalyticsExport {
  const exportSummary = useCallback<ShareAnalyticsExport['exportSummary']>((groups, activityRows, label, format) => {
    const asOf = new Date();
    downloadExport(summaryExport(groups, activityRows, asOf), summaryFilename(label, asOf), format, 'Share Analytics');
  }, []);

  const exportDetail = useCallback<ShareAnalyticsExport['exportDetail']>((group, format, from) => {
    const asOf = new Date();
    downloadExport(detailExport(group, asOf, from), detailFilename(group, asOf), format, group.share_ticker);
  }, []);

  return { exportSummary, exportDetail };
}
