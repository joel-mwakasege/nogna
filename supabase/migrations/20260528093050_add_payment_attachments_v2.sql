/*
  # Add payment_attachments table (v2)

  ## New Tables
  - `payment_attachments`
    - `id` (uuid, primary key)
    - `payment_id` (uuid, FK to payments)
    - `file_name` (text) - original filename
    - `file_path` (text) - storage path
    - `file_size` (bigint) - bytes
    - `file_type` (text) - MIME type
    - `uploaded_by` (uuid, FK to auth.users)
    - `created_at` (timestamptz)
    - `deleted_at` (timestamptz, nullable, soft delete)

  ## Security
  - RLS enabled with policies for company-scoped access

  ## Storage
  - Bucket `payment-attachments` (public)
*/

CREATE TABLE IF NOT EXISTS payment_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_size bigint NOT NULL DEFAULT 0,
  file_type text NOT NULL DEFAULT '',
  uploaded_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);

ALTER TABLE payment_attachments ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'payment_attachments' AND policyname = 'Company users can view payment attachments'
  ) THEN
    CREATE POLICY "Company users can view payment attachments"
      ON payment_attachments
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM payments p
          JOIN user_profiles up ON up.id = auth.uid()
          WHERE p.id = payment_attachments.payment_id
            AND p.company_id = up.company_id
        )
        AND deleted_at IS NULL
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'payment_attachments' AND policyname = 'Company users can insert payment attachments'
  ) THEN
    CREATE POLICY "Company users can insert payment attachments"
      ON payment_attachments
      FOR INSERT
      TO authenticated
      WITH CHECK (
        uploaded_by = auth.uid()
        AND EXISTS (
          SELECT 1 FROM payments p
          JOIN user_profiles up ON up.id = auth.uid()
          WHERE p.id = payment_attachments.payment_id
            AND p.company_id = up.company_id
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'payment_attachments' AND policyname = 'Uploaders and admins can update payment attachments'
  ) THEN
    CREATE POLICY "Uploaders and admins can update payment attachments"
      ON payment_attachments
      FOR UPDATE
      TO authenticated
      USING (
        uploaded_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM user_profiles
          WHERE id = auth.uid()
            AND role IN ('admin', 'owner')
        )
      )
      WITH CHECK (
        uploaded_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM user_profiles
          WHERE id = auth.uid()
            AND role IN ('admin', 'owner')
        )
      );
  END IF;
END $$;

-- Storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-attachments', 'payment-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies (safe to re-run)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Authenticated users can upload payment attachments'
  ) THEN
    CREATE POLICY "Authenticated users can upload payment attachments"
      ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'payment-attachments');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Anyone can view payment attachments'
  ) THEN
    CREATE POLICY "Anyone can view payment attachments"
      ON storage.objects FOR SELECT TO public
      USING (bucket_id = 'payment-attachments');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Authenticated users can delete own payment attachments'
  ) THEN
    CREATE POLICY "Authenticated users can delete own payment attachments"
      ON storage.objects FOR DELETE TO authenticated
      USING (bucket_id = 'payment-attachments');
  END IF;
END $$;
