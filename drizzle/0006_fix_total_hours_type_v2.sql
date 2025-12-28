-- Fix total_hours column type from text to decimal using a safer approach
-- Step 1: Add a new temporary column with the correct type
ALTER TABLE time_records ADD COLUMN total_hours_new DECIMAL(4,2);

-- Step 2: Copy data from the old column to the new one, handling conversion
UPDATE time_records SET total_hours_new = CAST(total_hours AS DECIMAL(4,2)) WHERE total_hours IS NOT NULL AND total_hours <> '';

-- Step 3: Drop the old column
ALTER TABLE time_records DROP COLUMN total_hours;

-- Step 4: Rename the new column to the original name
ALTER TABLE time_records RENAME COLUMN total_hours_new TO total_hours;