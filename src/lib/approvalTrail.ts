/** A transaction's approval history, from what its row records. */

export type TrailStepKind = 'submitted' | 'approved' | 'rejected' | 'cancelled' | 'awaiting' | 'on_hold' | 'expired';

export interface TrailStep {
  kind: TrailStepKind;
  label: string;
  /** Who did it; null when not recorded. Always null for steps nobody performs. */
  by: string | null;
  at: string | null;
  /** False for steps that have no actor, so none is asked for. */
  hasActor: boolean;
}

export interface ApprovalTrailSource {
  approval_status: string | null;
  submitted_by?: string | null;
  submitted_for_approval_at?: string | null;
  approved_by?: string | null;
  approval_date?: string | null;
  approval_expires_at?: string | null;
}

const step = (kind: TrailStepKind, label: string, by: string | null | undefined, at: string | null | undefined, hasActor = true): TrailStep =>
  ({ kind, label, by: by?.trim() || null, at: at || null, hasActor });

/**
 * Rejection records the rejecter in `approved_by`. Cancelling keeps whatever
 * approval was there and records no canceller, so a cancelled step has no actor.
 */
export function approvalTrail(t: ApprovalTrailSource): TrailStep[] {
  const steps: TrailStep[] = [];
  if (t.submitted_by || t.submitted_for_approval_at) {
    steps.push(step('submitted', 'Submitted for approval', t.submitted_by, t.submitted_for_approval_at));
  }
  switch (t.approval_status) {
    case 'MANUAL_APPROVED':
      steps.push(step('approved', 'Approved', t.approved_by, t.approval_date));
      break;
    case 'REJECTED':
      steps.push(step('rejected', 'Rejected', t.approved_by, t.approval_date));
      break;
    case 'CANCELLED':
      if (t.approved_by || t.approval_date) steps.push(step('approved', 'Approved', t.approved_by, t.approval_date));
      steps.push(step('cancelled', 'Cancelled', null, null, false));
      break;
    case 'PENDING_APPROVAL':
      steps.push(step('awaiting', 'Awaiting approval', null, null, false));
      break;
    case 'ON_HOLD':
      steps.push(step('on_hold', 'On hold', null, null, false));
      break;
    case 'EXPIRED':
      steps.push(step('expired', 'Expired unapproved', null, t.approval_expires_at, false));
      break;
  }
  return steps;
}
