/**
 * Page Header Component
 * Header with page title and refresh data button
 */

import { useGameData } from '../contexts/GameDataContext';
import LoadingSpinner from './LoadingSpinner';
import '../styles/PageHeader.css';

const PageHeader = ({ title, subtitle }) => {
  const { refreshData, loading } = useGameData();

  const handleRefresh = async () => {
    await refreshData();
  };

  return (
    <header className="page-header">
      <div className="page-header-content">
        <div className="page-header-text">
          {title && <h1>{title}</h1>}
          {subtitle && <p className="page-subtitle">{subtitle}</p>}
        </div>
        <button
          className="refresh-button"
          onClick={handleRefresh}
          disabled={loading}
          aria-label="Refresh data"
        >
          {loading ? (
            <LoadingSpinner />
          ) : (
            <>
              <span className="refresh-icon">↻</span>
              <span className="refresh-text">Refresh Data</span>
            </>
          )}
        </button>
      </div>
    </header>
  );
};

export default PageHeader;

