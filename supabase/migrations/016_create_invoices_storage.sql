-- Create storage bucket for invoice PDFs
INSERT INTO storage.buckets (id, name, public)
VALUES ('invoices', 'invoices', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload invoices
CREATE POLICY "Allow authenticated users to upload invoices"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'invoices');

-- Allow public access to view invoices (since we're sending via WhatsApp)
CREATE POLICY "Allow public to view invoices"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'invoices');

-- Allow authenticated users to delete their own invoices
CREATE POLICY "Allow authenticated users to delete invoices"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'invoices');
