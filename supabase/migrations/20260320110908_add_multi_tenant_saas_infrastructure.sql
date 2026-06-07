/*
  # Multi-Tenant SaaS Infrastructure

  1. New Tables
    - `companies`
      - `id` (uuid, primary key)
      - `name` (text) - Company name
      - `slug` (text, unique) - URL-friendly identifier
      - `status` (text) - active, suspended, trial, cancelled
      - `subscription_tier` (text) - free, basic, professional, enterprise
      - `subscription_expires_at` (timestamptz) - Subscription expiration
      - `max_users` (integer) - Maximum allowed users
      - `settings` (jsonb) - Company-specific settings
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
      - `created_by` (uuid) - References auth.users
    
    - `company_invitations`
      - `id` (uuid, primary key)
      - `company_id` (uuid) - References companies
      - `email` (text) - Invited user email
      - `role` (text) - Role for invited user
      - `token` (text, unique) - Invitation token
      - `expires_at` (timestamptz)
      - `accepted_at` (timestamptz)
      - `invited_by` (uuid) - References auth.users
      - `created_at` (timestamptz)
    
    - `saas_admins`
      - `id` (uuid, primary key)
      - `user_id` (uuid, unique) - References auth.users
      - `created_at` (timestamptz)

  2. Changes to Existing Tables
    - Add `company_id` to all existing tables for tenant isolation
    - Update RLS policies to enforce tenant isolation
    
  3. Security
    - Enable RLS on all new tables
    - Add policies for company owners and admins
    - Add policies for SaaS administrators
    - Ensure strict tenant isolation

  4. Important Notes
    - Companies are completely isolated from each other
    - SaaS admins can view and manage all companies
    - Company owners can manage their company and users
    - All data is scoped to company_id
*/

-- Create companies table
CREATE TABLE IF NOT EXISTS companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  status text NOT NULL DEFAULT 'trial' CHECK (status IN ('active', 'suspended', 'trial', 'cancelled')),
  subscription_tier text NOT NULL DEFAULT 'free' CHECK (subscription_tier IN ('free', 'basic', 'professional', 'enterprise')),
  subscription_expires_at timestamptz,
  max_users integer NOT NULL DEFAULT 5,
  settings jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

-- Create company invitations table
CREATE TABLE IF NOT EXISTS company_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('owner', 'admin', 'user')),
  token text UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at timestamptz,
  invited_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

-- Create SaaS admins table
CREATE TABLE IF NOT EXISTS saas_admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

-- Add company_id to user_profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN company_id uuid REFERENCES companies(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Update user_profiles role to include owner
ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS user_profiles_role_check;
ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_role_check 
  CHECK (role IN ('owner', 'admin', 'user'));

-- Enable RLS
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE saas_admins ENABLE ROW LEVEL SECURITY;

-- Helper function to check if user is a SaaS admin
CREATE OR REPLACE FUNCTION is_saas_admin(user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM saas_admins WHERE saas_admins.user_id = $1
  );
$$;

-- Helper function to get user's company_id
CREATE OR REPLACE FUNCTION get_user_company_id(user_id uuid)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT company_id FROM user_profiles WHERE user_profiles.id = $1;
$$;

-- Helper function to check if user is company owner
CREATE OR REPLACE FUNCTION is_company_owner(user_id uuid, comp_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_profiles 
    WHERE user_profiles.id = $1 
    AND user_profiles.company_id = $2 
    AND user_profiles.role = 'owner'
  );
$$;

-- RLS Policies for companies table
CREATE POLICY "SaaS admins can view all companies"
  ON companies FOR SELECT
  TO authenticated
  USING (is_saas_admin(auth.uid()));

CREATE POLICY "SaaS admins can insert companies"
  ON companies FOR INSERT
  TO authenticated
  WITH CHECK (is_saas_admin(auth.uid()));

CREATE POLICY "SaaS admins can update all companies"
  ON companies FOR UPDATE
  TO authenticated
  USING (is_saas_admin(auth.uid()))
  WITH CHECK (is_saas_admin(auth.uid()));

CREATE POLICY "Company owners can view their company"
  ON companies FOR SELECT
  TO authenticated
  USING (
    id = get_user_company_id(auth.uid())
  );

CREATE POLICY "Company owners can update their company"
  ON companies FOR UPDATE
  TO authenticated
  USING (is_company_owner(auth.uid(), id))
  WITH CHECK (is_company_owner(auth.uid(), id));

-- RLS Policies for company_invitations
CREATE POLICY "SaaS admins can view all invitations"
  ON company_invitations FOR SELECT
  TO authenticated
  USING (is_saas_admin(auth.uid()));

CREATE POLICY "Company admins can view their company invitations"
  ON company_invitations FOR SELECT
  TO authenticated
  USING (
    company_id = get_user_company_id(auth.uid())
    AND EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Company admins can create invitations"
  ON company_invitations FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id = get_user_company_id(auth.uid())
    AND EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Company admins can delete invitations"
  ON company_invitations FOR DELETE
  TO authenticated
  USING (
    company_id = get_user_company_id(auth.uid())
    AND EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Users can view invitations sent to them"
  ON company_invitations FOR SELECT
  TO authenticated
  USING (
    email = (SELECT email FROM auth.users WHERE id = auth.uid())
    AND accepted_at IS NULL
    AND expires_at > now()
  );

-- RLS Policies for saas_admins
CREATE POLICY "SaaS admins can view all SaaS admins"
  ON saas_admins FOR SELECT
  TO authenticated
  USING (is_saas_admin(auth.uid()));

CREATE POLICY "SaaS admins can add other SaaS admins"
  ON saas_admins FOR INSERT
  TO authenticated
  WITH CHECK (is_saas_admin(auth.uid()));

CREATE POLICY "SaaS admins can remove SaaS admins"
  ON saas_admins FOR DELETE
  TO authenticated
  USING (is_saas_admin(auth.uid()));

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_companies_slug ON companies(slug);
CREATE INDEX IF NOT EXISTS idx_companies_status ON companies(status);
CREATE INDEX IF NOT EXISTS idx_companies_created_by ON companies(created_by);
CREATE INDEX IF NOT EXISTS idx_company_invitations_company_id ON company_invitations(company_id);
CREATE INDEX IF NOT EXISTS idx_company_invitations_email ON company_invitations(email);
CREATE INDEX IF NOT EXISTS idx_company_invitations_token ON company_invitations(token);
CREATE INDEX IF NOT EXISTS idx_saas_admins_user_id ON saas_admins(user_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_company_id ON user_profiles(company_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for companies updated_at
DROP TRIGGER IF EXISTS update_companies_updated_at ON companies;
CREATE TRIGGER update_companies_updated_at
  BEFORE UPDATE ON companies
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();