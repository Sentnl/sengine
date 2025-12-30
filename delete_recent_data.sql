-- Delete data created in the last 2-4 hours
-- Run this script carefully as it will permanently delete data
-- IMPORTANT: Must delete from validate_services FIRST (child table) before validate_results (parent table)

BEGIN;

-- First, check what will be deleted (dry run)
SELECT 
  'validate_services' as table_name,
  COUNT(*) as records_to_delete
FROM validate_services
WHERE timestamp >= NOW() - INTERVAL '4 hours';

SELECT 
  'validate_results' as table_name,
  COUNT(*) as records_to_delete
FROM validate_results
WHERE timestamp >= NOW() - INTERVAL '4 hours';

-- STEP 1: Delete from validate_services FIRST (child table with foreign key)
-- This MUST be done before deleting from validate_results
DELETE FROM validate_services
WHERE timestamp >= NOW() - INTERVAL '4 hours';

-- STEP 2: Now delete from validate_results (parent table)
-- This can only be done after validate_services records are deleted
DELETE FROM validate_results
WHERE timestamp >= NOW() - INTERVAL '4 hours';

-- Commit the transaction
COMMIT;

-- To rollback if something goes wrong, use: ROLLBACK;

