import { useMemo } from 'react';
import { activityRows, windowGroups } from '../services/shareWindow.service';
import type { ComputedRow, ShareGroup } from '../services/shareLedger.service';

export interface ShareWindow {
  /** Holdings listed for the window. */
  groups: ShareGroup[];
  /** A holding's rows inside the window. */
  activityRows: (group: ShareGroup) => ComputedRow[];
}

export function useShareWindow(groups: ShareGroup[], from: string, to: string): ShareWindow {
  return useMemo(() => ({
    groups: windowGroups(groups, { from, to }),
    activityRows: (g: ShareGroup) => activityRows(g, from),
  }), [groups, from, to]);
}
