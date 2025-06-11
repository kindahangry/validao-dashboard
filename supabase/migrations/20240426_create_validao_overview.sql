-- Create validao-overview table
CREATE TABLE IF NOT EXISTS "validao-overview" (
    id BIGSERIAL PRIMARY KEY,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    total_stake_usd DECIMAL,
    active_chains INTEGER,
    total_chains INTEGER,
    total_delegators INTEGER,
    incentivized_chains INTEGER,
    incentivized_stake DECIMAL,
    source TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on timestamp for faster queries
CREATE INDEX IF NOT EXISTS idx_validao_overview_timestamp ON "validao-overview" (timestamp DESC);

-- Enable RLS (Row Level Security)
ALTER TABLE "validao-overview" ENABLE ROW LEVEL SECURITY;

-- Create policy to allow public read access
CREATE POLICY "Allow public read access" ON "validao-overview"
    FOR SELECT
    TO public
    USING (true); 