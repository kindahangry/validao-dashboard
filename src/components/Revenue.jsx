import React, { useEffect, useState } from 'react';
import { supabase } from '../supabase';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  TimeScale
} from 'chart.js';
import 'chartjs-adapter-date-fns';
import './Revenue.css';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  TimeScale
);

const Revenue = () => {
  const [chainTVLs, setChainTVLs] = useState({});
  const [initiaStakingData, setInitiaStakingData] = useState(null);
  const [initiaNativeApr, setInitiaNativeApr] = useState(0);
  const [initiaLpApr, setInitiaLpApr] = useState(0);
  const [initiaNativeTvl, setInitiaNativeTvl] = useState(0);
  const [initiaLpTvl, setInitiaLpTvl] = useState(0);
  const [historicalMetrics, setHistoricalMetrics] = useState([]);
  const [historicalRevenue, setHistoricalRevenue] = useState([]);
  const [latestRevenue, setLatestRevenue] = useState({});
  const [totalAnnualRevenue, setTotalAnnualRevenue] = useState(0);
  const [timeframe, setTimeframe] = useState('max');
  const [error, setError] = useState(null);
  const [showCumulative, setShowCumulative] = useState(false);
  const [cumulativeRevenueData, setCumulativeRevenueData] = useState([]);
  const [latestTokenPrices, setLatestTokenPrices] = useState({});

  const chainConfig = {
    hyperliquid: { 
      commission: 0.04,
      defaultApr: 2.2,
      color: '#274E40',
      tokenSymbol: 'HYPE'
    },
    celestia: { 
      commission: 0.09,
      defaultApr: 12,
      color: '#32145F',
      tokenSymbol: 'TIA'
    },
    initia: { 
      commission: 0.05,
      nativeVpWeight: 1.0,
      lpVpWeight: 0.8,
      defaultApr: 0, // Won't be used as Initia won't have null APRs
      color: '#333333',
      tokenSymbol: 'INIT'
    },
    dymension: { 
      commission: 0.05,
      defaultApr: 4,
      color: '#5E5854',
      tokenSymbol: 'DYM'
    }
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    animation: {
      duration: 500,
      easing: 'easeOutQuad',
    },
    plugins: {
      legend: { position: 'top' },
      tooltip: {
        mode: 'index',
        intersect: false,
        callbacks: {
          label: context => {
            let value = context.parsed.y;
            return `$${Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
          }
        }
      }
    },
    scales: {
      x: {
        type: 'time',
        time: {
          displayFormats: {
            month: 'MMM yyyy',
            day: 'MMM d',
            week: 'MMM dd',
            hour: 'MMM d',
            minute: 'MMM d'
          },
          tooltipFormat: 'MMM d, yyyy',
          minUnit: 'day'
        },
        ticks: {
          maxRotation: 0,
          autoSkip: true,
          maxTicksLimit: 10,
          source: 'auto'
        },
        grid: {
          drawOnChartArea: false
        },
      },
      y: {
        ticks: {
          callback: value => `$${Number(value).toLocaleString()}`
        },
        grid: {
          color: 'rgba(0, 0, 0, 0.1)'
        },
        beginAtZero: true
      }
    }
  };

  useEffect(() => {
    async function fetchLatestChainTVLs() {
      try {
        const chains = Object.keys(chainConfig);
        const tvls = {};

        // Fetch Initia APRs and TVLs
        const [nativeAprData, lpAprData, nativeTvlData, lpTvlData] = await Promise.all([
          supabase.from('historical_metrics').select('apr').eq('metric_type', 'total_stake_init').order('timestamp', { ascending: false }).limit(1),
          supabase.from('historical_metrics').select('apr').eq('metric_type', 'total_stake_lp').order('timestamp', { ascending: false }).limit(1),
          supabase.from('historical_metrics').select('value_usd').eq('metric_type', 'total_stake_init').order('timestamp', { ascending: false }).limit(1),
          supabase.from('historical_metrics').select('value_usd').eq('metric_type', 'total_stake_lp').order('timestamp', { ascending: false }).limit(1)
        ]);

        if (nativeAprData.data?.length > 0) setInitiaNativeApr(nativeAprData.data[0].apr);
        if (lpAprData.data?.length > 0) setInitiaLpApr(lpAprData.data[0].apr);
        if (nativeTvlData.data?.length > 0) setInitiaNativeTvl(nativeTvlData.data[0].value_usd);
        if (lpTvlData.data?.length > 0) setInitiaLpTvl(lpTvlData.data[0].value_usd);

        // Fetch data for other chains
        const chainPromises = chains.map(async (chain) => {
          if (chain === 'initia') {
            return {
              chain,
              tvl: (nativeTvlData.data?.[0]?.value_usd || 0) + (lpTvlData.data?.[0]?.value_usd || 0),
              apr: nativeAprData.data?.[0]?.apr || 0
            };
          }

          const { data } = await supabase
            .from('historical_metrics')
            .select('value_usd, apr')
            .eq('chain', chain.charAt(0).toUpperCase() + chain.slice(1))
            .eq('metric_type', 'total_stake')
            .order('timestamp', { ascending: false })
            .limit(1);

          return {
            chain,
            tvl: data?.[0]?.value_usd || 0,
            apr: data?.[0]?.apr || 0
          };
        });

        const results = await Promise.all(chainPromises);
        const newTvls = results.reduce((acc, { chain, tvl, apr }) => {
          acc[chain] = { tvl, apr };
          return acc;
        }, {});

        setChainTVLs(newTvls);
      } catch (err) {
        console.error('Error fetching chain TVLs:', err);
        setError(err.message);
      }
    }

    async function fetchTokenPrices() {
      try {
        const tokenPrices = {};

        for (const chainKey of Object.keys(chainConfig)) {
          const config = chainConfig[chainKey];
          if (!config.tokenSymbol) continue; // Skip if no token symbol defined

          const { data, error } = await supabase
            .from('historical_metrics')
            .select('*') // Select all columns for debugging
            .eq('chain', chainKey.charAt(0).toUpperCase() + chainKey.slice(1)) // Use full chain name for filtering
            .order('timestamp', { ascending: false })
            .limit(1);

          if (error) throw error;
          if (data && data.length > 0) {
            if (data[0].token_usd !== null && typeof data[0].token_usd === 'number') {
              tokenPrices[config.tokenSymbol] = data[0].token_usd;
            } else {
              console.warn(`Token USD price for ${chainKey} (${config.tokenSymbol}) is null or not a number:`, data[0].token_usd);
            }
          }
        }
        setLatestTokenPrices(tokenPrices);
      } catch (err) {
        console.error('Error fetching token prices:', err);
        setError(err.message);
      }
    }

    fetchLatestChainTVLs();
    fetchTokenPrices();
  }, []);

  useEffect(() => {
    async function fetchHistoricalMetrics() {
      try {
        let allData = [];
        let page = 0;
        const pageSize = 1000;
        let hasMore = true;

        while (hasMore) {
          const { data, error } = await supabase
            .from('historical_metrics')
            .select('*')
            .order('timestamp', { ascending: true })
            .range(page * pageSize, (page + 1) * pageSize - 1);

          if (error) {
            console.error('Error fetching page', page, ':', error);
            throw error;
          }
          
          if (!data || data.length === 0) {
            hasMore = false;
          } else {
            allData = [...allData, ...data];
            page++;
          }
        }

        setHistoricalMetrics(allData || []);
      } catch (err) {
        console.error('Error fetching historical metrics:', err);
        setError(err.message);
      }
    }

    fetchHistoricalMetrics();
  }, []);

  useEffect(() => {
    if (historicalMetrics.length === 0) return;
    
    try {
      const dailyData = {};

      // Group all historical metrics by day and chain
      historicalMetrics.forEach(metric => {
        const date = new Date(metric.timestamp).toDateString();
        if (!dailyData[date]) {
          dailyData[date] = {};
        }
        if (!dailyData[date][metric.chain.toLowerCase()]) {
          dailyData[date][metric.chain.toLowerCase()] = {};
        }
        dailyData[date][metric.chain.toLowerCase()][metric.metric_type] = metric;
      });

      // Process daily data to calculate total and individual chain revenues
      const revenueData = Object.keys(dailyData)
        .sort((a, b) => new Date(a) - new Date(b))
        .map(date => {
          let totalDailyRevenue = 0;
          const chainDailyRevenuesDetails = {};
          const chainsInDay = dailyData[date];

          Object.keys(chainConfig).forEach(chainKey => {
            const config = chainConfig[chainKey];
            const chainMetrics = chainsInDay[chainKey];

            let initStake = null;
            let lpStake = null;
            let currentChainAprValue;
            let dailyNativeTokensEarned = 0;

            if (!chainMetrics) {
              currentChainAprValue = 'N/A';
              chainDailyRevenuesDetails[chainKey] = {
                annualRevenue: 0,
                tvl: 0,
                apr: currentChainAprValue,
                dailyNativeTokens: 0
              };
              return;
            }

            let chainAnnualRevenue = 0;

            if (chainKey === 'initia') {
              initStake = chainMetrics.total_stake_init || {};
              lpStake = chainMetrics.total_stake_lp || {};

              if (initStake?.value_usd) {
                const apr = initStake.apr || config.defaultApr;
                const initRevenue = initStake.value_usd * (apr / 100) * config.commission;
                chainAnnualRevenue += initRevenue;

                const tokenPrice = latestTokenPrices[config.tokenSymbol];
                if (tokenPrice && tokenPrice > 0) {
                  dailyNativeTokensEarned += (initRevenue / 365) / tokenPrice;
                }
              }
              if (lpStake?.value_usd) {
                const apr = lpStake.apr || config.defaultApr;
                const lpRevenue = lpStake.value_usd * (apr / 100) * config.commission;
                chainAnnualRevenue += lpRevenue;

                const tokenPrice = latestTokenPrices[config.tokenSymbol];
                if (tokenPrice && tokenPrice > 0) {
                  dailyNativeTokensEarned += (lpRevenue / 365) / tokenPrice;
                }
              }

              const initAprDefined = typeof initStake?.apr === 'number';
              const lpAprDefined = typeof lpStake?.apr === 'number';

              if (initAprDefined && lpAprDefined) {
                  currentChainAprValue = `${(initStake.apr).toFixed(2)}% - ${(lpStake.apr).toFixed(2)}%`;
              } else if (initAprDefined) {
                  currentChainAprValue = `${(initStake.apr).toFixed(2)}%`;
              } else if (lpAprDefined) {
                  currentChainAprValue = `${(lpStake.apr).toFixed(2)}%`;
              } else {
                  currentChainAprValue = 'N/A';
              }

            } else {
              const stake = chainMetrics.total_stake;
              if (stake?.value_usd) {
                const apr = stake.apr || config.defaultApr;
                chainAnnualRevenue = stake.value_usd * (apr / 100) * config.commission;

                const tokenPrice = latestTokenPrices[config.tokenSymbol];
                if (tokenPrice && tokenPrice > 0) {
                  dailyNativeTokensEarned = (chainAnnualRevenue / 365) / tokenPrice;
                }
              }
              currentChainAprValue = stake?.apr || config.defaultApr;
            }

            totalDailyRevenue += chainAnnualRevenue;

            chainDailyRevenuesDetails[chainKey] = {
              annualRevenue: chainAnnualRevenue,
              tvl: chainKey === 'initia' ? (initStake?.value_usd || 0) + (lpStake?.value_usd || 0) : (chainMetrics.total_stake?.value_usd || 0),
              apr: currentChainAprValue,
              dailyNativeTokens: dailyNativeTokensEarned
            };
          });

          return {
            date: new Date(date),
            totalDailyRevenue,
            ...chainDailyRevenuesDetails
          };
        });

      setHistoricalRevenue(revenueData);
      
      if (revenueData.length > 0) {
        const latest = revenueData[revenueData.length - 1];
        setTotalAnnualRevenue(latest.totalDailyRevenue);
        
        const latestChainRevenuesDetails = {};
        Object.keys(chainConfig).forEach(chainKey => {
          const chainData = latest[chainKey];
          if (chainData) {
            latestChainRevenuesDetails[chainKey] = {
              annualRevenue: chainData.annualRevenue || 0,
              tvl: chainData.tvl || 0,
              apr: chainData.apr || 0,
              commission: chainConfig[chainKey]?.commission || 0
            };
          }
        });
        setLatestRevenue(latestChainRevenuesDetails);
      }
    } catch (err) {
      console.error('Error processing historical metrics:', err);
      setError(err.message);
    }
  }, [historicalMetrics, latestTokenPrices]);

  useEffect(() => {
    if (historicalRevenue.length === 0 || Object.keys(latestTokenPrices).length === 0) return;

    const newCumulativeData = [];
    let runningTotalUsd = 0;

    historicalRevenue.forEach(dayData => {
      let dailyEarnedUsd = 0;

      Object.keys(chainConfig).forEach(chainKey => {
        const config = chainConfig[chainKey];
        const chainData = dayData[chainKey];

        if (chainData && config.tokenSymbol && latestTokenPrices[config.tokenSymbol]) {
          const dailyNativeTokens = chainData.dailyNativeTokens || 0;
          const currentTokenPrice = latestTokenPrices[config.tokenSymbol];
          dailyEarnedUsd += dailyNativeTokens * currentTokenPrice;
        }
      });

      runningTotalUsd += dailyEarnedUsd;

      newCumulativeData.push({
        date: dayData.date,
        cumulativeRevenue: runningTotalUsd
      });
    });

    setCumulativeRevenueData(newCumulativeData);

  }, [historicalRevenue, latestTokenPrices]);

  const formatChartData = (data, valueKey, label, color, timeframe) => {
    if (!data || data.length === 0) {
      return { labels: [], datasets: [] };
    }

    let filteredData = [...data].sort((a, b) => new Date(a.date) - new Date(b.date));

    const latestDate = filteredData[filteredData.length - 1]?.date;
    if (!latestDate) {
      return { labels: [], datasets: [] };
    }

    let startDate;
    if (timeframe === '1w') {
      startDate = new Date(latestDate);
      startDate.setDate(startDate.getDate() - 7);
    } else if (timeframe === '1m') {
      startDate = new Date(latestDate);
      startDate.setMonth(startDate.getMonth() - 1);
    } else if (timeframe === '1y') {
      startDate = new Date(latestDate);
      startDate.setFullYear(latestDate.getFullYear() - 1);
    } else {
      startDate = filteredData[0].date;
    }

    filteredData = filteredData.filter(row => {
      const rowDate = new Date(row.date);
      return rowDate >= startDate;
    });

    return {
      labels: filteredData.map(row => row.date),
      datasets: [{
        label,
        data: filteredData.map(row => row[valueKey]),
        borderColor: color,
        tension: 0.3,
        pointRadius: 0,
      }],
    };
  };

  const formatUsd = (value) =>
    value ? `$${Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 })}` : '$0';

  const formatPercent = (value) => {
    if (typeof value === 'number' && value !== undefined && value !== null) {
      return `${value.toFixed(2)}%`;
    }
    return '0.00%';
  };

  const formatAprDisplay = (aprValue) => {
    if (typeof aprValue === 'string') {
      return aprValue; // Already formatted as a range string
    }
    return formatPercent(aprValue); // Format as percentage if it's a number
  };

  if (error) {
    return <div className="error">Error loading data: {error}</div>;
  }

  return (
    <div className="revenue-page">
      <div className="overview-grid">
        <div className="overview-card">
          <h2>Total Annual Revenue</h2>
          <div className="stat-value">{formatUsd(totalAnnualRevenue)}</div>
        </div>
      </div>

      <div className="container">
        <div className="data-box">
          <h3>{showCumulative ? 'Cumulative Revenue' : 'Historical Revenue'}</h3>

          <div className="timeframe-buttons">
            {['1w', '1m', '1y', 'max'].map(tf => (
              <button
                key={tf}
                className={tf === timeframe ? 'active' : ''}
                onClick={() => setTimeframe(tf)}
                style={tf === timeframe ? { backgroundColor: '#1A2B5C' } : {}}
              >
                {tf.toUpperCase()}
              </button>
            ))}
            <button
              className={showCumulative ? 'active' : ''}
              onClick={() => setShowCumulative(!showCumulative)}
              style={showCumulative ? { backgroundColor: '#1A2B5C' } : {}}
            >
              {showCumulative ? 'Annual View' : 'Cumulative View'}
            </button>
          </div>

          <div className="chart-container">
            {(showCumulative ? cumulativeRevenueData.length > 0 : historicalRevenue.length > 0) ? (
              <Line 
                data={formatChartData(
                  showCumulative ? cumulativeRevenueData : historicalRevenue,
                  showCumulative ? 'cumulativeRevenue' : 'totalDailyRevenue',
                  showCumulative ? 'Cumulative Revenue (USD)' : 'Annual Revenue (USD)',
                  '#1A2B5C',
                  timeframe
                )} 
                options={chartOptions} 
              />
            ) : (
              <p>Loading revenue data...</p>
            )}
          </div>
        </div>
      </div>

      <div className="chains-section">
        <h2 className="section-title section-subtitle">Chain Revenue Breakdowns</h2>
        <div className="chains-grid">
          {Object.entries(latestRevenue)
            .sort(([, revenueA], [, revenueB]) => (revenueB.annualRevenue || 0) - (revenueA.annualRevenue || 0))
            .map(([chain, data]) => (
              <div key={chain} className="chain-card" style={{ borderColor: chainConfig[chain]?.color }}>
                <h3>{chain.charAt(0).toUpperCase() + chain.slice(1)}</h3>
                <div className="chain-stats">
                  <div className="chain-stat">
                    <span className="stat-label">Annual Revenue</span>
                    <span className="stat-value">{formatUsd(data.annualRevenue)}</span>
                  </div>
                  <div className="chain-stat">
                    <span className="stat-label">Total Stake (TVL)</span>
                    <span className="stat-value">{formatUsd(data.tvl)}</span>
                  </div>
                  <div className="chain-stat">
                    <span className="stat-label">APR</span>
                    <span className="stat-value">{formatAprDisplay(data.apr)}</span>
                  </div>
                  <div className="chain-stat">
                    <span className="stat-label">Commission</span>
                    <span className="stat-value">{formatPercent(data.commission * 100)}</span>
                  </div>
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
};

export default Revenue; 