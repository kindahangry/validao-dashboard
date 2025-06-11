import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import ValiDashTitle from './ValiDashTitle';
import './Sidebar.css';

const Sidebar = () => {
  const location = useLocation();

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <ValiDashTitle />
      </div>
      <nav className="sidebar-nav">
        <Link to="/" className={`nav-link ${location.pathname === '/' ? 'active' : ''}`}>
          Overview
        </Link>
        <div className="nav-section">
          <h3 className="nav-section-title">Chains</h3>
          <Link to="/hyperliquid" className={`nav-link ${location.pathname === '/hyperliquid' ? 'active' : ''}`}>
            Hyperliquid
          </Link>
          <Link to="/celestia" className={`nav-link ${location.pathname === '/celestia' ? 'active' : ''}`}>
            Celestia
          </Link>
          <Link to="/dymension" className={`nav-link ${location.pathname === '/dymension' ? 'active' : ''}`}>
            Dymension
          </Link>
          <Link to="/initia" className={`nav-link ${location.pathname === '/initia' ? 'active' : ''}`}>
            Initia
          </Link>
        </div>
        <div className="nav-section">
          <h3 className="nav-section-title">Information</h3>
          <Link to="/treasury" className={`nav-link ${location.pathname === '/treasury' ? 'active' : ''}`}>
            Treasury (Soon)
          </Link>
          <Link to="/revenue" className={`nav-link ${location.pathname === '/revenue' ? 'active' : ''}`}>
            Revenue
          </Link>
        </div>
      </nav>
    </div>
  );
};

export default Sidebar; 