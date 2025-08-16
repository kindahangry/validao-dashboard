import React, { useEffect, useState, useCallback } from "react";
import { Pie } from "react-chartjs-2";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from "chart.js";
import "./VDO.css";

ChartJS.register(ArcElement, Tooltip, Legend);

const ETH_V1_CA = "0x2ef8a2Ccb058915E00E16aA13Cc6E36F19D8893b";
const ETH_V2_CA = "0xB5EE887259F792E613edBD20dDE8970C10fefda1";
const HYPE_CA = "0xB5EE887259F792E613edBD20dDE8970C10fefda1";
const NULL_ADDRESS = "0x000000000000000000000000000000000000dEaD";
const BRIDGE_ADDRESS = "0x94551a8bf4464e2B52c3b714606E497980791980";
const DECIMALS = 18;

// Excluded addresses for whale analysis
const EXCLUDED_ADDRESSES = new Set([
  "0xDba68f07d1b7Ca219f78ae8582C213d975c25cAf".toLowerCase(), // team tokens
  "0x000000000000000000000000000000000000dEaD".toLowerCase(), // migration v1
  "0x94551a8bf4464e2B52c3b714606E497980791980".toLowerCase(), // bridge v2
  "0x5889de3e84ec33c3a630c2511541d45b27343d4b".toLowerCase(), // hyperliquid LP
  "0xa76be5db3392b81aa1ba3718a085410a36edd0da".toLowerCase(), // hyperliquid treasury
  "0x85eDfc284A273E4D7428C3C7E9FDc591b44416e4".toLowerCase(), // airdrop claim
]);

