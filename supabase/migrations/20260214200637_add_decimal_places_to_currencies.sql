/*
  # Add decimal places support to currencies

  1. Changes
    - Add `decimal_places` column to currencies table (default 2 for most currencies)
    - Update existing currencies to have appropriate decimal places
    
  2. Notes
    - Most currencies use 2 decimal places (USD, EUR, GBP, etc.)
    - Some currencies use 0 decimal places (JPY, KRW, TZS, etc.)
    - This helps prevent floating-point precision issues
    
  3. Security
    - No changes to RLS policies needed
*/

-- Add decimal_places column
ALTER TABLE currencies 
ADD COLUMN IF NOT EXISTS decimal_places INTEGER DEFAULT 2;

-- Update currencies that typically don't use decimal places
UPDATE currencies 
SET decimal_places = 0 
WHERE code IN ('JPY', 'KRW', 'TZS', 'VND', 'CLP', 'ISK', 'UGX', 'RWF', 'KMF', 'BIF', 'XAF', 'XOF', 'GNF', 'PYG', 'MGA', 'VUV');

-- Ensure all other currencies have decimal_places set to 2
UPDATE currencies 
SET decimal_places = 2 
WHERE decimal_places IS NULL OR code NOT IN ('JPY', 'KRW', 'TZS', 'VND', 'CLP', 'ISK', 'UGX', 'RWF', 'KMF', 'BIF', 'XAF', 'XOF', 'GNF', 'PYG', 'MGA', 'VUV');
