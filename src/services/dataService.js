/**
 * Data Service
 * Handles loading game data from different sources (API, JSON file, or combined)
 */

import { gameDataAPI } from './api';
import config from '../config';

/**
 * Load data from JSON file
 */
const loadFromJSON = async () => {
  try {
    const response = await fetch(config.dataSource.jsonFilePath);
    if (!response.ok) {
      throw new Error(`Failed to load JSON file: ${response.statusText}`);
    }
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error('Error loading JSON data:', error);
    throw error;
  }
};

/**
 * Load data from API
 */
const loadFromAPI = async () => {
  try {
    const data = await gameDataAPI.getAll();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error('Error loading API data:', error);
    throw error;
  }
};

/**
 * Combine data from multiple sources
 * Simply concatenates all data sources without any filtering, deduplication, or sorting
 */
const combineData = (dataArrays) => {
  // Simply flatten and combine all arrays
  return dataArrays.flat();
};

/**
 * Main data service function
 * Loads data based on configured data source mode
 */
export const loadGameData = async (isAuthenticated = false) => {
  const { mode } = config.dataSource;
  
  try {
    switch (mode) {
      case 'json':
        // Load only from JSON file (no authentication required)
        console.log('Loading data from JSON file...');
        return await loadFromJSON();
        
      case 'api':
        // Load only from API (requires authentication)
        if (!isAuthenticated) {
          console.warn('API mode requires authentication');
          return [];
        }
        console.log('Loading data from API...');
        return await loadFromAPI();
        
      case 'combined':
        // Load from both sources and combine
        console.log('Loading data from both API and JSON...');
        const promises = [];
        
        // Always try to load JSON (no auth required)
        promises.push(loadFromJSON().catch(err => {
          console.warn('Failed to load JSON data:', err);
          return [];
        }));
        
        // Only load from API if authenticated
        if (isAuthenticated) {
          promises.push(loadFromAPI().catch(err => {
            console.warn('Failed to load API data:', err);
            return [];
          }));
        }
        
        const results = await Promise.all(promises);
        const combined = combineData(results);
        console.log(`Combined ${combined.length} total events from all sources`);
        return combined;
        
      default:
        console.warn(`Unknown data source mode: ${mode}, falling back to JSON`);
        return await loadFromJSON();
    }
  } catch (error) {
    console.error('Error loading game data:', error);
    throw error;
  }
};

export default {
  loadGameData,
  loadFromJSON,
  loadFromAPI,
  combineData,
};

