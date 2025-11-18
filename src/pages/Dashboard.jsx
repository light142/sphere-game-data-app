/**
 * Dashboard Page
 * Summary statistics and overview
 */

import { useState, useEffect } from 'react';
import { useGameData } from '../contexts/GameDataContext';
import { mapGameModeToCategory } from '../config';
import LoadingSpinner from '../components/LoadingSpinner';
import PageHeader from '../components/PageHeader';
import '../styles/Dashboard.css';

const Dashboard = () => {
  const { data, loading, error } = useGameData();
  const [stats, setStats] = useState({
    totalGames: 0,
    totalSessions: 0,
    totalPlayers: 0,
    averageGamesPerSession: 0,
    total2DGames: 0,
    totalARGames: 0,
    averageHighestLevelAR: 0,
    averageHighestLevel2D: 0,
  });

  useEffect(() => {
    if (data && data.length > 0) {
      calculateStats();
    }
  }, [data]);

  const calculateStats = () => {
    if (!data || data.length === 0) return;

      // First, group all events by game_reference to check which games have simon select events
      const gamesWithSimonSelect = new Set();
      const eventsByGame = {};
      data.forEach((item) => {
        if (item.game_reference && item.game_reference.trim() !== '') {
          if (!eventsByGame[item.game_reference]) {
            eventsByGame[item.game_reference] = [];
          }
          eventsByGame[item.game_reference].push(item);
        }
      });

      // Track games by mode and their highest levels
      const gamesByMode = { AR: new Set(), '2D': new Set() };
      const highestLevelsByMode = { AR: [], '2D': [] };

      // Check each game for simon select events
      Object.keys(eventsByGame).forEach((gameRef) => {
        const gameEvents = eventsByGame[gameRef];
        const rawGameMode = gameEvents.find((e) => e.game_mode)?.game_mode || null;
        const gameModeCategory = mapGameModeToCategory(rawGameMode);
        const isAR = gameModeCategory === 'AR';

        const hasSimonSelect = isAR
          ? gameEvents.some((e) => e.event_type === 'simon_select_end')
          : gameEvents.some((e) => e.event_type === 'simon_select');

        if (hasSimonSelect) {
          gamesWithSimonSelect.add(gameRef);
          
          // Track game by mode
          if (gameModeCategory === 'AR') {
            gamesByMode.AR.add(gameRef);
          } else if (gameModeCategory === '2D') {
            gamesByMode['2D'].add(gameRef);
          }

          // Calculate highest level for this game
          const gameLevels = gameEvents
            .map((e) => e.game_level)
            .filter((l) => l !== null && l !== undefined && l > 0);
          
          if (gameLevels.length > 0) {
            const maxLevel = Math.max(...gameLevels);
            if (gameModeCategory === 'AR') {
              highestLevelsByMode.AR.push(maxLevel);
            } else if (gameModeCategory === '2D') {
              highestLevelsByMode['2D'].push(maxLevel);
            }
          }
        }
      });

      // Calculate which players have games
      const playersWithGames = new Set();
      data.forEach((item) => {
        if (item.player_id && item.game_reference && item.game_reference.trim() !== '' && gamesWithSimonSelect.has(item.game_reference)) {
          playersWithGames.add(item.player_id);
        }
      });

      // Calculate statistics
      // Only count players that have at least one game
      const uniquePlayers = playersWithGames;
      // Only count as a game if it has a valid game_reference AND has at least one simon select event
      const uniqueGames = gamesWithSimonSelect;

      const gamesBySession = {};
      data.forEach((item) => {
        // Only count as a game if it has a valid game_reference AND has at least one simon select event
        if (item.session_id && item.game_reference && item.game_reference.trim() !== '' && gamesWithSimonSelect.has(item.game_reference)) {
          if (!gamesBySession[item.session_id]) {
            gamesBySession[item.session_id] = new Set();
          }
          gamesBySession[item.session_id].add(item.game_reference);
        }
      });

      // Only count sessions that have games
      const uniqueSessions = new Set(Object.keys(gamesBySession));

      const totalGamesInSessions = Object.values(gamesBySession).reduce(
        (sum, games) => sum + games.size,
        0
      );

      // Calculate average highest level per mode
      const avgHighestLevelAR = highestLevelsByMode.AR.length > 0
        ? (highestLevelsByMode.AR.reduce((sum, level) => sum + level, 0) / highestLevelsByMode.AR.length).toFixed(2)
        : 0;
      
      const avgHighestLevel2D = highestLevelsByMode['2D'].length > 0
        ? (highestLevelsByMode['2D'].reduce((sum, level) => sum + level, 0) / highestLevelsByMode['2D'].length).toFixed(2)
        : 0;

    setStats({
      totalGames: uniqueGames.size,
      totalSessions: uniqueSessions.size,
      totalPlayers: uniquePlayers.size,
      averageGamesPerSession:
        uniqueSessions.size > 0
          ? (totalGamesInSessions / uniqueSessions.size).toFixed(2)
          : 0,
      total2DGames: gamesByMode['2D'].size,
      totalARGames: gamesByMode.AR.size,
      averageHighestLevelAR: avgHighestLevelAR,
      averageHighestLevel2D: avgHighestLevel2D,
    });
  };

  if (loading) {
    return (
      <div className="dashboard-container">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard-container">
        <PageHeader title="Dashboard" />
        <div className="error">{error}</div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <PageHeader title="Dashboard" />

      <div className="stats-grid">
        <div className="stat-card stat-card-players">
          <h3>Total Players</h3>
          <p className="stat-value">{stats.totalPlayers}</p>
        </div>
        <div className="stat-card stat-card-sessions">
          <h3>Total Sessions</h3>
          <p className="stat-value">{stats.totalSessions}</p>
        </div>
        <div className="stat-card stat-card-games">
          <h3>Total Games</h3>
          <p className="stat-value">{stats.totalGames}</p>
        </div>
        <div className="stat-card stat-card-avg-games">
          <h3>Average Games per Session</h3>
          <p className="stat-value">{stats.averageGamesPerSession}</p>
        </div>
        <div className="mode-group mode-group-2d">
          <h2 className="mode-group-title">2D Mode</h2>
          <div className="mode-group-stats">
            <div className="stat-card stat-card-2d-games">
              <h3>Total 2D Games</h3>
              <p className="stat-value">{stats.total2DGames}</p>
            </div>
            <div className="stat-card stat-card-avg-level-2d">
              <h3>Avg Highest Level (2D)</h3>
              <p className="stat-value">{stats.averageHighestLevel2D}</p>
            </div>
          </div>
        </div>
        <div className="mode-group mode-group-ar">
          <h2 className="mode-group-title">AR Mode</h2>
          <div className="mode-group-stats">
            <div className="stat-card stat-card-ar-games">
              <h3>Total AR Games</h3>
              <p className="stat-value">{stats.totalARGames}</p>
            </div>
            <div className="stat-card stat-card-avg-level-ar">
              <h3>Avg Highest Level (AR)</h3>
              <p className="stat-value">{stats.averageHighestLevelAR}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;

