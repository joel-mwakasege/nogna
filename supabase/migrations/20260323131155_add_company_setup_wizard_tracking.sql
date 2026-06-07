/*
  # Company Setup Wizard Tracking

  1. Changes
    - Add `setup_completed` boolean to companies table
    - Add `setup_step_completed` jsonb to track which steps are done
    - Add `profile_completion_percentage` integer to companies table

  2. Purpose
    - Track if company owner has completed the setup wizard
    - Store which steps have been completed for resuming wizard
    - Display completion percentage in UI

  3. Setup Steps Tracked
    - company_info: Basic company information (name, address)
    - banking: Bank account details
    - currencies: Active currencies setup
    - defaults: Default client fields
*/

-- Add setup wizard tracking columns to companies table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companies' AND column_name = 'setup_completed'
  ) THEN
    ALTER TABLE companies ADD COLUMN setup_completed boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companies' AND column_name = 'setup_step_completed'
  ) THEN
    ALTER TABLE companies ADD COLUMN setup_step_completed jsonb DEFAULT '{
      "company_info": false,
      "banking": false,
      "currencies": false,
      "defaults": false
    }'::jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companies' AND column_name = 'profile_completion_percentage'
  ) THEN
    ALTER TABLE companies ADD COLUMN profile_completion_percentage integer DEFAULT 0;
  END IF;
END $$;

-- Create function to calculate completion percentage
CREATE OR REPLACE FUNCTION calculate_company_completion_percentage(company_uuid uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  completion_pct integer := 0;
  step_count integer := 0;
  total_steps integer := 4;
  settings_data record;
BEGIN
  -- Get company setup steps
  SELECT 
    setup_step_completed
  INTO settings_data
  FROM companies
  WHERE id = company_uuid;

  IF settings_data IS NULL THEN
    RETURN 0;
  END IF;

  -- Count completed steps
  IF (settings_data.setup_step_completed->>'company_info')::boolean THEN
    step_count := step_count + 1;
  END IF;

  IF (settings_data.setup_step_completed->>'banking')::boolean THEN
    step_count := step_count + 1;
  END IF;

  IF (settings_data.setup_step_completed->>'currencies')::boolean THEN
    step_count := step_count + 1;
  END IF;

  IF (settings_data.setup_step_completed->>'defaults')::boolean THEN
    step_count := step_count + 1;
  END IF;

  -- Calculate percentage
  completion_pct := (step_count * 100) / total_steps;

  RETURN completion_pct;
END;
$$;

-- Create trigger to update completion percentage automatically
CREATE OR REPLACE FUNCTION update_company_completion_percentage()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  NEW.profile_completion_percentage := calculate_company_completion_percentage(NEW.id);
  
  -- Mark setup as completed if all steps are done
  IF NEW.profile_completion_percentage >= 100 THEN
    NEW.setup_completed := true;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_company_completion ON companies;
CREATE TRIGGER trigger_update_company_completion
  BEFORE UPDATE OF setup_step_completed ON companies
  FOR EACH ROW
  EXECUTE FUNCTION update_company_completion_percentage();

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_companies_setup_completed ON companies(setup_completed);
CREATE INDEX IF NOT EXISTS idx_companies_profile_completion ON companies(profile_completion_percentage);