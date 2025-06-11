import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Line } from 'react-chartjs-2';
import { supabase } from '../supabase';
import ValiDashTitle from './ValiDashTitle';
import './Overview.css';

const Overview = () => {
  const [overviewData, setOverviewData] = useState(null);
  const [chainTVLs, setChainTVLs] = useState({});
  const [historicalData, setHistoricalData] = useState([]);
  const [chainHistoricalData, setChainHistoricalData] = useState({});
  const [chartData, setChartData] = useState(null);
  const [timeframe, setTimeframe] = useState('max');

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
        ticks: {
          maxRotation: 0,
          autoSkip: true,
          maxTicksLimit: 10,
        },
        grid: {
          drawOnChartArea: false,
        }
      },
      y: {
        ticks: {
          callback: value => `$${Number(value).toLocaleString()}`
        }
      }
    }
  };

  const miniChartOptions = {
    ...chartOptions,
    plugins: {
      ...chartOptions.plugins,
      legend: { display: false },
      tooltip: {
        ...chartOptions.plugins.tooltip,
        enabled: true
      }
    },
    scales: {
      x: {
        display: false,
      },
      y: {
        display: false,
      }
    }
  };

  useEffect(() => {
    async function fetchOverview() {
      const { data, error } = await supabase
        .from('validao-overview')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(1);

      if (error || !data || data.length === 0) {
        return;
      }
      setOverviewData(data[0]);
    }

    async function fetchLatestChainData() {
      const chains = ['Hyperliquid', 'Celestia', 'Dymension', 'Initia'];
      const chainDataPromises = chains.map(async (chainName) => {
        const { data, error } = await supabase
          .from('historical_metrics')
          .select('value_usd, apr')
          .eq('chain', chainName)
          .eq('metric_type', 'total_stake')
          .order('timestamp', { ascending: false })
          .limit(1);

        if (error) {
          console.error(`Error fetching data for ${chainName}:`, error);
          return { chain: chainName.toLowerCase(), tvl: null, apr: null };
        }

        const latestEntry = data[0];
        return {
          chain: chainName.toLowerCase(),
          tvl: latestEntry?.value_usd || null,
          apr: latestEntry?.apr || null,
        };
      });

      const results = await Promise.all(chainDataPromises);

      const finalChainData = results.reduce((acc, current) => {
        acc[current.chain] = { tvl: current.tvl, apr: current.apr };
        return acc;
      }, {});

      setChainTVLs(finalChainData);
    }

    async function fetchHistoricalOverview() {
      const { data, error } = await supabase
        .from('validao-overview')
        .select('*')
        .order('timestamp', { ascending: true });

      if (error) {
        return;
      }
      setHistoricalData(data || []);
    }

    async function fetchChainHistoricalData() {
      const chains = ['Hyperliquid', 'Celestia', 'Dymension', 'Initia'];
      const chainDataPromises = chains.map(async (chainName) => {
        const { data, error } = await supabase
          .from('historical_metrics')
          .select('timestamp, value_usd')
          .eq('chain', chainName)
          .eq('metric_type', 'total_stake')
          .order('timestamp', { ascending: true });

        if (error) {
          console.error(`Error fetching historical data for ${chainName}:`, error);
          return { chain: chainName.toLowerCase(), data: [] };
        }

        return {
          chain: chainName.toLowerCase(),
          data: data || []
        };
      });

      const results = await Promise.all(chainDataPromises);
      const chainData = results.reduce((acc, current) => {
        acc[current.chain] = current.data;
        return acc;
      }, {});

      setChainHistoricalData(chainData);
    }

    // Run all fetches in parallel
    Promise.all([
      fetchOverview(),
      fetchLatestChainData(),
      fetchHistoricalOverview(),
      fetchChainHistoricalData()
    ]).catch(error => {
      console.error('Error fetching data:', error);
    });
  }, []);

  useEffect(() => {
    if (historicalData.length > 0) {
      setChartData(formatChartData(historicalData));
    }
  }, [timeframe, historicalData]);

  const formatChartData = (data) => {
    const now = new Date();
    let filtered = [...data];

    if (timeframe === '1w') {
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(now.getDate() - 7);
      filtered = data.filter(row => new Date(row.timestamp) >= oneWeekAgo);
    } else if (timeframe === '1m') {
      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(now.getMonth() - 1);
      filtered = data.filter(row => new Date(row.timestamp) >= oneMonthAgo);
    } else if (timeframe === '1y') {
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(now.getFullYear() - 1);
      filtered = data.filter(row => new Date(row.timestamp) >= oneYearAgo);
    }

    return {
      labels: filtered.map(row => new Date(row.timestamp).toLocaleDateString()),
      datasets: [{
        label: 'Total Value Locked (USD)',
        data: filtered.map(row => row.total_stake_usd),
        borderColor: '#1A2B5C',
        tension: 0.3,
        pointRadius: 0,
      }]
    };
  };

  const formatMiniChartData = (data, chain) => {
    if (!data || data.length === 0) return null;

    // Get the last 30 days of data
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const filtered = data.filter(row => new Date(row.timestamp) >= thirtyDaysAgo);

    // Define chain-specific colors
    const chainColors = {
      hyperliquid: '#274E40',
      celestia: '#32145F',
      initia: '#333333',
      dymension: '#5E5854'
    };

    return {
      labels: filtered.map(row => new Date(row.timestamp).toLocaleDateString()),
      datasets: [{
        data: filtered.map(row => row.value_usd),
        borderColor: chainColors[chain] || 'rgb(75, 192, 192)',
        tension: 0.3,
        pointRadius: 0,
      }]
    };
  };

  const formatUsd = (value) =>
    value ? `$${Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 })}` : '$0';

  const formatPercent = (value) =>
    value !== undefined && value !== null ? `${value.toFixed(2)}%` : '0.00%';

  // Define chain-specific colors for buttons
  const chainButtonColors = {
    hyperliquid: '#274E40',
    celestia: '#32145F',
    initia: '#333333',
    dymension: '#5E5854'
  };

  return (
    <div className="overview">
      <div className="validao-title-container">
        <ValiDashTitle />
      </div>

      <div className="overview-grid">
        <div className="overview-card">
          <h2>Total Chains</h2>
          <div className="stat-value">{overviewData?.active_chains || 0}</div>
        </div>
        <div className="overview-card">
          <h2>Total Value Locked</h2>
          <div className="stat-value">{formatUsd(overviewData?.total_stake_usd)}</div>
        </div>
        <div className="overview-card">
          <h2>Total Delegators</h2>
          <div className="stat-value">{overviewData?.total_delegators?.toLocaleString() || 0}</div>
        </div>
      </div>

      <div className="container">
        <div className="data-box">
          <h3>ValiDAO Total Value Locked Over Time</h3>

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
          </div>

          <div className="chart-container">
            {chartData ? <Line data={chartData} options={chartOptions} /> : <p>Loading chart...</p>}
          </div>
        </div>
      </div>

      <div className="chains-section">
        <h2 className="section-title section-subtitle">Featured Networks</h2>
        <div className="chains-grid">
          {Object.entries(chainTVLs)
            .sort(([, tvlA], [, tvlB]) => (tvlB?.tvl || 0) - (tvlA?.tvl || 0))
            .map(([chain]) => (
              <Link 
                key={chain} 
                to={`/${chain.toLowerCase()}`} 
                className="chain-card"
                style={{ 
                  '--chain-color': chainButtonColors[chain] || '#4fd1c5',
                  borderColor: chainButtonColors[chain] || '#4fd1c5'
                }}
              >
                <h3>{chain.charAt(0).toUpperCase() + chain.slice(1)}</h3>
                <div className="chain-stats">
                  <div className="chain-stat">
                    <span className="stat-label">TVL</span>
                    <span className="stat-value">{formatUsd(chainTVLs[chain]?.tvl)}</span>
                    <span className="stat-label" style={{ marginLeft: '16px' }}>APR</span>
                    <span className="stat-value">{formatPercent(chainTVLs[chain]?.apr)}</span>
                  </div>
                </div>
                <div className="mini-chart">
                  {chainHistoricalData[chain] && (
                    <Line 
                      data={formatMiniChartData(chainHistoricalData[chain], chain)} 
                      options={miniChartOptions}
                    />
                  )}
                </div>
              </Link>
            ))}
        </div>
      </div>
    </div>
  );
};

export default Overview;
