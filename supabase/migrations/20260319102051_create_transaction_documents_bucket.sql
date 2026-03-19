/*
  # Create transaction-documents storage bucket

  1. New Storage Bucket
    - `transaction-documents`: stores approval documents for transactions
  2. Storage Policies
    - Authenticated users can upload documents
    - Authenticated users can read documents
    - Authenticated users can delete their own documents
*/

INSERT INTO storage.buckets (id, name, public)
VALUES ('transaction-documents', 'transaction-documents', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated users can upload transaction documents"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'transaction-documents');

CREATE POLICY "Authenticated users can read transaction documents"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'transaction-documents');

CREATE POLICY "Authenticated users can delete transaction documents"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'transaction-documents');
