/*
  # Create Default Client Custom Fields Table
  
  1. New Tables
    - `default_client_fields`
      - `id` (uuid, primary key) - Unique identifier for the field
      - `field_label` (text, required) - Label for the custom field
      - `field_value` (text, default '') - Default value for the field
      - `display_order` (integer, default 0) - Order to display fields
      - `user_id` (uuid, required) - Foreign key to auth.users
      - `created_at` (timestamptz) - Creation timestamp
      - `updated_at` (timestamptz) - Last update timestamp
      
  2. Security
    - Enable RLS on `default_client_fields` table
    - Add policy for authenticated users to read their own default fields
    - Add policy for authenticated users to insert their own default fields
    - Add policy for authenticated users to update their own default fields
    - Add policy for authenticated users to delete their own default fields
    
  3. Notes
    - These fields are templates that will be used when creating new documents
    - Users can customize which fields appear by default in the client details section
    - Each user has their own set of default fields
*/

-- Create default_client_fields table
CREATE TABLE IF NOT EXISTS default_client_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  field_label text NOT NULL,
  field_value text DEFAULT '',
  display_order integer DEFAULT 0,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE default_client_fields ENABLE ROW LEVEL SECURITY;

-- Policy for users to read their own default fields
CREATE POLICY "Users can read own default client fields"
  ON default_client_fields
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy for users to insert their own default fields
CREATE POLICY "Users can insert own default client fields"
  ON default_client_fields
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Policy for users to update their own default fields
CREATE POLICY "Users can update own default client fields"
  ON default_client_fields
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy for users to delete their own default fields
CREATE POLICY "Users can delete own default client fields"
  ON default_client_fields
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_default_client_fields_user_id ON default_client_fields(user_id);
CREATE INDEX IF NOT EXISTS idx_default_client_fields_display_order ON default_client_fields(user_id, display_order);

-- Insert some common default fields for demonstration (these will be added by users themselves)
-- No default data inserted as users should manage their own fields