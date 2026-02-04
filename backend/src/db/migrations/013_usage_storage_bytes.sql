-- Add storage bytes to usage records for storage metering
ALTER TABLE usage_records
ADD COLUMN storage_bytes INTEGER;
