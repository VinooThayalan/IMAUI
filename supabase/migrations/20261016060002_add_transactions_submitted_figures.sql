-- The figures a transaction was submitted with, saved by the approval itself, so
-- an approver's edits are on the row and cannot be lost. See bug-54.

ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS submitted_figures jsonb;

COMMENT ON COLUMN public.transactions.submitted_figures IS
  'Figures as submitted for approval, saved when approved. Null: not approved yet, or approved before this column existed.';
