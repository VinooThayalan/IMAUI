/*
  # Add anon-role policies to transactions table

  ## Problem
  The app uses the Supabase anon key without an authenticated session, meaning
  auth.uid() is null and all existing 'authenticated'-role policies are skipped.
  This causes SELECT, INSERT, and DELETE to silently fail, making cancel (and
  other operations) appear broken even after the UPDATE policy was opened.

  ## Change
  Add matching anon-role policies for SELECT, INSERT, and DELETE on transactions,
  consistent with the UPDATE anon policy added in the previous migration.
*/

CREATE POLICY "Anon users can read transactions"
  ON transactions FOR SELECT TO anon
  USING (true);

CREATE POLICY "Anon users can insert transactions"
  ON transactions FOR INSERT TO anon
  WITH CHECK (true);

CREATE POLICY "Anon users can delete transactions"
  ON transactions FOR DELETE TO anon
  USING (true);
