/**
 * Game Data Context
 * Manages game data state globally and provides data to all pages
 */

import { createContext, useContext, useState, useEffect } from 'react';
import { gameDataAPI } from '../services/api';
import config from '../config';

const GameDataContext = createContext(null);

export const GameDataProvider = ({ children }) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchData = async () => {
    // Only fetch if user is authenticated
    const token = localStorage.getItem(config.auth.tokenStorageKey);
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError('');
      const gameData = await gameDataAPI.getAll();
      setData(gameData);
    } catch (err) {
      // Don't set error if it's a 401 (user not authenticated)
      if (err.response?.status !== 401) {
        setError('Failed to load game data');
        console.error('Game data fetch error:', err);
      }
    } finally {
      setLoading(false);
    }
  };

  // Fetch data once on mount, but only if authenticated
  useEffect(() => {
    fetchData();
  }, []);

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

