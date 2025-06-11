import React, { useState, useEffect } from 'react';
import { Chart as ChartJS } from 'chart.js/auto';
import { Line } from 'react-chartjs-2';
import { supabase } from './supabase';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Overview from './components/Overview';
import Background from './components/Background';
import Revenue from './components/Revenue';
import Mission from './components/Mission';
import Governance from './components/Governance';
import './App.css';
import 'chartjs-plugin-crosshair';
import NewsTicker from './components/NewsTicker';
import StatCard from './components/StatCard';

import overviewBg from '/optimized/main-overview-bg@2x.webp';
import hyperliquidBg from '/optimized/hyperliquid-bg@2x.webp';
import celestiaBg from '/optimized/celestia-bg@2x.webp';
import dymensionBg from '/optimized/dymension-bg@2x.webp';
import initiaBg from '/optimized/initia-bg@2x.webp';

const AppContent = () => {
  const location = useLocation();
  const [supabaseData, setSupabaseData] = useState([]);
  const [timeframes, setTimeframes] = useState({
    hyperliquid: { stake: 'max', delegator: 'max', revenue: 'max' },
    celestia: { stake: 'max', delegator: 'max', revenue: 'max' },
    dymension: { stake: 'max', delegator: 'max', revenue: 'max' },
    initia: { stake: 'max', delegator: 'max', revenue: 'max' }
  });
  const [error, setError] = useState(null);
  const [historicalChainRevenue, setHistoricalChainRevenue] = useState({});

  // Move these hooks to the top level
  const [selectedTab, setSelectedTab] = React.useState('stake');
  const [selectedTimeframe, setSelectedTimeframe] = React.useState('max');

  const chainConfig = {
    Hyperliquid: { commission: 0.04, defaultApr: 2.2 },
    Celestia: { commission: 0.09, defaultApr: 12 },
    Initia: { 
      commission: 0.05,
      nativeVpWeight: 1.0,
      lpVpWeight: 0.8,
      defaultApr: 0, // Won't be used as Initia won't have null APRs
      defaultNativeApr: 20,
      defaultLpApr: 120
    },
    Dymension: { commission: 0.05, defaultApr: 4 }
  };

  const getBackgroundImage = () => {
    switch (location.pathname) {
      case '/':
        return overviewBg;
      case '/hyperliquid':
        return hyperliquidBg;
      case '/celestia':
        return celestiaBg;
      case '/dymension':
        return dymensionBg;
      case '/initia':
        return initiaBg;
      default:
        return overviewBg;
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
      onComplete: (animation) => {
      }
    },
    plugins: {
      legend: { position: 'top' },
      tooltip: {
        mode: 'index',
        intersect: false,
        callbacks: {
          label: context => {
            let value = context.parsed.y;
            return Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 });
          }
        }
      },
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
        }
      },
      y: {
        ticks: {
          callback: value => Number(value).toLocaleString(),
        },
        grid: {
          color: 'rgba(0, 0, 0, 0.1)'
        },
        beginAtZero: true
      }
    }
  };

  useEffect(() => {
    async function loadData() {
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

          if (error) throw error;
          
          if (data.length === 0) {
            hasMore = false;
          } else {
            allData = [...allData, ...data];
            page++;
          }
        }

        // Normalize chain names to lowercase
        const normalizedData = allData.map(row => ({
          ...row,
          chain: row.chain.toLowerCase()
        }));

        setSupabaseData(normalizedData || []);
        calculateHistoricalChainRevenue(normalizedData);

      } catch (err) {
        console.error('Error fetching data:', err);
        setError(err.message);
      }
    }

    loadData();
  }, []);

  const calculateHistoricalChainRevenue = (data) => {
    const metricsByTimestamp = data.reduce((acc, metric) => {
      const timestamp = metric.timestamp;
      if (!acc[timestamp]) {
        acc[timestamp] = [];
      }
      acc[timestamp].push(metric);
      return acc;
    }, {});

    const revenueByChain = {};

    Object.entries(metricsByTimestamp).forEach(([timestamp, metrics]) => {
      const chainMetrics = metrics.reduce((acc, metric) => {
        if (!acc[metric.chain]) {
          acc[metric.chain] = {};
        }
        acc[metric.chain][metric.metric_type] = metric;
        return acc;
      }, {});

      Object.entries(chainMetrics).forEach(([chain, chainData]) => {
        let annualRevenue = 0;
        // Ensure chain name capitalization matches chainConfig keys
        const configKey = chain.charAt(0).toUpperCase() + chain.slice(1);
        const config = chainConfig[configKey];

        if (!config) return;

        if (chain === 'initia') {
          const initStake = chainData.total_stake_init;
          const lpStake = chainData.total_stake_lp;
          

          if (initStake && initStake.value_usd) {
            const apr = initStake.apr !== null ? initStake.apr : config.defaultNativeApr;
            annualRevenue += initStake.value_usd * (apr / 100) * config.commission;
          }
          if (lpStake && lpStake.value_usd) {
            const apr = lpStake.apr !== null ? lpStake.apr : config.defaultLpApr;
            annualRevenue += lpStake.value_usd * (apr / 100) * config.commission;
          }
        } else {
          const stake = chainData.total_stake;
          
          if (stake && stake.value_usd) {
            const apr = stake.apr !== null ? stake.apr : config.defaultApr;
            annualRevenue = stake.value_usd * (apr / 100) * config.commission;
          }
        }

        

        if (!revenueByChain[chain]) {
          revenueByChain[chain] = [];
        }
        revenueByChain[chain].push({
          timestamp,
          revenue: annualRevenue
        });
      });
    });
    
    // Sort revenue data by timestamp for each chain
    Object.keys(revenueByChain).forEach(chain => {
        revenueByChain[chain].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    });

    
    setHistoricalChainRevenue(revenueByChain);
  };

  const formatChart = (data, valueKey, label, color, timeframe, currentChain) => {
    // Convert timestamps to Date objects for comparison
    let filteredData = data.map(row => ({
      ...row,
      timestamp: new Date(row.timestamp)
    }));

    // Sort by timestamp first
    filteredData.sort((a, b) => a.timestamp - b.timestamp);

    // Get the latest timestamp
    const latestTimestamp = filteredData[filteredData.length - 1]?.timestamp;
    if (!latestTimestamp) return { labels: [], datasets: [], options: {} }; // Return empty options

    // Calculate the start date based on the timeframe
    let startDate;
    if (timeframe === '1w') {
      startDate = new Date(latestTimestamp);
      startDate.setDate(startDate.getDate() - 7);
    } else if (timeframe === '1m') {
      startDate = new Date(latestTimestamp);
      startDate.setMonth(startDate.getMonth() - 1);
    } else if (timeframe === '1y') {
      startDate = new Date(latestTimestamp);
      startDate.setFullYear(latestTimestamp.getFullYear() - 1);
    } else {
      // For 'max', use the earliest date in the filtered data
      startDate = filteredData[0]?.timestamp;
    }

    // Filter data based on the calculated start date
    filteredData = filteredData.filter(row => row.timestamp >= startDate);

    // Define chain-specific colors
    const chainColors = {
      hyperliquid: '#274E40',
      celestia: '#32145F',
      initia: '#333333',
      dymension: '#5E5854'
    };

    // Create dynamic chart options based on the filtered data
    const dynamicChartOptions = {
      ...chartOptions,
      scales: {
        ...chartOptions.scales,
        x: {
          ...chartOptions.scales.x,
          min: filteredData[0]?.timestamp.getTime(),
          max: filteredData[filteredData.length - 1]?.timestamp.getTime()
        }
      }
    };

    return {
      labels: filteredData.map(row => row.timestamp), // Pass Date objects directly
      datasets: [{
        label,
        data: filteredData.map(row => row[valueKey]),
        borderColor: chainColors[currentChain] || color,
        tension: 0.3,
        pointRadius: 0,
      }],
      options: dynamicChartOptions // Return dynamic options
    };
  };

  const formatRevenueChartData = (data, timeframe, currentChain) => {
    // Convert timestamps to Date objects for comparison
    let filteredData = data.map(row => ({
      ...row,
      timestamp: new Date(row.timestamp)
    }));

    // Sort by timestamp first
    filteredData.sort((a, b) => a.timestamp - b.timestamp);

    // Get the latest timestamp
    const latestTimestamp = filteredData[filteredData.length - 1]?.timestamp;

    if (!latestTimestamp) return { labels: [], datasets: [], options: {} }; // Return empty options

    // Calculate the start date based on the timeframe
    let startDate;
    if (timeframe === '1w') {
      startDate = new Date(latestTimestamp);
      startDate.setDate(startDate.getDate() - 7);
    } else if (timeframe === '1m') {
      startDate = new Date(latestTimestamp);
      startDate.setMonth(startDate.getMonth() - 1);
    } else if (timeframe === '1y') {
      startDate = new Date(latestTimestamp);
      startDate.setFullYear(latestTimestamp.getFullYear() - 1);
    } else {
      // For 'max', use the earliest date in the filtered data
      startDate = filteredData[0]?.timestamp;
    }

    // Filter data based on the calculated start date
    filteredData = filteredData.filter(row => row.timestamp >= startDate);

    // Define chain-specific colors
    const chainColors = {
      hyperliquid: '#274E40',
      celestia: '#32145F',
      initia: '#333333',
      dymension: '#5E5854'
    };

    // Create dynamic chart options based on the filtered data
    const dynamicChartOptions = {
      ...chartOptions,
      scales: {
        ...chartOptions.scales,
        x: {
          ...chartOptions.scales.x,
          min: filteredData[0]?.timestamp.getTime(),
          max: filteredData[filteredData.length - 1]?.timestamp.getTime()
        }
      }
    };

    return {
      labels: filteredData.map(row => row.timestamp), // Pass Date objects directly
      datasets: [{
        label: 'Annual Revenue (USD)',
        data: filteredData.map(row => row.revenue),
        borderColor: chainColors[currentChain] || 'rgb(255, 99, 132)',
        tension: 0.3,
        pointRadius: 0,
      }],
      options: dynamicChartOptions // Return dynamic options
    };
  };

  const handleTimeframeChange = (chain, chartType, newTimeframe) => {
    setTimeframes(prev => ({
      ...prev,
      [chain]: {
        ...prev[chain],
        [chartType]: newTimeframe
      }
    }));
  };

  // Preload the next likely background image
  useEffect(() => {
    const preloadNextImage = () => {
      const currentPath = location.pathname;
      let nextImage = overviewBg; // Default to overview

      // Determine the next likely background based on current path
      if (currentPath === '/') {
        nextImage = hyperliquidBg; // Most likely to visit Hyperliquid next
      } else if (currentPath === '/hyperliquid') {
        nextImage = celestiaBg;
      } else if (currentPath === '/celestia') {
        nextImage = dymensionBg;
      } else if (currentPath === '/dymension') {
        nextImage = initiaBg;
      }

      // Preload the image
      const img = new Image();
      img.src = nextImage;
    };

    preloadNextImage();
  }, [location.pathname]);

  if (error) {
    return <div className="error">Error loading data: {error}</div>;
  }

  // Handle information pages
  if (['/mission', '/governance', '/revenue'].includes(location.pathname)) {
    return (
      <>
        <Background image={getBackgroundImage()} />
        <div className="app-container">
          <Sidebar />
          <div className="main-content">
            <Routes>
              <Route path="/mission" element={<Mission />} />
              <Route path="/governance" element={<Governance />} />
              <Route path="/revenue" element={<Revenue />} />
            </Routes>
          </div>
        </div>
      </>
    );
  }

  // Handle treasury page - show overview instead
  if (location.pathname === '/treasury') {
    return (
      <>
        <Background image={getBackgroundImage()} />
        <div className="app-container">
          <Sidebar />
          <div className="main-content">
            <Overview />
          </div>
        </div>
      </>
    );
  }

  // Handle overview page
  if (location.pathname === '/') {
    return (
      <>
        <Background image={getBackgroundImage()} />
        <div className="app-container">
          <Sidebar />
          <div className="main-content">
            <Overview />
          </div>
        </div>
      </>
    );
  }

  // Handle chain-specific pages
  const currentChain = location.pathname.slice(1).toLowerCase();
  const chainData = supabaseData.filter(row => row.chain === currentChain);
  
  // Get the latest timestamp for the chain
  const latestTimestamp = chainData[chainData.length - 1]?.timestamp;
  
  // Filter stake data
  const stakeData = chainData.filter(row => 
    row.metric_type === 'total_stake' && 
    row.value_usd !== null &&
    new Date(row.timestamp) <= new Date(latestTimestamp) &&
    (currentChain !== 'initia' || row.chain === 'initia') // Keep original filtering for Initia stake chart
  );

  // Filter delegator count data
  const delegatorData = chainData.filter(row => 
    row.metric_type === 'delegator_count' && 
    row.value !== null &&
    new Date(row.timestamp) <= new Date(latestTimestamp)
  );

  const chainHistoricalRevenueData = historicalChainRevenue[currentChain] || []; // Renamed to avoid confusion

  // Find latest values for summary
  const latestStake = stakeData[stakeData.length - 1]?.value_usd || 0;
  const latestDelegators = delegatorData[delegatorData.length - 1]?.value || 0;
  const latestRevenue = chainHistoricalRevenueData[chainHistoricalRevenueData.length - 1]?.revenue || 0;

  // Define chain-specific colors for buttons
  const chainButtonColors = {
    hyperliquid: '#274E40',
    celestia: '#32145F',
    initia: '#333333',
    dymension: '#5E5854'
  };

  // Prepare chart data and options
  const stakeChartData = formatChart(stakeData, 'value_usd', 'Stake (USD)', 'rgb(75, 192, 192)', selectedTimeframe, currentChain);
  const delegatorChartData = formatChart(delegatorData, 'value', 'Delegator Count', 'rgb(153, 102, 255)', selectedTimeframe, currentChain);
  const revenueChartData = formatRevenueChartData(chainHistoricalRevenueData, selectedTimeframe, currentChain); // Correctly passing chain-specific revenue data

  return (
    <>
      <Background image={getBackgroundImage()} />
      <div className="app-container">
        <Sidebar />
        <div className="main-content chain-main-content">
          {/* Metrics Summary Row */}
          <div className="metrics-summary">
            <StatCard title="Current Stake" value={latestStake.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })} />
            <StatCard title="Delegators" value={latestDelegators.toLocaleString()} />
            <StatCard title="Annual Revenue" value={latestRevenue.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })} />
          </div>
          {/* Timeframe Filter */}
          <div className="chain-timeframe-buttons">
            {['1w', '1m', '1y', 'max'].map(tf => (
              <button
                key={tf}
                className={selectedTimeframe === tf ? 'active' : ''}
                onClick={() => setSelectedTimeframe(tf)}
                style={selectedTimeframe === tf ? { backgroundColor: chainButtonColors[currentChain] || '#4fd1c5' } : {}}
              >
                {tf.toUpperCase()}
              </button>
            ))}
          </div>
          {/* Tabbed Chart Section */}
          <div className="metrics-tabs">
            <div className="tab-buttons">
              <button 
                className={selectedTab === 'stake' ? 'active' : ''} 
                onClick={() => setSelectedTab('stake')}
                style={selectedTab === 'stake' ? { backgroundColor: chainButtonColors[currentChain] || '#4fd1c5' } : {}}
              >
                Stake Over Time
              </button>
              <button 
                className={selectedTab === 'delegator' ? 'active' : ''} 
                onClick={() => setSelectedTab('delegator')}
                style={selectedTab === 'delegator' ? { backgroundColor: chainButtonColors[currentChain] || '#4fd1c5' } : {}}
              >
                Delegator Count
              </button>
              <button 
                className={selectedTab === 'revenue' ? 'active' : ''} 
                onClick={() => setSelectedTab('revenue')}
                style={selectedTab === 'revenue' ? { backgroundColor: chainButtonColors[currentChain] || '#4fd1c5' } : {}}
              >
                Annual Revenue
              </button>
            </div>
            <div className="tab-content">
              {selectedTab === 'stake' && (
                <div className="container">
                  <div className="data-box">
                    <h3>{currentChain.charAt(0).toUpperCase() + currentChain.slice(1)} Historical Stake (USD)</h3>
                    <div className="chart-container">
                      {stakeData.length > 0 ? (
                        <Line 
                          key={`${currentChain}-${selectedTimeframe}-${selectedTab}-stake`}
                          data={stakeChartData} 
                          options={stakeChartData.options} 
                        />
                      ) : (
                        <p>Loading stake data...</p>
                      )}
                    </div>
                  </div>
                </div>
              )}
              {selectedTab === 'delegator' && (
                <div className="container">
                  <div className="data-box">
                    <h3>{currentChain.charAt(0).toUpperCase() + currentChain.slice(1)} Historical Delegator Count</h3>
                    <div className="chart-container">
                      {delegatorData.length > 0 ? (
                        <Line 
                          key={`${currentChain}-${selectedTimeframe}-${selectedTab}-delegator`}
                          data={delegatorChartData} 
                          options={delegatorChartData.options} 
                        />
                      ) : (
                        <p>Loading delegator data...</p>
                      )}
                    </div>
                  </div>
                </div>
              )}
              {selectedTab === 'revenue' && (
                <div className="container">
                  <div className="data-box">
                    <h3>{currentChain.charAt(0).toUpperCase() + currentChain.slice(1)} Historical Annual Revenue (USD)</h3>
                    <div className="chart-container">
                      {chainHistoricalRevenueData.length > 0 ? (
                        <Line 
                          key={`${currentChain}-${selectedTimeframe}-${selectedTab}-revenue`}
                          data={revenueChartData} 
                          options={revenueChartData.options} 
                        />
                      ) : (
                        <p>Loading revenue data...</p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

function App() {
  return (
    <Router>
      <AppContent />
      <NewsTicker />
    </Router>
  );
}

export default App;
