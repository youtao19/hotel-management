ALTER TABLE handover_daily_settings
  ADD COLUMN IF NOT EXISTS cash_retained NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (cash_retained >= 0);
