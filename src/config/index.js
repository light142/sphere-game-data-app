/**
 * Application Configuration
 * All app-wide settings and API endpoints are consolidated here
 */

const config = {
  // API Configuration
  api: {
    baseURL: 'https://sphere-game-data-api.vercel.app',
    endpoints: {
      login: '/api/login/',
      logout: '/api/logout/',
      gameData: '/api/game-data/',
      gameDataDetail: (id) => `/api/game-data/${id}/`,
    },
    timeout: 30000, // 30 seconds
  },

  // Authentication Configuration
  auth: {
    tokenStorageKey: 'sphere_game_auth_token',
    userStorageKey: 'sphere_game_user',
  },

  // Application Settings
  app: {
    name: 'Sphere Game Data Dashboard',
    version: '1.0.0',
    defaultPageSize: 50,
  },

  // UI Configuration - AIS Color Scheme (Red, White, Black, Gold)
  ui: {
    theme: {
      primaryRed: '#C41E3A',      // Vibrant red - primary brand color
      darkRed: '#B91C1C',         // Darker red for hover states
      lightRed: '#FEE2E2',        // Light red for backgrounds
      black: '#1A1A1A',            // Main text color
      white: '#FFFFFF',            // Background and text on dark
      gold: '#D4AF37',             // Elegant gold for accents
      lightGold: '#FEF3C7',        // Light gold for highlights
      gray: '#F5F5F5',             // Subtle backgrounds
      darkGray: '#6B7280',         // Secondary text
    },
  },
};

export default config;

/**
 * Maps game mode to category (2D or AR)
 * @param {string} gameMode - The game mode string
 * @returns {string|null} - Returns '2D', 'AR', or null if unknown
 */
export const mapGameModeToCategory = (gameMode) => {
  if (!gameMode) return null;
  
  const mode = gameMode.toLowerCase().trim();
  
  // Check for AR modes
  if (mode.includes('ar') || mode === 'modear' || mode === 'ar') {
    return 'AR';
  }
  
  // Check for 2D modes
  if (mode.includes('2d') || mode === 'mode2d' || mode === '2d') {
    return '2D';
  }
  
  // Default to null if unknown
  return null;
};

