/**
 * Game Detail Component
 * Displays detailed information about a game
 */

import { useMemo } from 'react';
import { mapGameModeToCategory } from '../config';
import '../styles/GameDetail.css';

const GameDetail = ({ game }) => {
  // Sort events by event_at
  const sortedEvents = [...game.events].sort(
    (a, b) => new Date(a.event_at) - new Date(b.event_at)
  );

  // Helper function to get CSS color from color name
  const getColorValue = (colorName) => {
    if (!colorName) return null;
    const colorMap = {
      'red': '#FF0000',
      'blue': '#0000FF',
      'green': '#00FF00',
      'yellow': '#FFFF00',
    };
    const lowerColor = colorName.toLowerCase().trim();
    return colorMap[lowerColor] || colorName; // Return mapped color or original if not found
  };

  // Group events by level - each level is one row
  const levelRows = useMemo(() => {
    const rawGameMode = sortedEvents.find((e) => e.game_mode)?.game_mode || null;
    const gameModeCategory = mapGameModeToCategory(rawGameMode);
    const isAR = gameModeCategory === 'AR';

    // Group events by level
    const eventsByLevel = {};
    sortedEvents.forEach((event, index) => {
      const level = event.game_level !== null && event.game_level !== undefined ? event.game_level : 'unknown';
      if (!eventsByLevel[level]) {
        eventsByLevel[level] = [];
      }
      eventsByLevel[level].push({ ...event, originalIndex: index });
    });

    // Process each level
    return Object.keys(eventsByLevel)
      .sort((a, b) => {
        if (a === 'unknown') return 1;
        if (b === 'unknown') return -1;
        return Number(a) - Number(b);
      })
      .map((level) => {
        const levelEvents = eventsByLevel[level];
        const simonColors = [];
        const playerColors = [];
        const responseTimes = [];

        levelEvents.forEach((event, eventIndex) => {
          // Get Simon's turn colors
          if (isAR) {
            // AR mode: only count simon_select_end
            if (event.event_type === 'simon_select_end' && event.game_color) {
              simonColors.push(event.game_color);
            }
          } else {
            // 2D mode: count simon_select
            if (event.event_type === 'simon_select' && event.game_color) {
              simonColors.push(event.game_color);
            }
          }

          // Get Player's turn colors
          if (event.event_type === 'player_select') {
            if (event.game_color) {
              playerColors.push(event.game_color);
            }
          }
        });

        // Calculate response time: from when Simon finished showing sequence to level_complete or game_over
        // Find the last Simon event in this level (when Simon finished showing the sequence)
        let lastSimonEvent = null;
        if (isAR) {
          // AR: find the last simon_select_end in this level
          for (let i = levelEvents.length - 1; i >= 0; i--) {
            if (levelEvents[i].event_type === 'simon_select_end') {
              lastSimonEvent = levelEvents[i];
              break;
            }
          }
        } else {
          // 2D: find the last simon_select in this level
          for (let i = levelEvents.length - 1; i >= 0; i--) {
            if (levelEvents[i].event_type === 'simon_select') {
              lastSimonEvent = levelEvents[i];
              break;
            }
          }
        }

        // Find the first level_complete or game_over after Simon finished
        if (lastSimonEvent) {
          const lastSimonIndex = lastSimonEvent.originalIndex;
          const currentLevel = lastSimonEvent.game_level;
          let endEvent = null;
          
          // Look for end events after the last Simon event
          // Note: level_complete event's level is one higher than the completed level
          // e.g., level_complete with level 2 means level 1 was completed
          
          // First try to find level_complete for the current level (level_complete will have level + 1)
          for (let i = lastSimonIndex + 1; i < sortedEvents.length; i++) {
            const event = sortedEvents[i];
            if (event.event_type === 'level_complete' && event.game_level === currentLevel + 1) {
              endEvent = event;
              break;
            }
          }
          
          // If no level_complete found, look for game_over (can be any level)
          if (!endEvent) {
            for (let i = lastSimonIndex + 1; i < sortedEvents.length; i++) {
              const event = sortedEvents[i];
              if (event.event_type === 'game_over') {
                endEvent = event;
                break;
              }
            }
          }

          if (endEvent) {
            const simonTime = new Date(lastSimonEvent.event_at);
            const endTime = new Date(endEvent.event_at);
            const duration = endTime - simonTime;
            if (duration > 0) {
              responseTimes.push(duration);
            }
          } else {
            // Debug: log if we can't find end event
            console.log(`No end event found for level ${level} after Simon event at index ${lastSimonIndex}`);
          }
        } else {
          // Debug: log if we can't find Simon event
          console.log(`No Simon event found for level ${level}`);
        }

        // Get response time (only one per level)
        const responseTime = responseTimes.length > 0 ? responseTimes[0] : null;

        return {
          level: level === 'unknown' ? null : Number(level),
          simonColors: simonColors, // Show all colors, including duplicates
          playerColors: playerColors, // Show all colors, including duplicates
          responseTime: responseTime,
        };
      })
      .filter((row) => row.level !== null && row.level > 0); // Filter out unknown levels and level 0
  }, [sortedEvents]);

  return (
    <div className="game-detail-container">
      <div className="events-list">
        <h6>Levels ({levelRows.length}):</h6>
        <div className="events-table">
          <div className="events-header">
            <div className="event-col-level">Level</div>
            <div className="event-col-simon">Simon's Turn</div>
            <div className="event-col-player">Player's Turn</div>
            <div className="event-col-response">Response Time</div>
          </div>
          {levelRows.map((row, index) => (
            <div key={index} className="event-row">
              <div className="event-col-level">{row.level}</div>
              <div className="event-col-simon">
                {row.simonColors.length > 0 ? (
                  <div className="color-badges-container">
                    {row.simonColors.map((color, colorIndex) => (
                      <span
                        key={colorIndex}
                        className="color-badge"
                        style={{ backgroundColor: getColorValue(color) }}
                      >
                        {color}
                      </span>
                    ))}
                  </div>
                ) : '-'}
              </div>
              <div className="event-col-player">
                {row.playerColors.length > 0 ? (
                  <div className="color-badges-container">
                    {row.playerColors.map((color, colorIndex) => (
                      <span
                        key={colorIndex}
                        className="color-badge"
                        style={{ backgroundColor: getColorValue(color) }}
                      >
                        {color}
                      </span>
                    ))}
                  </div>
                ) : '-'}
              </div>
              <div className="event-col-response">
                {row.responseTime !== null ? (
                  <span>{(row.responseTime / 1000).toFixed(2)}s</span>
                ) : '-'}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default GameDetail;

