/**
 * Game Data Context
 * Manages game data state globally and provides data to all pages
 */

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { gameDataAPI } from '../services/api';
import { useAuth } from './AuthContext';

const GameDataContext = createContext(null);

export const GameDataProvider = ({ children }) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { isAuthenticated, loading: authLoading } = useAuth();

  const fetchData = useCallback(async () => {
    // Only fetch if user is authenticated
    if (!isAuthenticated) {
      setLoading(false);
      setData([]);
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
  }, [isAuthenticated]);

  // Fetch data when authentication state changes
  useEffect(() => {
    // Wait for auth to finish loading before fetching
    if (!authLoading) {
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

