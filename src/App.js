/**
 * Main App Component
 * Sets up routing and authentication context
 */

import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { GameDataProvider } from './contexts/GameDataContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import ScrollToTop from './components/ScrollToTop';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import PlayersList from './pages/PlayersList';
import Data from './pages/Data';
import DescriptiveAnalysis from './pages/DescriptiveAnalysis';
import InferentialStatistics from './pages/InferentialStatistics';
import CorrelationAnalysis from './pages/CorrelationAnalysis';
import RegressionAnalysis from './pages/RegressionAnalysis';
import './App.css';

function App() {
  return (
    <AuthProvider>
      <GameDataProvider>
        <Router>
        <ScrollToTop />
        <div className="App">
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Dashboard />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/players"
              element={
                <ProtectedRoute>
                  <Layout>
                    <PlayersList />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/data"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Data />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/analysis"
              element={
                <ProtectedRoute>
                  <Layout>
                    <DescriptiveAnalysis />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/inferential"
              element={
                <ProtectedRoute>
                  <Layout>
                    <InferentialStatistics />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/correlation"
              element={
                <ProtectedRoute>
                  <Layout>
                    <CorrelationAnalysis />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/regression"
              element={
                <ProtectedRoute>
                  <Layout>
                    <RegressionAnalysis />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </div>
      </Router>
      </GameDataProvider>
    </AuthProvider>
  );
}

export default App;

