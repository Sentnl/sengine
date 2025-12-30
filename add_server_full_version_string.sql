-- Migration script to add server_full_version_string column to validate_results table
-- and set default value for existing rows

BEGIN;

-- Add the column if it doesn't exist
ALTER TABLE validate_results 
ADD COLUMN IF NOT EXISTS server_full_version_string TEXT;

-- Update existing rows that have NULL to "unknown"
UPDATE validate_results
SET server_full_version_string = 'unknown'
WHERE server_full_version_string IS NULL;

-- Optional: Set a default value for future inserts (though we handle this in code)
-- ALTER TABLE validate_results 
-- ALTER COLUMN server_full_version_string SET DEFAULT 'unknown';

COMMIT;

-- Verify the changes
SELECT 
  COUNT(*) as total_rows,
  COUNT(server_full_version_string) as rows_with_value,
  COUNT(CASE WHEN server_full_version_string = 'unknown' THEN 1 END) as rows_with_unknown
FROM validate_results;

