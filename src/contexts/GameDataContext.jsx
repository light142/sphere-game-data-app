/**
 * Game Data Context
 * Manages game data state globally and provides data to all pages
 */

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { loadGameData } from '../services/dataService';
import config from '../config';
import { useAuth } from './AuthContext';

const GameDataContext = createContext(null);

export const GameDataProvider = ({ children }) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { isAuthenticated, loading: authLoading } = useAuth();

  const fetchData = useCallback(async () => {
    // For API mode, require authentication
    // For JSON or combined mode, authentication is optional
    if (config.dataSource.mode === 'api' && !isAuthenticated) {
      setLoading(false);
      setData([]);
      return;
    }

    try {
      setLoading(true);
      setError('');
      const gameData = await loadGameData(isAuthenticated);
      setData(gameData);
    } catch (err) {
      // Don't set error if it's a 401 (user not authenticated) and we're in API mode
      if (config.dataSource.mode === 'api' && err.response?.status === 401) {
        // Authentication required for API mode
        setError('');
        setData([]);
      } else {
        setError('Failed to load game data');
        console.error('Game data fetch error:', err);
      }
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  // Fetch data when authentication state changes
  useEffect(() => {
    // For JSON mode, fetch immediately (no auth needed)
    // For API mode, wait for auth to finish loading
    if (config.dataSource.mode === 'json') {
      fetchData();
    } else if (!authLoading) {
      fetchData();
    }
  }, [isAuthenticated, authLoading, fetchData]);

  const refreshData = async () => {
    await fetchData();
  };

  const value = {
    data,
    loading,
    error,
    refreshData,
  };

  return <GameDataContext.Provider value={value}>{children}</GameDataContext.Provider>;
};

export const useGameData = () => {
  const context = useContext(GameDataContext);
  if (!context) {
    throw new Error('useGameData must be used within a GameDataProvider');
  }
  return context;
};

