/**
 * Loading Spinner Component
 * Animated loading spinner without text with dimming overlay
 */

import '../styles/LoadingSpinner.css';

const LoadingSpinner = () => {
  return (
    <div className="loading-spinner-overlay">
      <div className="loading-spinner-container">
        <div className="loading-spinner">
          <div className="spinner-ring"></div>
          <div className="spinner-ring"></div>
          <div className="spinner-ring"></div>
        </div>
      </div>
    </div>
  );
};

export default LoadingSpinner;

