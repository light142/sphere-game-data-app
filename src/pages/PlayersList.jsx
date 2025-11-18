/**
 * Players List Page
 * Grouped by player_id with statistics
 */

import { useState, useEffect } from 'react';
import { useGameData } from '../contexts/GameDataContext';
import { mapGameModeToCategory } from '../config';
import PlayerDetail from '../components/PlayerDetail';
import LoadingSpinner from '../components/LoadingSpinner';
import PageHeader from '../components/PageHeader';
import '../styles/PlayersList.css';

const PlayersList = () => {
  const { data, loading, error } = useGameData();
  const [players, setPlayers] = useState([]);
  const [selectedPlayer, setSelectedPlayer] = useState(null);

  useEffect(() => {
    if (data && data.length > 0) {
      processPlayersData();
    }
  }, [data]);

  const processPlayersData = () => {
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

      // Group by player_id
      const playersMap = {};
      data.forEach((item) => {
        const playerId = item.player_id || 'Unknown';
        if (!playersMap[playerId]) {
          playersMap[playerId] = {
            player_id: playerId,
            sessions: new Map(), // Map to track session start/end times
            games: new Set(),
            events: [],
            arScores: [], // Track AR mode scores (game_level)
            twoDScores: [], // Track 2D mode scores (game_level)
          };
        }

        // Track sessions with start/end times
        // Start time: first event in session (any event)
        // End time: last game category event (events with game_reference)
        if (item.session_id) {
          if (!playersMap[playerId].sessions.has(item.session_id)) {
            playersMap[playerId].sessions.set(item.session_id, {
              startTime: item.event_at, // First event (any event)
              endTime: null, // Will be set by last game category event
              games: new Set(), // Track games in this session
            });
          } else {
            const session = playersMap[playerId].sessions.get(item.session_id);
            const eventTime = new Date(item.event_at);
            const startTime = new Date(session.startTime);
            // Update start time if this is an earlier event
            if (eventTime < startTime) {
              session.startTime = item.event_at;
            }
          }
          
          // Update end time only for game category events (those with game_reference)
          if (item.game_reference && item.game_reference.trim() !== '') {
            const session = playersMap[playerId].sessions.get(item.session_id);
            const eventTime = new Date(item.event_at);
            const endTime = session.endTime 
              ? new Date(session.endTime)
              : null;
            if (!endTime || eventTime > endTime) {
              session.endTime = item.event_at;
            }
          }
        }

        // Only count as a game if it has a valid game_reference AND has at least one simon select event
        if (item.game_reference && item.game_reference.trim() !== '' && gamesWithSimonSelect.has(item.game_reference)) {
          playersMap[playerId].games.add(item.game_reference);
          // Also track this game in the session
          if (item.session_id && playersMap[playerId].sessions.has(item.session_id)) {
            playersMap[playerId].sessions.get(item.session_id).games.add(item.game_reference);
          }
        }

        // Track scores by game mode category (using game_level as score)
        if (item.game_level !== null && item.game_level !== undefined) {
          const category = mapGameModeToCategory(item.game_mode);
          if (category === 'AR') {
            playersMap[playerId].arScores.push(item.game_level);
          } else if (category === '2D') {
            playersMap[playerId].twoDScores.push(item.game_level);
          }
        }

        playersMap[playerId].events.push(item);
      });

      // Convert to array and calculate stats
      const playersArray = Object.values(playersMap).map((player) => {
        // Filter out sessions with no games
        const sessions = Array.from(player.sessions.values()).filter((session) => {
          return session.games && session.games.size > 0 && session.endTime !== null;
        });
        const sessionDurations = sessions
          .map((session) => {
            const duration = new Date(session.endTime) - new Date(session.startTime);
            return duration > 0 ? duration : 0;
          })
          .filter((d) => d > 0);

        // Calculate AR levels (exclude level 0 from average calculation)
        const arScores = player.arScores.filter((s) => s !== null && s !== undefined);
        const arScoresExcludingZero = arScores.filter((s) => s > 0);
        const avgLevelAR = arScoresExcludingZero.length > 0 
          ? arScoresExcludingZero.reduce((sum, score) => sum + score, 0) / arScoresExcludingZero.length 
          : null;
        const maxLevelAR = arScores.length > 0 ? Math.max(...arScores) : null;

        // Calculate 2D levels (exclude level 0 from average calculation)
        const twoDScores = player.twoDScores.filter((s) => s !== null && s !== undefined);
        const twoDScoresExcludingZero = twoDScores.filter((s) => s > 0);
        const avgLevel2D = twoDScoresExcludingZero.length > 0 
          ? twoDScoresExcludingZero.reduce((sum, score) => sum + score, 0) / twoDScoresExcludingZero.length 
          : null;
        const maxLevel2D = twoDScores.length > 0 ? Math.max(...twoDScores) : null;

        // Calculate average and max session duration
        const avgSessionTime = sessionDurations.length > 0 
          ? sessionDurations.reduce((sum, duration) => sum + duration, 0) / sessionDurations.length 
          : null;
        const maxSessionTime = sessionDurations.length > 0 
          ? Math.max(...sessionDurations) 
          : null;

        return {
          ...player,
          sessionCount: player.sessions.size,
          gameCount: player.games.size,
          avgLevelAR,
          maxLevelAR,
          avgLevel2D,
          maxLevel2D,
          avgSessionTime, // in milliseconds
          maxSessionTime, // in milliseconds
        };
      });

      // Filter out players with no games and sort by game count (most games first)
      const playersWithGames = playersArray.filter((player) => player.gameCount > 0);
      playersWithGames.sort((a, b) => b.gameCount - a.gameCount);

    setPlayers(playersWithGames);
  };

  const handlePlayerClick = (player) => {
    setSelectedPlayer(player);
  };

  const handleBack = () => {
    setSelectedPlayer(null);
  };

  if (loading) {
    return (
      <div className="players-list-container">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="players-list-container">
        <PageHeader title="Game Sessions" />
        <div className="error">{error}</div>
      </div>
    );
  }

  if (selectedPlayer) {
    return <PlayerDetail player={selectedPlayer} onBack={handleBack} />;
  }

  return (
    <div className="players-list-container">
      <PageHeader title="Game Sessions - Grouped by Players" />

      <div className="players-table-container">
        <div className="players-table">
          <div className="players-table-headers">
            <div className="players-col-id">Player</div>
            <div className="players-col-sessions">Sessions</div>
            <div className="players-col-games">Games</div>
            <div className="players-col-avg-ar">Avg Level (AR)</div>
            <div className="players-col-avg-2d">Avg Level (2D)</div>
            <div className="players-col-max-ar">Highest Level (AR)</div>
            <div className="players-col-max-2d">Highest Level (2D)</div>
            <div className="players-col-avg-session">Avg Session Time</div>
          </div>
          {players.map((player) => (
            <div
              key={player.player_id}
              className="players-table-row"
              onClick={() => handlePlayerClick(player)}
            >
              <div className="players-col-id">
                {player.player_id === 'Unknown' ? 'Unknown Player' : player.player_id}
              </div>
              <div className="players-col-sessions">{player.sessionCount}</div>
              <div className="players-col-games">{player.gameCount}</div>
              <div className="players-col-avg-ar">
                {player.avgLevelAR !== null ? player.avgLevelAR.toFixed(2) : 'N/A'}
              </div>
              <div className="players-col-avg-2d">
                {player.avgLevel2D !== null ? player.avgLevel2D.toFixed(2) : 'N/A'}
              </div>
              <div className="players-col-max-ar">
                {player.maxLevelAR !== null ? player.maxLevelAR : 'N/A'}
              </div>
              <div className="players-col-max-2d">
                {player.maxLevel2D !== null ? player.maxLevel2D : 'N/A'}
              </div>
              <div className="players-col-avg-session">
                {player.avgSessionTime !== null
                  ? `${Math.round(player.avgSessionTime / 1000 / 60)} min`
                  : 'N/A'}
              </div>
            </div>
          ))}
        </div>
      </div>

      {players.length === 0 && (
        <div className="empty-state">
          <p>No players found</p>
        </div>
      )}
    </div>
  );
};

export default PlayersList;

