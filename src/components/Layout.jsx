/**
 * Layout Component
 * Wraps pages with sidebar and header
 */

import { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import '../styles/Layout.css';

const Layout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      // On desktop, sidebar should be open by default
      if (window.innerWidth >= 768) {
        setSidebarOpen(true);
      } else {
        setSidebarOpen(false);
      }
    };

    // Set initial state
    handleResize();

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const closeSidebar = () => {
    setSidebarOpen(false);
  };

  return (
    <div className="layout-container">
      <Sidebar isOpen={sidebarOpen} onClose={closeSidebar} />
      
      <div className="layout-content">
        {/* Hamburger menu button for mobile */}
        <button
          className="hamburger-menu"
          onClick={toggleSidebar}
          aria-label="Toggle menu"
        >
          <span className="hamburger-line"></span>
          <span className="hamburger-line"></span>
          <span className="hamburger-line"></span>
        </button>

        <main className="main-content">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;

