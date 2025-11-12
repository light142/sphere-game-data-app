/**
 * Authentication Context
 * Manages authentication state and provides auth methods throughout the app
 */

import { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../services/api';
import config from '../config';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check for existing auth on mount
  useEffect(() => {
    const storedToken = localStorage.getItem(config.auth.tokenStorageKey);
    const storedUser = localStorage.getItem(config.auth.userStorageKey);

    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
    }
    setLoading(false);
  }, []);

  // Helper function to extract error message from Django REST Framework response
  const extractErrorMessage = (error) => {
    const errorData = error.response?.data;
    
    if (!errorData) {
      return error.message || 'An unexpected error occurred. Please try again.';
    }

    // Handle Django REST Framework error format
    // Format: {"non_field_errors": ["User not found"]}
    if (errorData.non_field_errors && Array.isArray(errorData.non_field_errors)) {
      return errorData.non_field_errors[0] || 'Login failed. Please check your credentials.';
    }

    // Handle field-specific errors
    // Format: {"username": ["error"], "password": ["error"]}
    const fieldErrors = Object.keys(errorData)
      .filter(key => Array.isArray(errorData[key]) && errorData[key].length > 0)
      .map(key => `${key}: ${errorData[key][0]}`)
      .join(', ');
    
    if (fieldErrors) {
      return fieldErrors;
    }

    // Handle simple error message
    if (errorData.error) {
      return errorData.error;
    }

    if (errorData.message) {
      return errorData.message;
    }

    // Fallback
    return 'Login failed. Please check your credentials and try again.';
  };

  const login = async (username, password) => {
    try {
      console.log('AuthContext: Starting login for user:', username);
      const response = await authAPI.login(username, password);
      console.log('AuthContext: Login response received:', response);
      
      const { token: authToken } = response;
      
      if (!authToken) {
        console.error('AuthContext: No token in response:', response);
        return {
          success: false,
          error: 'Login failed: No token received from server.',
        };
      }

      const userData = { username };
      localStorage.setItem(config.auth.tokenStorageKey, authToken);
      localStorage.setItem(config.auth.userStorageKey, JSON.stringify(userData));

      setToken(authToken);
      setUser(userData);

      console.log('AuthContext: Login successful, token stored');
      return { success: true };
    } catch (error) {
      console.error('AuthContext: Login error:', error);
      const errorMessage = extractErrorMessage(error);
      
      return {
        success: false,
        error: errorMessage,
      };
    }
  };

  const logout = async () => {
    try {
      if (token) {
        await authAPI.logout();
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem(config.auth.tokenStorageKey);
      localStorage.removeItem(config.auth.userStorageKey);
      setToken(null);
      setUser(null);
    }
  };

  const value = {
    user,
    token,
    loading,
    login,
    logout,
    isAuthenticated: !!token,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

