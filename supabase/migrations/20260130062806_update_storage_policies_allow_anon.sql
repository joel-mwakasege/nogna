/*
  # Update Storage Policies to Allow Anonymous Access
  
  1. Changes
    - Drop existing authenticated-only policies
    - Add policies that allow both authenticated and anon users
    - This allows the application to work without user authentication
  
  2. Security
    - Both authenticated and anon users can manage logos
    - Public users can view logos
*/

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Authenticated users can upload logos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update logos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete logos" ON storage.objects;

-- Allow authenticated and anon users to upload logos
CREATE POLICY "Users can upload logos"
ON storage.objects
FOR INSERT
TO authenticated, anon
WITH CHECK (bucket_id = 'company-logos');

-- Allow authenticated and anon users to update logos
CREATE POLICY "Users can update logos"
ON storage.objects
FOR UPDATE
TO authenticated, anon
USING (bucket_id = 'company-logos')
WITH CHECK (bucket_id = 'company-logos');

-- Allow authenticated and anon users to delete logos
CREATE POLICY "Users can delete logos"
ON storage.objects
FOR DELETE
TO authenticated, anon
USING (bucket_id = 'company-logos');
