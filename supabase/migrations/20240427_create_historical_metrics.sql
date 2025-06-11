-- Create historical_metrics table
CREATE TABLE IF NOT EXISTS "historical_metrics" (
    id BIGSERIAL PRIMARY KEY,
    chain TEXT NOT NULL,
    metric_type TEXT NOT NULL,
    value DECIMAL,
    value_usd DECIMAL,
    token_usd DECIMAL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    source TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_historical_metrics_chain ON "historical_metrics" (chain);
CREATE INDEX IF NOT EXISTS idx_historical_metrics_metric_type ON "historical_metrics" (metric_type);
CREATE INDEX IF NOT EXISTS idx_historical_metrics_timestamp ON "historical_metrics" (timestamp DESC);

-- Enable RLS (Row Level Security)
ALTER TABLE "historical_metrics" ENABLE ROW LEVEL SECURITY;

-- Create policy to allow public read access
CREATE POLICY "Allow public read access" ON "historical_metrics"
    FOR SELECT
    TO public
    USING (true); 