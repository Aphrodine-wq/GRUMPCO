-- Add estimated cost (USD) per usage record for cost-based billing
ALTER TABLE usage_records
ADD COLUMN estimated_cost_usd REAL DEFAULT 0;
