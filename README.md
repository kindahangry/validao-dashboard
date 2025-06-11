# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react/README.md) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript and enable type-aware lint rules. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

# ValiDAO Dashboard

A comprehensive dashboard for monitoring ValiDAO's validator operations across multiple chains including Hyperliquid, Celestia, Dymension, and Initia.

## Features

- Real-time monitoring of validator performance
- Chain-specific metrics including:
  - Total Value Locked (TVL)
  - Delegator counts
  - Annual Revenue
  - APR rates
- Historical data visualization with interactive charts
- Revenue tracking and analysis
- Responsive design for all devices

## Tech Stack

- React + Vite
- Chart.js for data visualization
- Supabase for backend and data storage
- CSS for styling

## Getting Started

1. Clone the repository:
```bash
git clone https://github.com/yourusername/validao-dashboard.git
cd validao-dashboard
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env.development.local` file in the root directory with your Supabase credentials:
```
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

4. Start the development server:
```bash
npm run dev
```

## Environment Variables

The following environment variables are required:

- `VITE_SUPABASE_URL`: Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY`: Your Supabase anonymous key

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.
