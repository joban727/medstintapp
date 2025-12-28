-- Fix total_hours column type from text to decimal
ALTER TABLE time_records ALTER COLUMN total_hours TYPE DECIMAL(4,2) USING total_hours::DECIMAL(4,2);