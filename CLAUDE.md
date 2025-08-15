# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a ValiDAO Dashboard - a React-based web application for monitoring validator operations across multiple blockchain chains (Hyperliquid, Celestia, Dymension, and Initia). The dashboard displays real-time metrics including stake amounts, delegator counts, and revenue calculations.

## Development Commands

- `npm run dev` - Start development server with Vite
- `npm run build` - Build for production
- `npm run lint` - Run ESLint for code quality checks
- `npm run preview` - Preview production build locally

## Architecture

### Frontend Stack
- **React 19** with Vite as build tool
- **React Router DOM** for client-side routing
- **Chart.js** with react-chartjs-2 for data visualization
- **Supabase** for backend data storage and real-time updates
- **Vercel Analytics** for usage tracking

### Data Flow
1. Historical metrics are stored in Supabase `historical_metrics` table
2. Data is fetched in App.jsx and processed for chain-specific calculations
3. Revenue calculations use chain-specific commission rates and APR values from `chainConfig`
4. Charts are rendered with dynamic timeframe filtering (1w, 1m, 1y, max)

### Key Components
- `App.jsx` - Main application logic, data fetching, and routing
- `Overview.jsx` - Landing page with aggregated metrics across all chains
- `Sidebar.jsx` - Navigation component
- `StatCard.jsx` - Reusable metric display component
- Chain-specific pages render via route parameters (`/hyperliquid`, `/celestia`, etc.)

### Database Schema
- `historical_metrics` table stores time-series data with fields: timestamp, chain, metric_type, value, value_usd, apr
- `validao-overview` table stores aggregated overview data

### Chain Configuration
Each supported chain has specific configuration in `chainConfig` object:
- Commission rates (used for revenue calculations)
- Default APR values (fallback when real APR unavailable)
- Special handling for Initia chain with separate native and LP staking

### Environment Variables
Required environment variables in `.env.development.local`:
- `VITE_SUPABASE_URL` - Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Supabase anonymous key

### Deployment
- Configured for Vercel deployment with rewrites in `vercel.json`
- Includes Supabase Edge Functions in `/supabase/functions/` directory

### Asset Optimization
- Background images stored in both original and WebP optimized formats
- Responsive image loading implemented in Background component