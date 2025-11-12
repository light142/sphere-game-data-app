/**
 * Sidebar Component
 * Responsive sidebar navigation with mobile hamburger menu
 */

import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import '../styles/Sidebar.css';

const Sidebar = ({ isOpen, onClose }) => {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleNavClick = () => {
    // Close sidebar on mobile when a link is clicked
    if (window.innerWidth < 768) {
      onClose();
    }
  };

  return (
    <>
      {/* Overlay for mobile */}
      {isOpen && (
        <div className="sidebar-overlay" onClick={onClose} />
      )}

      {/* Sidebar */}
      <nav className={`sidebar ${isOpen ? 'sidebar-open' : ''}`}>
        <div className="sidebar-header">
          <h2>Sphere Game Data</h2>
          <button className="sidebar-close-btn" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="sidebar-nav">
          <NavLink
            to="/dashboard"
            className={({ isActive }) =>
              `sidebar-nav-item ${isActive ? 'active' : ''}`
            }
            onClick={handleNavClick}
          >
            <span className="nav-icon">📊</span>
            <span className="nav-text">Dashboard</span>
          </NavLink>

          <NavLink
            to="/players"
            className={({ isActive }) =>
              `sidebar-nav-item ${isActive ? 'active' : ''}`
            }
            onClick={handleNavClick}
          >
            <span className="nav-icon">🎮</span>
            <span className="nav-text">Game Sessions</span>
          </NavLink>

          <NavLink
            to="/data"
            className={({ isActive }) =>
              `sidebar-nav-item ${isActive ? 'active' : ''}`
            }
            onClick={handleNavClick}
          >
            <span className="nav-icon">📋</span>
            <span className="nav-text">Data</span>
          </NavLink>

          <NavLink
            to="/analysis"
            className={({ isActive }) =>
              `sidebar-nav-item ${isActive ? 'active' : ''}`
            }
            onClick={handleNavClick}
          >
            <span className="nav-icon">📈</span>
            <span className="nav-text">Descriptive Analysis</span>
          </NavLink>

          <NavLink
            to="/inferential"
            className={({ isActive }) =>
              `sidebar-nav-item ${isActive ? 'active' : ''}`
            }
            onClick={handleNavClick}
          >
            <span className="nav-icon">🔬</span>
            <span className="nav-text">Inferential Statistics</span>
          </NavLink>

          <NavLink
            to="/correlation"
            className={({ isActive }) =>
              `sidebar-nav-item ${isActive ? 'active' : ''}`
            }
            onClick={handleNavClick}
          >
            <span className="nav-icon">🔗</span>
            <span className="nav-text">Correlation Analysis</span>
          </NavLink>

          <NavLink
            to="/regression"
            className={({ isActive }) =>
              `sidebar-nav-item ${isActive ? 'active' : ''}`
            }
            onClick={handleNavClick}
          >
            <span className="nav-icon">📉</span>
            <span className="nav-text">Regression Analysis</span>
          </NavLink>
        </div>

        <div className="sidebar-footer">
          <button onClick={handleLogout} className="sidebar-logout-btn">
            <span className="nav-icon">🚪</span>
            <span className="nav-text">Logout</span>
          </button>
        </div>
      </nav>
    </>
  );
};

export default Sidebar;

