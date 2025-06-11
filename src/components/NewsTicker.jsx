import React, { useEffect, useState } from 'react';
import { supabase } from '../supabase';
import './NewsTicker.css';

const NewsTicker = () => {
  const [metrics, setMetrics] = useState({
    prices: {},
    stakes: {},
    totalStake: 0,
    totalRevenue: 0
  });

  const chainConfig = {
    Hyperliquid: { commission: 0.04, apr: 2.4 },
    Celestia: { commission: 0.09, apr: 11.60 },
    Initia: { 
      commission: 0.05,
      nativeVpWeight: 1.0,
      lpVpWeight: 0.8
    },
    Dymension: { commission: 0.05, apr: 4.12 }
  };

  useEffect(() => {
    async function fetchMetrics() {
      const chains = ['Hyperliquid', 'Celestia', 'Dymension', 'Initia'];
      const prices = {};
      const stakes = {};

      // Fetch total stake from overview
      const { data: overviewData, error: overviewError } = await supabase
        .from('validao-overview')
        .select('total_stake_usd')
        .order('timestamp', { ascending: false })
        .limit(1);

      // Fetch individual chain data
      for (const chain of chains) {
        const { data, error } = await supabase
          .from('historical_metrics')
          .select('token_usd, value_usd, apr')
          .eq('chain', chain)
          .eq('metric_type', 'total_stake')
          .order('timestamp', { ascending: false })
          .limit(1);

        if (!error && data.length > 0) {
          prices[chain] = data[0].token_usd;
          stakes[chain] = data[0].value_usd;
        }
      }

      // Calculate total revenue using the same logic as Revenue component
      let totalRevenue = 0;
      for (const [chain, stake] of Object.entries(stakes)) {
        const config = chainConfig[chain];
        if (!config) continue;
        
        if (chain === 'Initia') {
          // For Initia, we need to fetch both native and LP stakes
          const { data: initiaData } = await supabase
            .from('historical_metrics')
            .select('value_usd, apr')
            .eq('chain', 'Initia')
            .in('metric_type', ['total_stake_init', 'total_stake_lp'])
            .order('timestamp', { ascending: false })
            .limit(2);

          if (initiaData && initiaData.length === 2) {
            const [nativeStake, lpStake] = initiaData;
            const nativeRevenue = nativeStake.value_usd * (nativeStake.apr / 100) * config.commission;
            const lpRevenue = lpStake.value_usd * (lpStake.apr / 100) * config.commission;
            totalRevenue += nativeRevenue + lpRevenue;
          }
        } else {
          // Standard calculation for other chains
          const chainRevenue = stake * (config.apr / 100) * config.commission;
          totalRevenue += chainRevenue;
        }
      }

      setMetrics({
        prices,
        stakes,
        totalStake: overviewData?.[0]?.total_stake_usd || 0,
        totalRevenue
      });
    }

    fetchMetrics();
    // Update metrics every minute
    const interval = setInterval(fetchMetrics, 60000);
    return () => clearInterval(interval);
  }, []);

  const formatUsd = (value) => {
    if (!value) return '$0.00';
    return `$${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatStake = (value) => {
    if (!value) return '$0';
    return `$${Math.ceil(Number(value)).toLocaleString()}`;
  };

  // Create ordered array of items
  const tickerItems = [
    { label: 'Total Stake', value: formatStake(metrics.totalStake) },
    { label: 'Annual Revenue', value: formatUsd(metrics.totalRevenue) },
    { label: 'Hyperliquid Price', value: formatUsd(metrics.prices.Hyperliquid) },
    { label: 'Hyperliquid Stake', value: formatStake(metrics.stakes.Hyperliquid) },
    { label: 'Celestia Price', value: formatUsd(metrics.prices.Celestia) },
    { label: 'Celestia Stake', value: formatStake(metrics.stakes.Celestia) },
    { label: 'Dymension Price', value: formatUsd(metrics.prices.Dymension) },
    { label: 'Dymension Stake', value: formatStake(metrics.stakes.Dymension) },
    { label: 'Initia Price', value: formatUsd(metrics.prices.Initia) },
    { label: 'Initia Stake', value: formatStake(metrics.stakes.Initia) }
  ];

  return (
    <div className="news-ticker">
      <div className="ticker-content">
        {tickerItems.map((item, index) => (
          <div key={`first-${index}`} className="ticker-item">
            <span className="ticker-label">{item.label}:</span>
            <span className="ticker-value">{item.value}</span>
          </div>
        ))}
        {tickerItems.map((item, index) => (
          <div key={`second-${index}`} className="ticker-item">
            <span className="ticker-label">{item.label}:</span>
            <span className="ticker-value">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default NewsTicker; 