/**
 * Data Page
 * Displays all game data in a table with pagination
 */

import { useState, useMemo } from 'react';
import { useGameData } from '../contexts/GameDataContext';
import LoadingSpinner from '../components/LoadingSpinner';
import PageHeader from '../components/PageHeader';
import '../styles/Data.css';

// Define the column order based on model fields
const columnOrder = [
  'id',
  'created_at',
  'event_at',
  'event_type',
  'event_category',
  'ip_address',
  'player_id',
  'session_id',
  'game_reference',
  'game_level',
  'game_mode',
  'game_color',
  'correct_game_color',
  'game_sequence',
  'game_player_input',
  'retry_count',
  'error_messages',
];

const Data = () => {
  const { data, loading, error } = useGameData();
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [sortColumn, setSortColumn] = useState('event_at');
  const [sortDirection, setSortDirection] = useState('asc');
  const [filters, setFilters] = useState({});
  const [showFilters, setShowFilters] = useState(false);
  const [globalSearch, setGlobalSearch] = useState('');

  // Apply global search and column filters to data
  const filteredData = useMemo(() => {
    if (!data || data.length === 0) return [];
    return data.filter((item) => {
      // Global search - search across all columns
      if (globalSearch && globalSearch.trim() !== '') {
        const searchStr = globalSearch.toLowerCase();
        const matchesGlobalSearch = Object.values(item).some((value) => {
          if (value === null || value === undefined) return false;
          return String(value).toLowerCase().includes(searchStr);
        });
        if (!matchesGlobalSearch) return false;
      }

      // Column filters
      return Object.keys(filters).every((key) => {
        const filterValue = filters[key];
        if (!filterValue || filterValue.trim() === '') return true;
        
        const itemValue = item[key];
        if (itemValue === null || itemValue === undefined) return false;
        
        const itemStr = String(itemValue).toLowerCase();
        const filterStr = filterValue.toLowerCase();
        return itemStr.includes(filterStr);
      });
    });
  }, [data, filters, globalSearch]);

  // Sort filtered data
  const sortedData = useMemo(() => {
    if (!filteredData || filteredData.length === 0) return [];
    return [...filteredData].sort((a, b) => {
      let valueA = a[sortColumn];
      let valueB = b[sortColumn];
      
      // Handle null/undefined values
      if (valueA === null || valueA === undefined) valueA = '';
      if (valueB === null || valueB === undefined) valueB = '';
      
      // Handle dates
      if (sortColumn.includes('_at') || sortColumn === 'created_at' || sortColumn === 'event_at') {
        const dateA = valueA ? new Date(valueA).getTime() : 0;
        const dateB = valueB ? new Date(valueB).getTime() : 0;
        return sortDirection === 'asc' ? dateA - dateB : dateB - dateA;
      }
      
      // Handle numbers
      if (typeof valueA === 'number' && typeof valueB === 'number') {
        return sortDirection === 'asc' ? valueA - valueB : valueB - valueA;
      }
      
      // Handle strings
      const strA = String(valueA).toLowerCase();
      const strB = String(valueB).toLowerCase();
      if (sortDirection === 'asc') {
        return strA.localeCompare(strB);
      } else {
        return strB.localeCompare(strA);
      }
    });
  }, [filteredData, sortColumn, sortDirection]);

  // Calculate pagination
  const paginatedData = useMemo(() => {
    if (!sortedData || sortedData.length === 0) return [];
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return sortedData.slice(startIndex, endIndex);
  }, [sortedData, currentPage, itemsPerPage]);

  const totalPages = Math.ceil((sortedData?.length || 0) / itemsPerPage);

  // Get all unique keys from the data and sort them according to columnOrder
  const allKeys = useMemo(() => {
    if (!sortedData || sortedData.length === 0) return [];
    const keysSet = new Set();
    sortedData.forEach((item) => {
      Object.keys(item).forEach((key) => keysSet.add(key));
    });
    
    // Sort keys: first ordered columns, then any additional fields alphabetically
    const orderedKeys = [];
    const additionalKeys = [];
    
    columnOrder.forEach((key) => {
      if (keysSet.has(key)) {
        orderedKeys.push(key);
        keysSet.delete(key);
      }
    });
    
    // Add any remaining keys that aren't in the column order
    Array.from(keysSet).sort().forEach((key) => {
      additionalKeys.push(key);
    });
    
    return [...orderedKeys, ...additionalKeys];
  }, [sortedData]);

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleItemsPerPageChange = (e) => {
    setItemsPerPage(Number(e.target.value));
    setCurrentPage(1);
  };

  const handleSort = (column) => {
    if (sortColumn === column) {
      // Toggle direction if same column
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // New column, default to ascending
      setSortColumn(column);
      setSortDirection('asc');
    }
    setCurrentPage(1);
  };

  const handleFilterChange = (column, value) => {
    setFilters((prev) => {
      const newFilters = { ...prev };
      if (value && value.trim() !== '') {
        newFilters[column] = value;
      } else {
        delete newFilters[column];
      }
      return newFilters;
    });
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setFilters({});
    setGlobalSearch('');
    setCurrentPage(1);
  };

  const handleGlobalSearchChange = (value) => {
    setGlobalSearch(value);
    setCurrentPage(1);
  };

  const formatValue = (value) => {
    if (value === null || value === undefined) return 'N/A';
    if (typeof value === 'boolean') return value ? 'True' : 'False';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value).trim();
  };

  const getSortIcon = (column) => {
    if (sortColumn !== column) return '⇅';
    return sortDirection === 'asc' ? '↑' : '↓';
  };

  if (loading) {
    return (
      <div className="data-container">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="data-container">
        <PageHeader title="Data" />
        <div className="error">{error}</div>
      </div>
    );
  }

  return (
    <div className="data-container">
      <PageHeader title="Data" subtitle={`Total records: ${sortedData?.length || 0}`} />

      <div className="data-controls">
        <div className="search-controls">
          <div className="global-search-container">
            <input
              type="text"
              className="global-search-input"
              placeholder="Search across all columns..."
              value={globalSearch}
              onChange={(e) => handleGlobalSearchChange(e.target.value)}
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`toggle-filters-button ${showFilters ? 'active' : ''}`}
            title={showFilters ? 'Hide column filters' : 'Show column filters'}
          >
            {showFilters ? '▼' : '▶'} Filters
          </button>
        </div>
        <div className="items-per-page-control">
          <label htmlFor="items-per-page">Items per page:</label>
          <select
            id="items-per-page"
            value={itemsPerPage}
            onChange={handleItemsPerPageChange}
            className="items-per-page-select"
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={200}>200</option>
          </select>
        </div>
        <div className="pagination-info">
          Showing {sortedData?.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0} -{' '}
          {Math.min(currentPage * itemsPerPage, sortedData?.length || 0)} of {sortedData?.length || 0} records
          {(Object.keys(filters).length > 0 || globalSearch) && (
            <span className="filter-indicator"> (filtered)</span>
          )}
        </div>
        {(Object.keys(filters).length > 0 || globalSearch) && (
          <button onClick={clearFilters} className="clear-filters-button">
            Clear All
          </button>
        )}
      </div>

      <div className="data-table-container">
        <div className="data-table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                {allKeys.map((key) => (
                  <th key={key} className="data-table-header">
                    <div className="header-content">
                      <div className="header-title-row">
                        <button
                          className="sort-button"
                          onClick={() => handleSort(key)}
                          title={`Sort by ${key.replace(/_/g, ' ')}`}
                        >
                          <span className="header-title">
                            {key.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                          </span>
                          <span className={`sort-icon ${sortColumn === key ? 'active' : ''}`}>
                            {getSortIcon(key)}
                          </span>
                        </button>
                      </div>
                      {showFilters && (
                        <div className="header-filter-row">
                          <input
                            type="text"
                            className="column-filter"
                            placeholder="Filter..."
                            value={filters[key] || ''}
                            onChange={(e) => handleFilterChange(key, e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={allKeys.length} className="empty-state">
                    No data available
                  </td>
                </tr>
              ) : (
                paginatedData.map((item, index) => (
                  <tr key={`${item.id || index}-${currentPage}`} className="data-table-row">
                    {allKeys.map((key) => (
                      <td key={key} className="data-table-cell">{formatValue(item[key])}</td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="pagination">
          <button
            className="pagination-button"
            onClick={() => handlePageChange(1)}
            disabled={currentPage === 1}
            aria-label="First page"
          >
            ««
          </button>
          <button
            className="pagination-button"
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
            aria-label="Previous page"
          >
            ‹
          </button>
          <div className="pagination-page-info">
            Page {currentPage} of {totalPages}
          </div>
          <button
            className="pagination-button"
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            aria-label="Next page"
          >
            ›
          </button>
          <button
            className="pagination-button"
            onClick={() => handlePageChange(totalPages)}
            disabled={currentPage === totalPages}
            aria-label="Last page"
          >
            »»
          </button>
        </div>
      )}
    </div>
  );
};

export default Data;

