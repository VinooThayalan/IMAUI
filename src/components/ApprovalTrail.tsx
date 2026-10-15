import { Ban, CheckCircle2, Clock, Pause, Send, TimerOff, XCircle } from 'lucide-react';
import { approvalTrail, type ApprovalTrailSource, type TrailStepKind } from '../lib/approvalTrail';
import { formatDisplayDateTime } from '../lib/dateInput';

interface ApprovalTrailProps {
  transaction: ApprovalTrailSource;
  /** Marks the approval as having changed the submitted figures. */
  amended?: boolean;
  className?: string;
}

const TONE: Record<TrailStepKind, { icon: typeof Send; dot: string }> = {
  submitted: { icon: Send, dot: 'bg-blue-100 text-blue-700' },
  approved: { icon: CheckCircle2, dot: 'bg-green-100 text-green-700' },
  rejected: { icon: XCircle, dot: 'bg-red-100 text-red-700' },
  cancelled: { icon: Ban, dot: 'bg-rose-100 text-rose-700' },
  awaiting: { icon: Clock, dot: 'bg-yellow-100 text-yellow-700' },
  on_hold: { icon: Pause, dot: 'bg-orange-100 text-orange-700' },
  expired: { icon: TimerOff, dot: 'bg-gray-100 text-gray-600' },
};

/** Who submitted and who decided, and when, as a short timeline. */
export function ApprovalTrail({ transaction, amended = false, className = '' }: ApprovalTrailProps) {
  const steps = approvalTrail(transaction);
  if (steps.length === 0) return null;

  return (
    <ol className={className}>
      {steps.map((s, i) => {
        const { icon: Icon, dot } = TONE[s.kind];
        const last = i === steps.length - 1;
        return (
          <li key={s.kind} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${dot}`}>
                <Icon className="h-4 w-4" />
              </span>
              {!last && <span className="my-1 w-px flex-1 bg-gray-200" />}
            </div>
            <div className={`min-w-0 ${last ? '' : 'pb-3'}`}>
              <p className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                {s.label}
                {amended && s.kind === 'approved' && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold normal-case tracking-normal text-amber-800">
                    Figures amended
                  </span>
                )}
              </p>
              {s.hasActor && (
                <p className="break-all text-sm font-semibold text-gray-900">
                  {s.by ?? <span className="font-normal italic text-gray-400">Name not recorded</span>}
                </p>
              )}
              {s.at && <p className="text-xs text-gray-500">{formatDisplayDateTime(s.at)}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
