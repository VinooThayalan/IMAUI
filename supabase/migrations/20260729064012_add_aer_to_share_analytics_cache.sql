/* Add aer column to share_analytics_cache to store computed XIRR per group */
ALTER TABLE share_analytics_cache
  ADD COLUMN IF NOT EXISTS aer numeric(10, 4);