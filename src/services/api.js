/**
 * API Service Layer
 * Centralized API calls with authentication handling
 */

import axios from 'axios';
import config from '../config';

// Create axios instance with default configuration
const apiClient = axios.create({
  baseURL: config.api.baseURL,
  timeout: config.api.timeout,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
apiClient.interceptors.request.use(
  (axiosConfig) => {
    const token = localStorage.getItem(config.auth.tokenStorageKey);
    if (token) {
      axiosConfig.headers.Authorization = `Token ${token}`;
    }
    return axiosConfig;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Unauthorized - clear auth and redirect to login
      localStorage.removeItem(config.auth.tokenStorageKey);
      localStorage.removeItem(config.auth.userStorageKey);
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

/**
 * Authentication API
 */
export const authAPI = {
  login: async (username, password) => {
    try {
      console.log('Attempting login to:', config.api.baseURL + config.api.endpoints.login);
      const response = await apiClient.post(config.api.endpoints.login, {
        username,
        password,
      });
      console.log('Login response:', response.data);
      return response.data;
    } catch (error) {
      console.error('Login API error:', error);
      console.error('Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        url: error.config?.url,
      });
      throw error;
    }
  },

  logout: async () => {
    try {
      const response = await apiClient.post(config.api.endpoints.logout);
      return response.data;
    } catch (error) {
      console.error('Logout API error:', error);
      throw error;
    }
  },
};

/**
 * Game Data API
 */
export const gameDataAPI = {
  // Get all game data
  getAll: async (params = {}) => {
    const response = await apiClient.get(config.api.endpoints.gameData, {
      params,
    });
    return response.data;
  },

  // Get single game data by ID
  getById: async (id) => {
    const response = await apiClient.get(config.api.endpoints.gameDataDetail(id));
    return response.data;
  },

  // Create new game data
  create: async (data) => {
    const response = await apiClient.post(config.api.endpoints.gameData, data);
    return response.data;
  },

  // Update game data
  update: async (id, data) => {
    const response = await apiClient.put(
      config.api.endpoints.gameDataDetail(id),
      data
    );
    return response.data;
  },

  // Delete game data
  delete: async (id) => {
    const response = await apiClient.delete(
      config.api.endpoints.gameDataDetail(id)
    );
    return response.data;
  },
};

export default apiClient;