const VDO = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [whaleData, setWhaleData] = useState(null);
  const [whaleLoading, setWhaleLoading] = useState(false);
  const [previousWhaleConcentration, setPreviousWhaleConcentration] = useState(null);

  const fetchTokenData = async (url) => {
    const response = await fetch(url);
    const data = await response.json();
    return data;
  };

  const calculateV1Holders = (holdersData, totalSupply) => {
    const nullHolding = holdersData.items?.find(
      item => item.address.hash.toLowerCase() === NULL_ADDRESS.toLowerCase()
    )?.value || "0";
    
    const circulatingSupply = BigInt(totalSupply) - BigInt(nullHolding);
    return Number(circulatingSupply) / Math.pow(10, DECIMALS);
  };

  const calculateV2Holders = (holdersData, totalSupply) => {
    const bridgeHolding = holdersData.items?.find(
      item => item.address.hash.toLowerCase() === BRIDGE_ADDRESS.toLowerCase()
    )?.value || "0";
    
    const circulatingSupply = BigInt(totalSupply) - BigInt(bridgeHolding);
    return Number(circulatingSupply) / Math.pow(10, DECIMALS);
  };

  const calculateHypeHolders = (totalSupply) => {
    return Number(BigInt(totalSupply)) / Math.pow(10, DECIMALS);
  };

  const fetchTop100Holders = async () => {
    try {
      const [v1HoldersData, v2HoldersData, v1TokenData, v2TokenData, hypeData] = await Promise.all([
        fetchTokenData(`https://eth.blockscout.com/api/v2/tokens/${ETH_V1_CA}/holders?limit=100`),
        fetchTokenData(`https://eth.blockscout.com/api/v2/tokens/${ETH_V2_CA}/holders?limit=100`),
        fetchTokenData(`https://eth.blockscout.com/api/v2/tokens/${ETH_V1_CA}`),
        fetchTokenData(`https://eth.blockscout.com/api/v2/tokens/${ETH_V2_CA}`),
        fetchTokenData(`https://www.hyperscan.com/api/v2/tokens/${HYPE_CA}`)
      ]);

      // Calculate total supply across all chains first
      const totalV1Supply = Number(BigInt(v1TokenData.total_supply)) / Math.pow(10, DECIMALS);
      const totalV2Supply = Number(BigInt(v2TokenData.total_supply)) / Math.pow(10, DECIMALS);
      const totalHypeSupply = Number(BigInt(hypeData.total_supply || "0")) / Math.pow(10, DECIMALS);
      const combinedTotalSupply = totalV1Supply + totalV2Supply + totalHypeSupply;

      // Process V1 holders (exclude migration and team addresses)
      const v1Holders = v1HoldersData.items?.filter(holder => 
        !EXCLUDED_ADDRESSES.has(holder.address.hash.toLowerCase())
      ).map(holder => ({
        address: holder.address.hash,
        balance: Number(BigInt(holder.value)) / Math.pow(10, DECIMALS),
        chain: 'ETH V1',
        percentage: (Number(BigInt(holder.value)) / Math.pow(10, DECIMALS) / combinedTotalSupply) * 100
      })) || [];

      // Process V2 holders (exclude bridge and team addresses)  
      const v2Holders = v2HoldersData.items?.filter(holder => 
        !EXCLUDED_ADDRESSES.has(holder.address.hash.toLowerCase())
      ).map(holder => ({
        address: holder.address.hash,
        balance: Number(BigInt(holder.value)) / Math.pow(10, DECIMALS),
        chain: 'ETH V2',
        percentage: (Number(BigInt(holder.value)) / Math.pow(10, DECIMALS) / combinedTotalSupply) * 100
      })) || [];

      // Fetch Hyperliquid holders - try using the holders endpoint
      let hypeHolders = [];
      try {
        const hypeHoldersData = await fetchTokenData(`https://www.hyperscan.com/api/v2/tokens/${HYPE_CA}/holders?limit=100`);
        hypeHolders = hypeHoldersData.items?.filter(holder => 
          !EXCLUDED_ADDRESSES.has(holder.address.hash.toLowerCase())
        ).map(holder => ({
          address: holder.address.hash,
          balance: Number(BigInt(holder.value)) / Math.pow(10, DECIMALS),
          chain: 'HyperEVM',
          percentage: (Number(BigInt(holder.value)) / Math.pow(10, DECIMALS) / combinedTotalSupply) * 100
        })) || [];
      } catch (error) {
        console.warn('Could not fetch Hyperliquid holders, using empty array:', error);
        hypeHolders = [];
      }

      // Combine and sort all holders by balance
      const allHolders = [...v1Holders, ...v2Holders, ...hypeHolders];
      const top100 = allHolders
        .sort((a, b) => b.balance - a.balance)
        .slice(0, 100);

      // Use the already calculated combined total supply
      const totalSupply = combinedTotalSupply;

      // Calculate whale concentration metrics
      const totalWhaleBalance = top100.reduce((sum, holder) => sum + holder.balance, 0);
      const whaleConcentration = (totalWhaleBalance / totalSupply) * 100;

      // Group whales by concentration brackets
      const brackets = {
        '1-10%': top100.slice(0, 10),
        '11-50%': top100.slice(10, 50), 
        '51-100%': top100.slice(50, 100)
      };

      return {
        top100,
        totalWhaleBalance,
        whaleConcentration,
        brackets,
        totalSupply,
        breakdown: {
          top10: brackets['1-10%'].reduce((sum, h) => sum + h.balance, 0),
          top50: brackets['11-50%'].reduce((sum, h) => sum + h.balance, 0),
          remaining: brackets['51-100%'].reduce((sum, h) => sum + h.balance, 0)
        }
      };
    } catch (error) {
      console.error('Error fetching whale data:', error);
      throw error;
    }
  };

  const processHolderData = useCallback(async () => {
    try {
      const [v1TokenData, v1HoldersData, v2Data, v2HoldersData, hypeData] = await Promise.all([
        fetchTokenData(`https://eth.blockscout.com/api/v2/tokens/${ETH_V1_CA}`),
        fetchTokenData(`https://eth.blockscout.com/api/v2/tokens/${ETH_V1_CA}/holders`),
        fetchTokenData(`https://eth.blockscout.com/api/v2/tokens/${ETH_V2_CA}`),
        fetchTokenData(`https://eth.blockscout.com/api/v2/tokens/${ETH_V2_CA}/holders`),
        fetchTokenData(`https://www.hyperscan.com/api/v2/tokens/${HYPE_CA}`)
      ]);

      const v1Holders = calculateV1Holders(v1HoldersData, v1TokenData.total_supply || "0");
      const v2Holders = calculateV2Holders(v2HoldersData, v2Data.total_supply || "0");
      const hypeHolders = calculateHypeHolders(hypeData.total_supply || "0");

      return [
        {
          label: "V1 VDO Holders (ETH)",
          value: v1Holders,
          color: "#0088FE"
        },
        {
          label: "V2 VDO Holders (ETH)",
          value: v2Holders,
          color: "#00C49F"
        },
        {
          label: "VDO Holders (HyperEVM)",
          value: hypeHolders,
          color: "#FFBB28"
        }
      ];
    } catch (error) {
      console.error('Error processing holder data:', error);
      throw error;
    }
  }, []);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        const holderData = await processHolderData();
        setData(holderData);
      } catch (err) {
        console.error("Error loading holders", err);
        setError("Failed to load holder data");
      }
      setLoading(false);
    };

    loadData();
  }, [processHolderData]);

  // Separate useEffect for whale data
  useEffect(() => {
    const loadWhaleData = async () => {
      setWhaleLoading(true);
      try {
        const whaleInfo = await fetchTop100Holders();
        
        // Store previous concentration for comparison - do this in a separate state update
        setWhaleData(prevWhaleData => {
          if (prevWhaleData) {
            setPreviousWhaleConcentration(prevWhaleData.whaleConcentration);
          }
          return whaleInfo;
        });
      } catch (err) {
        console.error("Error loading whale data", err);
      }
      setWhaleLoading(false);
    };

    loadWhaleData();
    
    // Set up interval to refresh whale data every 5 minutes
    const interval = setInterval(loadWhaleData, 300000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array to run once on mount - fetchTop100Holders is stable

  const chainColors = {
    v1: '#5E5854',
    v2: '#32145F', 
    hyperliquid: '#274E40'
  };

  const chartData = {
    labels: data.map(item => item.label),
    datasets: [
      {
        data: data.map(item => item.value),
        backgroundColor: [
          chainColors.v1,
          chainColors.v2,
          chainColors.hyperliquid
        ],
        borderWidth: 0,
        borderColor: 'transparent'
      }
    ]
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
      legend: {
        position: 'top',
        labels: {
          padding: 20,
          usePointStyle: true,
          color: '#333',
          font: {
            size: 12
          }
        }
      },
      tooltip: {
        callbacks: {
          label: function(context) {
            const value = context.parsed;
            const total = context.dataset.data.reduce((a, b) => a + b, 0);
            const percentage = ((value / total) * 100).toFixed(1);
            return `${context.label}: ${Number(value).toLocaleString(undefined, { maximumFractionDigits: 0 })} VDO (${percentage}%)`;
          }
        }
      }
    }
  };

  if (loading) {
    return (
      <div className="app-container">
        <div className="main-content vdo-page">
          <div className="vdo-container">
            {/* Token Distribution Loading Panel */}
            <div className="data-box">
              <h3>VDO Token Distribution</h3>
              <div className="vdo-loading">Loading holder data...</div>
            </div>
            
            {/* ValiWhales Loading Panel */}
            <div className="data-box">
              <div className="whale-header">
                <h3>ValiWhale Tracker</h3>
              </div>
              <div className="vdo-loading">Loading whale data...</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="app-container">
        <div className="main-content vdo-page">
          <div className="vdo-container">
            {/* Token Distribution Error Panel */}
            <div className="data-box">
              <h3>VDO Token Distribution</h3>
              <div className="vdo-error">{error}</div>
            </div>
            
            {/* ValiWhales Error Panel */}
            <div className="data-box">
              <div className="whale-header">
                <h3>ValiWhales</h3>
              </div>
              <div className="vdo-error">Unable to load whale data</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const totalSupply = data.reduce((sum, item) => sum + item.value, 0);

  const getAccumulationTrend = () => {
    if (!whaleData || previousWhaleConcentration === null) return null;
    
    const currentConcentration = whaleData.whaleConcentration;
    const diff = currentConcentration - previousWhaleConcentration;
    
    if (Math.abs(diff) < 0.1) return { trend: 'stable', change: diff };
    return { 
      trend: diff > 0 ? 'accumulating' : 'distributing', 
      change: diff 
    };
  };


  const renderWhaleConcentration = () => {
    return (
      <div className="data-box">
        <div className="whale-header">
          <h3>ValiWhale Tracker</h3>
        </div>
        
        {whaleLoading && !whaleData && (
          <div className="vdo-loading">Loading whale data...</div>
        )}
        
        {whaleData && (
          <>
            <div className="whale-stats">
              <div className="stat-item">
                <span className="stat-label">Top 100 Holders Control:</span>
                <span className="stat-value">{whaleData.whaleConcentration.toFixed(2)}% of total supply</span>
                {(() => {
                  const trend = getAccumulationTrend();
                  return trend && trend.trend !== 'stable' && (
                    <span className={`trend-indicator ${trend.trend}`}>
                      {trend.trend === 'accumulating' && '📈 Accumulating'}
                      {trend.trend === 'distributing' && '📉 Distributing'}
                      {trend.change !== 0 && ` (${trend.change > 0 ? '+' : ''}${trend.change.toFixed(2)}%)`}
                    </span>
                  );
                })()}
              </div>
            </div>
            
            <div className="whale-breakdown">
              <div className="breakdown-section">
                <h4>Whale Distribution</h4>
                <div className="whale-tier">
                  <div className="tier-header">
                    <span className="tier-label">Top 10 Holders</span>
                    <span className="tier-value">
                      {whaleData.breakdown.top10.toLocaleString()} VDO ({((whaleData.breakdown.top10 / whaleData.totalSupply) * 100).toFixed(1)}%)
                    </span>
                  </div>
                </div>
                <div className="whale-tier">
                  <div className="tier-header">
                    <span className="tier-label">Next 40 Holders (11-50)</span>
                    <span className="tier-value">
                      {whaleData.breakdown.top50.toLocaleString()} VDO ({((whaleData.breakdown.top50 / whaleData.totalSupply) * 100).toFixed(1)}%)
                    </span>
                  </div>
                </div>
                <div className="whale-tier">
                  <div className="tier-header">
                    <span className="tier-label">Remaining 50 (51-100)</span>
                    <span className="tier-value">
                      {whaleData.breakdown.remaining.toLocaleString()} VDO ({((whaleData.breakdown.remaining / whaleData.totalSupply) * 100).toFixed(1)}%)
                    </span>
                  </div>
                </div>
              </div>

              <div className="top-whales">
                <h4>Top 100 Holders</h4>
                <div className="whale-list">
                  {whaleData.top100.map((whale, index) => (
                    <div key={whale.address} className="whale-item">
                      <span className="whale-rank">#{index + 1}</span>
                      <span className="whale-address">
                        {whale.address.slice(0, 6)}...{whale.address.slice(-4)}
                      </span>
                      <span className="whale-chain">{whale.chain}</span>
                      <span className="whale-balance">
                        {whale.balance.toLocaleString()} VDO
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="app-container">
      <div className="main-content vdo-page">
        <div className="vdo-container">
          {/* Token Distribution Section */}
          <div className="data-box">
            <h3>VDO Token Migration Distribution</h3>
            <div className="vdo-stats">
              <div className="stat-item">
                <span className="stat-label">Total Supply:</span>
                <span className="stat-value">{totalSupply.toLocaleString()} VDO</span>
              </div>
            </div>
            <div className="chart-container">
              <Pie data={chartData} options={chartOptions} />
            </div>
            <div className="vdo-breakdown">
              {data.map((item, index) => (
                <div key={index} className="breakdown-item">
                  <div 
                    className="breakdown-color" 
                    style={{ backgroundColor: Object.values(chainColors)[index] }}
                  ></div>
                  <div className="breakdown-info">
                    <span className="breakdown-label">{item.label}</span>
                    <span className="breakdown-value">
                      {item.value.toLocaleString()} VDO ({((item.value / totalSupply) * 100).toFixed(1)}%)
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          {/* Whale Monitor Section */}
          {renderWhaleConcentration()}
        </div>
      </div>
    </div>
  );
};

export default VDO;