import React, { useState, useEffect } from 'react';
import { Chart as ChartJS } from "chart.js/auto";
import { Bar, Doughnut, Line } from "react-chartjs-2";

function App() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  // Dummy data for the charts
  const aprData = {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
    datasets: [{
      label: 'APR Trend',
      data: [12.5, 12.8, 13.2, 13.0, 12.9, 13.1],
      borderColor: 'rgb(75, 192, 192)',
      tension: 0.1
    }]
  };

  const stakeData = {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
    datasets: [{
      label: 'Total Stake (M)',
      data: [45, 48, 52, 55, 58, 90],
      borderColor: 'rgb(255, 99, 132)',
      tension: 0.1
    }]
  };

  const delegatorData = {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
    datasets: [{
      label: 'Delegator Count',
      data: [1200, 1300, 1400, 1500, 1600, 1700],
      borderColor: 'rgb(54, 162, 235)',
      tension: 0.1
    }]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
      },
    },
    scales: {
      y: {
        beginAtZero: true
      }
    }
  };

  useEffect(() => {
    async function loadData() {
      try {
        const proxyUrl = 'https://api.allorigins.win/raw?url=';
        const targetUrl = 'https://api.validao.xyz/api/v1/overview/chain/hyperliquid';
        
        const response = await fetch(proxyUrl + encodeURIComponent(targetUrl));
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        setData(data);
      } catch (err) {
        console.error('Failed to fetch data:', err);
        setError(err.message);
      }
    }

    loadData();
  }, []);

  if (error) {
    return <div className="error">Error loading data: {error}</div>;
  }

  if (!data) {
    return <div className="loading">Loading...</div>;
  }

  const formattedStake = (data.total_stake / 100000000).toLocaleString(undefined, {
    maximumFractionDigits: 2,
  });

  return (
    <div className="dashboard">
      <div className="container">
        <div className="data-box">
          <p>Total Stake: {formattedStake} {data.ticker}</p>
        </div>
        <div className="data-box">
          <p>Stake (USD): ${data.total_stake_usd.toFixed(2).toLocaleString()}</p>
        </div>
        <div className="data-box">
          <p>Delegators: {data.delegator_count.toLocaleString()}</p>
        </div>
      </div>
      
      <div className="container">
        <div className="data-box">
          <div className="chart-container">
            <Line data={aprData} options={chartOptions} />
          </div>
        </div>
        <div className="data-box">
          <div className="chart-container">
            <Line data={stakeData} options={chartOptions} />
          </div>
        </div>
        <div className="data-box">
          <div className="chart-container">
            <Line data={delegatorData} options={chartOptions} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
