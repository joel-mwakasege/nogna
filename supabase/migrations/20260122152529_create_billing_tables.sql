/*
  # Create Billing System Tables

  1. New Tables
    - `customers`
      - `id` (uuid, primary key)
      - `name` (text, customer/company name)
      - `email` (text, email address)
      - `created_at` (timestamptz, creation timestamp)
    
    - `documents`
      - `id` (uuid, primary key)
      - `document_number` (text, manual document identifier)
      - `document_type` (text, 'invoice' or 'quote')
      - `customer_id` (uuid, foreign key to customers)
      - `currency` (text, USD/GBP/EUR)
      - `issue_date` (date, document issue date)
      - `status` (text, draft/pending/paid/overdue)
      - `discount_percent` (numeric, discount percentage)
      - `tax_percent` (numeric, tax percentage)
      - `created_at` (timestamptz, creation timestamp)
      - `updated_at` (timestamptz, last update timestamp)
    
    - `document_sections`
      - `id` (uuid, primary key)
      - `document_id` (uuid, foreign key to documents)
      - `name` (text, section name like "Design & Strategy")
      - `sort_order` (integer, for ordering sections)
      - `created_at` (timestamptz, creation timestamp)
    
    - `document_line_items`
      - `id` (uuid, primary key)
      - `section_id` (uuid, foreign key to document_sections)
      - `description` (text, line item description)
      - `units` (numeric, number of units)
      - `days` (numeric, number of days)
      - `unit_cost` (numeric, cost per unit)
      - `sort_order` (integer, for ordering line items)
      - `created_at` (timestamptz, creation timestamp)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated admin access (treating all as admin for this internal tool)
*/

-- Create customers table
CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create documents table
CREATE TABLE IF NOT EXISTS documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_number text NOT NULL,
  document_type text NOT NULL CHECK (document_type IN ('invoice', 'quote')),
  customer_id uuid REFERENCES customers(id) ON DELETE CASCADE,
  currency text NOT NULL DEFAULT 'USD' CHECK (currency IN ('USD', 'GBP', 'EUR')),
  issue_date date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'paid', 'overdue')),
  discount_percent numeric(5,2) DEFAULT 0,
  tax_percent numeric(5,2) DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create document_sections table
CREATE TABLE IF NOT EXISTS document_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Create document_line_items table
CREATE TABLE IF NOT EXISTS document_line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id uuid NOT NULL REFERENCES document_sections(id) ON DELETE CASCADE,
  description text NOT NULL,
  units numeric(10,2) NOT NULL DEFAULT 1,
  days numeric(10,2) NOT NULL DEFAULT 1,
  unit_cost numeric(12,2) NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_line_items ENABLE ROW LEVEL SECURITY;

-- Create policies for customers table (allow all operations for now as this is an internal admin tool)
CREATE POLICY "Allow all operations on customers"
  ON customers
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create policies for documents table
CREATE POLICY "Allow all operations on documents"
  ON documents
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create policies for document_sections table
CREATE POLICY "Allow all operations on document_sections"
  ON document_sections
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create policies for document_line_items table
CREATE POLICY "Allow all operations on document_line_items"
  ON document_line_items
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_documents_customer_id ON documents(customer_id);
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
CREATE INDEX IF NOT EXISTS idx_documents_issue_date ON documents(issue_date);
CREATE INDEX IF NOT EXISTS idx_document_sections_document_id ON document_sections(document_id);
CREATE INDEX IF NOT EXISTS idx_document_line_items_section_id ON document_line_items(section_id);