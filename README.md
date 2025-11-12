# Sphere Game Data Dashboard

A React application for viewing and analyzing game data from the Sphere Game Data API.

## Features

- **Admin Login**: Secure authentication using admin credentials seeded from the API
- **Dashboard**: Summary statistics including total events, players, sessions, and games
- **Players List**: View all players grouped by player_id with statistics
- **Player Details**: Drill down into individual player data
- **Session Details**: View sessions with collapsible game lists
- **Game Details**: Comprehensive game information with event history

## Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- Running instance of sphere-game-data-api

## Installation

1. Install dependencies:
```bash
npm install
```

2. Configure API endpoint (optional):
   - Create a `.env` file in the root directory
   - Add: `REACT_APP_API_BASE_URL=http://localhost:8000`
   - Default is `http://localhost:8000` if not specified

## Running the Application

Start the development server:
```bash
npm start
```

The application will open at `http://localhost:3000`

## Building for Production

Create a production build:
```bash
npm run build
```

The build folder will contain the optimized production build.

## Project Structure

```
sphere-game-data-app/
├── public/
│   └── index.html
├── src/
│   ├── components/          # Reusable components
│   │   ├── ProtectedRoute.jsx
│   │   ├── PlayerDetail.jsx
│   │   ├── SessionDetail.jsx
│   │   └── GameDetail.jsx
│   ├── contexts/            # React contexts
│   │   └── AuthContext.jsx
│   ├── pages/               # Page components
│   │   ├── Login.jsx
│   │   ├── Dashboard.jsx
│   │   └── PlayersList.jsx
│   ├── services/            # API service layer
│   │   └── api.js
│   ├── styles/              # Component styles
│   │   ├── Login.css
│   │   ├── Dashboard.css
│   │   ├── PlayersList.css
│   │   ├── PlayerDetail.css
│   │   ├── SessionDetail.css
│   │   └── GameDetail.css
│   ├── config/              # Configuration
│   │   └── index.js
│   ├── App.js
│   ├── App.css
│   ├── index.js
│   └── index.css
├── package.json
└── README.md
```

## Configuration

All application configuration is centralized in `src/config/index.js`:
- API endpoints
- Authentication settings
- UI theme colors
- Application settings

## API Integration

The application uses a centralized API service layer (`src/services/api.js`) that:
- Handles authentication tokens automatically
- Provides interceptors for request/response handling
- Centralizes all API calls
- Handles errors and redirects to login on 401 errors

## Authentication

- Login uses admin credentials seeded from the API
- Tokens are stored in localStorage
- Protected routes automatically redirect to login if not authenticated
- Logout clears tokens and redirects to login

## Default Admin Credentials

- Username: `admin`
- Password: `P@ssw0rd!123`

(These are seeded by the `seed_admin` management command in the API)

## Available Scripts

- `npm start` - Start development server
- `npm run build` - Build for production
- `npm test` - Run tests
- `npm run eject` - Eject from Create React App (irreversible)

## Technologies Used

- React 18.2
- React Router DOM 6.20
- Axios 1.6.2
- Create React App 5.0.1

