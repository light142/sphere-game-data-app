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
        if (item.session_id) {
          if (!playersMap[playerId].sessions.has(item.session_id)) {
            playersMap[playerId].sessions.set(item.session_id, {
              startTime: item.event_at,
              endTime: item.event_at,
            });
          } else {
            const session = playersMap[playerId].sessions.get(item.session_id);
            const eventTime = new Date(item.event_at);
            const startTime = new Date(session.startTime);
            const endTime = new Date(session.endTime);
            if (eventTime < startTime) {
              session.startTime = item.event_at;
            }
            if (eventTime > endTime) {
              session.endTime = item.event_at;
            }
          }
        }

        // Only count as a game if it has a valid game_reference AND has at least one simon select event
        if (item.game_reference && item.game_reference.trim() !== '' && gamesWithSimonSelect.has(item.game_reference)) {
          playersMap[playerId].games.add(item.game_reference);
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
        const sessions = Array.from(player.sessions.values());
        const sessionDurations = sessions
          .map((session) => {
            const duration = new Date(session.endTime) - new Date(session.startTime);
            return duration > 0 ? duration : 0;
          })
          .filter((d) => d > 0);

        // Calculate AR levels (exclude level 0 from lowest level calculation)
        const arScores = player.arScores.filter((s) => s !== null && s !== undefined);
        const arScoresExcludingZero = arScores.filter((s) => s > 0);
        const highestLevelAR = arScores.length > 0 ? Math.max(...arScores) : null;
        const lowestLevelAR = arScoresExcludingZero.length > 0 ? Math.min(...arScoresExcludingZero) : null;

        // Calculate 2D levels (exclude level 0 from lowest level calculation)
        const twoDScores = player.twoDScores.filter((s) => s !== null && s !== undefined);
        const twoDScoresExcludingZero = twoDScores.filter((s) => s > 0);
        const highestLevel2D = twoDScores.length > 0 ? Math.max(...twoDScores) : null;
        const lowestLevel2D = twoDScoresExcludingZero.length > 0 ? Math.min(...twoDScoresExcludingZero) : null;

        // Calculate session durations
        const longestSession = sessionDurations.length > 0 ? Math.max(...sessionDurations) : null;
        const shortestSession = sessionDurations.length > 0 ? Math.min(...sessionDurations) : null;

        return {
          ...player,
          sessionCount: player.sessions.size,
          gameCount: player.games.size,
          highestLevelAR,
          lowestLevelAR,
          highestLevel2D,
          lowestLevel2D,
          longestSession, // in milliseconds
          shortestSession, // in milliseconds
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
            <div className="players-col-id">Player ID</div>
            <div className="players-col-sessions">Sessions</div>
            <div className="players-col-games">Games</div>
            <div className="players-col-ar-group">AR</div>
            <div className="players-col-2d-group">2D</div>
            <div className="players-col-longest">Longest Session</div>
            <div className="players-col-shortest">Shortest Session</div>
            <div className="players-col-id-sub"></div>
            <div className="players-col-sessions-sub"></div>
            <div className="players-col-games-sub"></div>
            <div className="players-col-highest-ar">Highest Level</div>
            <div className="players-col-lowest-ar">Lowest Level</div>
            <div className="players-col-highest-2d">Highest Level</div>
            <div className="players-col-lowest-2d">Lowest Level</div>
            <div className="players-col-longest-sub"></div>
            <div className="players-col-shortest-sub"></div>
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
              <div className="players-col-highest-ar">
                {player.highestLevelAR !== null ? player.highestLevelAR : 'N/A'}
              </div>
              <div className="players-col-lowest-ar">
                {player.lowestLevelAR !== null ? player.lowestLevelAR : 'N/A'}
              </div>
              <div className="players-col-highest-2d">
                {player.highestLevel2D !== null ? player.highestLevel2D : 'N/A'}
              </div>
              <div className="players-col-lowest-2d">
                {player.lowestLevel2D !== null ? player.lowestLevel2D : 'N/A'}
              </div>
              <div className="players-col-longest">
                {player.longestSession !== null
                  ? `${Math.round(player.longestSession / 1000 / 60)} min`
                  : 'N/A'}
              </div>
              <div className="players-col-shortest">
                {player.shortestSession !== null
                  ? `${Math.round(player.shortestSession / 1000 / 60)} min`
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

