/**
 * Session Detail Component
 * Shows games in a table format with collapsible details
 */

import { useState, useMemo } from 'react';
import { mapGameModeToCategory } from '../config';
import GameDetail from './GameDetail';
import '../styles/SessionDetail.css';

const SessionDetail = ({ session }) => {
  const [expandedGames, setExpandedGames] = useState(new Set());

  // Group events by game_reference and calculate stats
  // Only include events that have a game_reference (if no game_reference, it's not a game)
  const gamesData = useMemo(() => {
    const gamesMap = {};
    // Filter out events without game_reference
    const gameEvents = session.events.filter((event) => event.game_reference && event.game_reference.trim() !== '');
    
    gameEvents.forEach((event) => {
      const gameRef = event.game_reference;
      if (!gamesMap[gameRef]) {
        gamesMap[gameRef] = {
          game_reference: gameRef,
          events: [],
        };
      }
      gamesMap[gameRef].events.push(event);
    });

    // Calculate stats for each game
    return Object.values(gamesMap)
      .map((game) => {
        const sortedEvents = [...game.events].sort(
          (a, b) => new Date(a.event_at) - new Date(b.event_at)
        );

        const rawGameMode = sortedEvents.find((e) => e.game_mode)?.game_mode || null;
        const gameModeCategory = mapGameModeToCategory(rawGameMode);
        const isAR = gameModeCategory === 'AR';

        // Check if game has at least one simon select event
        const hasSimonSelect = isAR
          ? sortedEvents.some((e) => e.event_type === 'simon_select_end')
          : sortedEvents.some((e) => e.event_type === 'simon_select');

        // Filter out games without simon select events
        if (!hasSimonSelect) {
          return null;
        }

        const gameLevels = sortedEvents
          .map((e) => e.game_level)
          .filter((l) => l !== null && l !== undefined);

        const maxLevel = gameLevels.length > 0 ? Math.max(...gameLevels) : null;
        const startTime = sortedEvents[0]?.event_at;
        const endTime = sortedEvents[sortedEvents.length - 1]?.event_at;

        // Determine game status based on events
        // Priority: Game Over > Restarted > Player Left
        // If player made a mistake (game_over), show "Game Over" even if game was restarted
        let gameStatus = 'Unknown';
        const hasGameOver = sortedEvents.some((e) => e.event_type === 'game_over');
        const hasRestart = sortedEvents.some((e) => e.event_type === 'restart_game');
        const hasQuit = sortedEvents.some((e) => e.event_type === 'quit_application');
        const hasBackToMenu = sortedEvents.some((e) => e.event_type === 'back_to_menu');

        if (hasGameOver) {
          // Game ended due to mistake/wrong choice - show "Game Over"
          gameStatus = 'Game Over';
        } else if (hasRestart) {
          // Game was restarted (but didn't end due to mistake)
          gameStatus = 'Restarted';
        } else if (hasQuit || hasBackToMenu) {
          // Player left the game
          gameStatus = 'Player Left';
        }

        return {
          ...game,
          gameMode: gameModeCategory || 'N/A',
          maxLevel,
          startTime,
          endTime,
          gameStatus,
        };
      })
      .filter((game) => game !== null); // Remove null entries (games without simon select)
  }, [session.events]);

  const toggleGame = (gameRef) => {
    const newExpanded = new Set(expandedGames);
    if (newExpanded.has(gameRef)) {
      newExpanded.delete(gameRef);
    } else {
      newExpanded.add(gameRef);
    }
    setExpandedGames(newExpanded);
  };

  const formatMaxLevel = (maxLevel) => {
    if (maxLevel === null || maxLevel === undefined) return 'N/A';
    return maxLevel;
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="session-detail-container">
      <div className="games-table-container">
        <h4>Games ({gamesData.length})</h4>
        <div className="games-table">
          <div className="games-table-header">
            <div className="games-col-toggle"></div>
            <div className="games-col-reference">Game Reference</div>
            <div className="games-col-mode">Game Mode</div>
            <div className="games-col-level">Max Level</div>
            <div className="games-col-status">Status</div>
            <div className="games-col-start">Start Time</div>
            <div className="games-col-end">End Time</div>
          </div>
          {gamesData.map((game) => (
            <div key={game.game_reference} className="games-table-row-wrapper">
              <div
                className="games-table-row"
                onClick={() => toggleGame(game.game_reference)}
              >
                <div className="games-col-toggle">
                  <span className="game-toggle-icon">
                    {expandedGames.has(game.game_reference) ? '▼' : '▶'}
                  </span>
                </div>
                <div className="games-col-reference">
                  {game.game_reference}
                </div>
                <div className="games-col-mode">{game.gameMode}</div>
                <div className="games-col-level">{formatMaxLevel(game.maxLevel)}</div>
                <div className="games-col-status">{game.gameStatus}</div>
                <div className="games-col-start">{formatDateTime(game.startTime)}</div>
                <div className="games-col-end">{formatDateTime(game.endTime)}</div>
              </div>
              {expandedGames.has(game.game_reference) && (
                <div className="games-table-detail">
                  <GameDetail game={game} />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SessionDetail;

