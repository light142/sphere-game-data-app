/**
 * Player Detail Component
 * Shows sessions grouped by player with collapsible games
 */

import { useState, useMemo } from 'react';
import { mapGameModeToCategory } from '../config';
import SessionDetail from './SessionDetail';
import '../styles/PlayerDetail.css';

const PlayerDetail = ({ player, onBack }) => {
  const [expandedSessions, setExpandedSessions] = useState(new Set());

  // Group events by session
  const sessionsData = useMemo(() => {
    // First, group all events by game_reference to check which games have simon select events
    const gamesWithSimonSelect = new Set();
    const eventsByGame = {};
    player.events.forEach((event) => {
      if (event.game_reference && event.game_reference.trim() !== '') {
        if (!eventsByGame[event.game_reference]) {
          eventsByGame[event.game_reference] = [];
        }
        eventsByGame[event.game_reference].push(event);
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

    const sessionsMap = {};
    player.events.forEach((event) => {
      const sessionId = event.session_id || 'Unknown';
      if (!sessionsMap[sessionId]) {
        sessionsMap[sessionId] = {
          session_id: sessionId,
          events: [],
          games: new Set(),
          startTime: event.event_at,
          endTime: event.event_at,
        };
      }
      sessionsMap[sessionId].events.push(event);
      // Only count as a game if it has a valid game_reference AND has at least one simon select event
      if (event.game_reference && event.game_reference.trim() !== '' && gamesWithSimonSelect.has(event.game_reference)) {
        sessionsMap[sessionId].games.add(event.game_reference);
      }
      // Update time range
      const eventTime = new Date(event.event_at);
      const startTime = new Date(sessionsMap[sessionId].startTime);
      const endTime = new Date(sessionsMap[sessionId].endTime);
      if (eventTime < startTime) {
        sessionsMap[sessionId].startTime = event.event_at;
      }
      if (eventTime > endTime) {
        sessionsMap[sessionId].endTime = event.event_at;
      }
    });

    return Object.values(sessionsMap).map((session) => ({
      ...session,
      gameCount: session.games.size,
      games: Array.from(session.games),
    }));
  }, [player.events]);

  const toggleSession = (sessionId) => {
    const newExpanded = new Set(expandedSessions);
    if (newExpanded.has(sessionId)) {
      newExpanded.delete(sessionId);
    } else {
      newExpanded.add(sessionId);
    }
    setExpandedSessions(newExpanded);
  };

  return (
    <div className="player-detail-container">
      <header className="player-detail-header">
        <div className="header-left">
          <button onClick={onBack} className="back-button">
            ← Back
          </button>
          <h1>
            {player.player_id === 'Unknown' ? 'Unknown Player' : player.player_id}
          </h1>
        </div>
      </header>

      <div className="player-summary">
        <div className="summary-card">
          <h3>Player Summary</h3>
          <div className="summary-stats">
            <div className="summary-item">
              <span className="summary-label">Total Sessions:</span>
              <span className="summary-value">{player.sessionCount}</span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Total Games:</span>
              <span className="summary-value">{player.gameCount}</span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Highest Level (AR):</span>
              <span className="summary-value">{player.highestLevelAR !== null ? player.highestLevelAR : 'N/A'}</span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Lowest Level (AR):</span>
              <span className="summary-value">{player.lowestLevelAR !== null ? player.lowestLevelAR : 'N/A'}</span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Highest Level (2D):</span>
              <span className="summary-value">{player.highestLevel2D !== null ? player.highestLevel2D : 'N/A'}</span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Lowest Level (2D):</span>
              <span className="summary-value">{player.lowestLevel2D !== null ? player.lowestLevel2D : 'N/A'}</span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Longest Session:</span>
              <span className="summary-value">
                {player.longestSession !== null
                  ? `${Math.round(player.longestSession / 1000 / 60)} min`
                  : 'N/A'}
              </span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Shortest Session:</span>
              <span className="summary-value">
                {player.shortestSession !== null
                  ? `${Math.round(player.shortestSession / 1000 / 60)} min`
                  : 'N/A'}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="sessions-list">
        <h2>Sessions ({sessionsData.length})</h2>
        {sessionsData.map((session) => (
          <div key={session.session_id} className="session-card">
            <div
              className="session-header"
              onClick={() => toggleSession(session.session_id)}
            >
              <div className="session-info">
                <h3>Session: {session.session_id}</h3>
                <div className="session-meta">
                  <span>Games: {session.gameCount}</span>
                  <span>
                    Duration:{' '}
                    {new Date(session.endTime) - new Date(session.startTime) > 0
                      ? `${Math.round(
                          (new Date(session.endTime) -
                            new Date(session.startTime)) /
                            1000 /
                            60
                        )} min`
                      : 'N/A'}
                  </span>
                </div>
              </div>
              <div className="session-toggle">
                {expandedSessions.has(session.session_id) ? '▼' : '▶'}
              </div>
            </div>
            {expandedSessions.has(session.session_id) && (
              <SessionDetail session={session} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default PlayerDetail;

