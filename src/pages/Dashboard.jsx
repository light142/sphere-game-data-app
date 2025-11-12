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
    totalEvents: 0,
    averageGamesPerSession: 0,
    averageSessionsPerPlayer: 0,
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
      const uniqueSessions = new Set(data.map((item) => item.session_id));
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

      const sessionsByPlayer = {};
      data.forEach((item) => {
        // Only count sessions for players that have games
        if (item.player_id && item.session_id && playersWithGames.has(item.player_id)) {
          if (!sessionsByPlayer[item.player_id]) {
            sessionsByPlayer[item.player_id] = new Set();
          }
          sessionsByPlayer[item.player_id].add(item.session_id);
        }
      });

      const totalGamesInSessions = Object.values(gamesBySession).reduce(
        (sum, games) => sum + games.size,
        0
      );

    setStats({
      totalGames: uniqueGames.size,
      totalSessions: uniqueSessions.size,
      totalPlayers: uniquePlayers.size,
      totalEvents: data.length,
      averageGamesPerSession:
        uniqueSessions.size > 0
          ? (totalGamesInSessions / uniqueSessions.size).toFixed(2)
          : 0,
      averageSessionsPerPlayer:
        uniquePlayers.size > 0
          ? (
              Object.values(sessionsByPlayer).reduce(
                (sum, sessions) => sum + sessions.size,
                0
              ) / uniquePlayers.size
            ).toFixed(2)
          : 0,
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
        <div className="stat-card stat-card-events">
          <h3>Total Events</h3>
          <p className="stat-value">{stats.totalEvents}</p>
        </div>
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
          <h3>Avg Games/Session</h3>
          <p className="stat-value">{stats.averageGamesPerSession}</p>
        </div>
        <div className="stat-card stat-card-avg-sessions">
          <h3>Avg Sessions/Player</h3>
          <p className="stat-value">{stats.averageSessionsPerPlayer}</p>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;

