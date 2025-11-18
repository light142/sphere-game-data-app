/**
 * Descriptive Analysis Page
 * Statistical analysis and visualizations of game data
 */

import { useMemo } from 'react';
import { useGameData } from '../contexts/GameDataContext';
import { mapGameModeToCategory } from '../config';
import LoadingSpinner from '../components/LoadingSpinner';
import PageHeader from '../components/PageHeader';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  ComposedChart,
} from 'recharts';
import '../styles/DescriptiveAnalysis.css';

const DescriptiveAnalysis = () => {
  const { data, loading, error } = useGameData();

  // Statistical utility functions
  const calculateMean = (values) => {
    if (!values || values.length === 0) return 0;
    const validValues = values.filter(v => !isNaN(v) && isFinite(v));
    if (validValues.length === 0) return 0;
    const sum = validValues.reduce((acc, val) => acc + val, 0);
    return sum / validValues.length;
  };

  const calculateMedian = (values) => {
    if (!values || values.length === 0) return 0;
    const validValues = values.filter(v => !isNaN(v) && isFinite(v));
    if (validValues.length === 0) return 0;
    const sorted = [...validValues].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];
  };

  const calculateMode = (values) => {
    if (!values || values.length === 0) return null;
    const validValues = values.filter(v => !isNaN(v) && isFinite(v));
    if (validValues.length === 0) return null;
    const frequency = {};
    validValues.forEach((val) => {
      frequency[val] = (frequency[val] || 0) + 1;
    });
    let maxFreq = 0;
    let mode = null;
    Object.keys(frequency).forEach((key) => {
      if (frequency[key] > maxFreq) {
        maxFreq = frequency[key];
        mode = Number(key);
      }
    });
    return mode;
  };

  const calculateStandardDeviation = (values) => {
    if (!values || values.length === 0) return 0;
    const validValues = values.filter(v => !isNaN(v) && isFinite(v));
    if (validValues.length === 0) return 0;
    const mean = calculateMean(validValues);
    const squaredDiffs = validValues.map((val) => Math.pow(val - mean, 2));
    const avgSquaredDiff = calculateMean(squaredDiffs);
    return Math.sqrt(avgSquaredDiff);
  };

  const calculateVariance = (values) => {
    if (!values || values.length === 0) return 0;
    const stdDev = calculateStandardDeviation(values);
    return stdDev * stdDev;
  };

  const calculatePercentile = (values, percentile) => {
    if (!values || values.length === 0) return 0;
    const validValues = values.filter(v => !isNaN(v) && isFinite(v));
    if (validValues.length === 0) return 0;
    const sorted = [...validValues].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  };

  // Process data for analysis
  const analysisData = useMemo(() => {
    if (!data || data.length === 0) return null;

    // Filter games with valid game_reference and Simon select events
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

    // Calculate response times
    const responseTimes = [];
    const responseTimesByMode = { AR: [], '2D': [] };
    const levels = [];
    const levelsByMode = { AR: [], '2D': [] };
    const sessionDurations = [];
    const eventTypeCounts = {};
    const colorFrequency = {};
    const gameModeCounts = { AR: 0, '2D': 0 };
    const gameOutcomes = { 'Game Over': 0, 'Level Complete': 0, 'Restarted': 0, 'Player Left': 0 };

    // Group events by game
    const gamesMap = {};
    data.forEach((item) => {
      if (item.game_reference && item.game_reference.trim() !== '' && gamesWithSimonSelect.has(item.game_reference)) {
        if (!gamesMap[item.game_reference]) {
          gamesMap[item.game_reference] = [];
        }
        gamesMap[item.game_reference].push(item);
      }
    });

    // Process each game
    Object.values(gamesMap).forEach((gameEvents) => {
      const sortedEvents = [...gameEvents].sort(
        (a, b) => new Date(a.event_at) - new Date(b.event_at)
      );

      const rawGameMode = sortedEvents.find((e) => e.game_mode)?.game_mode || null;
      const gameModeCategory = mapGameModeToCategory(rawGameMode) || 'Unknown';
      if (gameModeCategory === 'AR' || gameModeCategory === '2D') {
        gameModeCounts[gameModeCategory]++;
      }

      // Calculate response times per level
      const eventsByLevel = {};
      sortedEvents.forEach((event, index) => {
        const level = event.game_level !== null && event.game_level !== undefined ? event.game_level : 'unknown';
        if (!eventsByLevel[level]) {
          eventsByLevel[level] = [];
        }
        eventsByLevel[level].push({ ...event, originalIndex: index });
      });

      Object.keys(eventsByLevel).forEach((level) => {
        if (level === 'unknown' || Number(level) <= 0) {
          return;
        }

        const levelEvents = eventsByLevel[level];
        const isAR = gameModeCategory === 'AR';
        const currentLevel = Number(level);

        // Find last Simon event
        let lastSimonEvent = null;
        if (isAR) {
          for (let i = levelEvents.length - 1; i >= 0; i--) {
            if (levelEvents[i].event_type === 'simon_select_end') {
              lastSimonEvent = levelEvents[i];
              break;
            }
          }
        } else {
          for (let i = levelEvents.length - 1; i >= 0; i--) {
            if (levelEvents[i].event_type === 'simon_select') {
              lastSimonEvent = levelEvents[i];
              break;
            }
          }
        }

        if (lastSimonEvent) {
          const lastSimonIndex = lastSimonEvent.originalIndex;
          let endEvent = null;

          // Find level_complete (level + 1) or game_over
          for (let i = lastSimonIndex + 1; i < sortedEvents.length; i++) {
            const event = sortedEvents[i];
            if (event.event_type === 'level_complete' && event.game_level === currentLevel + 1) {
              endEvent = event;
              break;
            }
          }

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
              responseTimes.push(duration / 1000); // Convert to seconds
              if (gameModeCategory === 'AR' || gameModeCategory === '2D') {
                responseTimesByMode[gameModeCategory].push(duration / 1000);
              }
            }
          }
        }

        // Track levels
        if (currentLevel > 0) {
          levels.push(currentLevel);
          if (gameModeCategory === 'AR' || gameModeCategory === '2D') {
            levelsByMode[gameModeCategory].push(currentLevel);
          }
        }
      });

      // Track max level reached
      const gameLevels = sortedEvents
        .map((e) => e.game_level)
        .filter((l) => l !== null && l !== undefined && l > 0);
      if (gameLevels.length > 0) {
        const maxLevel = Math.max(...gameLevels);
        levels.push(maxLevel);
        if (gameModeCategory === 'AR' || gameModeCategory === '2D') {
          levelsByMode[gameModeCategory].push(maxLevel);
        }
      }

      // Track game outcomes
      const hasGameOver = sortedEvents.some((e) => e.event_type === 'game_over');
      const hasRestart = sortedEvents.some((e) => e.event_type === 'restart_game');
      const hasQuit = sortedEvents.some((e) => e.event_type === 'quit_application');
      const hasBackToMenu = sortedEvents.some((e) => e.event_type === 'back_to_menu');
      const hasLevelComplete = sortedEvents.some((e) => e.event_type === 'level_complete');

      if (hasGameOver) {
        gameOutcomes['Game Over']++;
      } else if (hasRestart) {
        gameOutcomes['Restarted']++;
      } else if (hasQuit || hasBackToMenu) {
        gameOutcomes['Player Left']++;
      } else if (hasLevelComplete) {
        gameOutcomes['Level Complete']++;
      }
    });

    // Calculate session durations
    // Start time: first event in session (any event)
    // End time: last game category event (events with game_reference)
    const sessionsMap = {};
    data.forEach((item) => {
      if (item.session_id) {
        if (!sessionsMap[item.session_id]) {
          sessionsMap[item.session_id] = {
            startTime: item.event_at, // First event (any event)
            endTime: null, // Will be set by last game category event
          };
        } else {
          // Update start time if this is an earlier event
          const eventTime = new Date(item.event_at);
          const startTime = new Date(sessionsMap[item.session_id].startTime);
          if (eventTime < startTime) {
            sessionsMap[item.session_id].startTime = item.event_at;
          }
        }
        
        // Update end time only for game category events (those with game_reference)
        if (item.game_reference && item.game_reference.trim() !== '') {
          const eventTime = new Date(item.event_at);
          const endTime = sessionsMap[item.session_id].endTime 
            ? new Date(sessionsMap[item.session_id].endTime)
            : null;
          if (!endTime || eventTime > endTime) {
            sessionsMap[item.session_id].endTime = item.event_at;
          }
        }
      }
    });

    Object.values(sessionsMap).forEach((session) => {
      // Only include sessions that have at least one game category event
      if (session.endTime) {
        const duration = new Date(session.endTime) - new Date(session.startTime);
        if (duration > 0) {
          sessionDurations.push(duration / 1000 / 60); // Convert to minutes
        }
      }
    });

    // Count event types
    data.forEach((item) => {
      if (item.event_type) {
        eventTypeCounts[item.event_type] = (eventTypeCounts[item.event_type] || 0) + 1;
      }
    });

    // Count colors
    data.forEach((item) => {
      if (item.game_color && item.game_color.trim() !== '') {
        const color = item.game_color.toLowerCase();
        colorFrequency[color] = (colorFrequency[color] || 0) + 1;
      }
    });

    // Calculate player participation by mode
    const playersByMode = { AR: new Set(), '2D': new Set() };
    
    Object.values(gamesMap).forEach((gameEvents) => {
      const sortedEvents = [...gameEvents].sort(
        (a, b) => new Date(a.event_at) - new Date(b.event_at)
      );
      
      const rawGameMode = sortedEvents.find((e) => e.game_mode)?.game_mode || null;
      const gameModeCategory = mapGameModeToCategory(rawGameMode);
      
      // Get unique player IDs for this game
      const gamePlayers = new Set();
      sortedEvents.forEach((event) => {
        if (event.player_id) {
          gamePlayers.add(event.player_id);
        }
      });
      
      // Add players to the appropriate mode set
      if (gameModeCategory === 'AR' || gameModeCategory === '2D') {
        gamePlayers.forEach((playerId) => {
          playersByMode[gameModeCategory].add(playerId);
        });
      }
    });

    // Count all unique sessions from the data - only sessions with games
    const uniqueSessions = new Set();
    data.forEach((item) => {
      // Only count sessions that have game category events (game_reference)
      if (item.session_id && item.game_reference && item.game_reference.trim() !== '') {
        uniqueSessions.add(item.session_id);
      }
    });

    // Calculate sessions per player - only sessions with games
    const sessionsPerPlayer = {};
    data.forEach((item) => {
      // Only count sessions that have game category events (game_reference)
      if (item.player_id && item.session_id && item.game_reference && item.game_reference.trim() !== '') {
        if (!sessionsPerPlayer[item.player_id]) {
          sessionsPerPlayer[item.player_id] = new Set();
        }
        sessionsPerPlayer[item.player_id].add(item.session_id);
      }
    });
    // Convert to array of session counts
    const sessionsPerPlayerCounts = Object.values(sessionsPerPlayer).map(
      (sessionSet) => sessionSet.size
    );

    // Calculate games per player
    const gamesPerPlayer = {};
    data.forEach((item) => {
      // Only count games that have game_reference
      if (item.player_id && item.game_reference && item.game_reference.trim() !== '') {
        if (!gamesPerPlayer[item.player_id]) {
          gamesPerPlayer[item.player_id] = new Set();
        }
        gamesPerPlayer[item.player_id].add(item.game_reference);
      }
    });
    // Convert to array of game counts
    const gamesPerPlayerCounts = Object.values(gamesPerPlayer).map(
      (gameSet) => gameSet.size
    );

    // Calculate player participation categories
    const playersAR = playersByMode.AR;
    const players2D = playersByMode['2D'];
    const playersBoth = new Set([...playersAR].filter((p) => players2D.has(p)));
    const playersAROnly = new Set([...playersAR].filter((p) => !players2D.has(p)));
    const players2DOnly = new Set([...players2D].filter((p) => !playersAR.has(p)));
    const totalPlayers = new Set([...playersAR, ...players2D]);

    // Calculate max level per player by mode
    const maxLevelPerPlayer = { AR: {}, '2D': {} };
    const avgLevelPerGame = { AR: [], '2D': [] };
    const responseTimeByLevel = { AR: {}, '2D': {} };
    const playerMaxLevels = { AR: {}, '2D': {} };

    Object.values(gamesMap).forEach((gameEvents) => {
      const sortedEvents = [...gameEvents].sort(
        (a, b) => new Date(a.event_at) - new Date(b.event_at)
      );
      
      const rawGameMode = sortedEvents.find((e) => e.game_mode)?.game_mode || null;
      const gameModeCategory = mapGameModeToCategory(rawGameMode);
      
      if (gameModeCategory !== 'AR' && gameModeCategory !== '2D') return;

      // Get game level (max level reached in this game)
      const gameLevels = sortedEvents
        .map((e) => e.game_level)
        .filter((l) => l !== null && l !== undefined && l > 0);
      
      if (gameLevels.length > 0) {
        const maxLevel = Math.max(...gameLevels);
        avgLevelPerGame[gameModeCategory].push(maxLevel);
      }

      // Track max level per player
      const gamePlayers = new Set();
      sortedEvents.forEach((event) => {
        if (event.player_id) {
          gamePlayers.add(event.player_id);
          const level = event.game_level;
          if (level !== null && level !== undefined && level > 0) {
            if (!playerMaxLevels[gameModeCategory][event.player_id]) {
              playerMaxLevels[gameModeCategory][event.player_id] = level;
            } else {
              playerMaxLevels[gameModeCategory][event.player_id] = Math.max(
                playerMaxLevels[gameModeCategory][event.player_id],
                level
              );
            }
          }
        }
      });

      // Track response time by level
      const eventsByLevel = {};
      sortedEvents.forEach((event, index) => {
        const level = event.game_level !== null && event.game_level !== undefined ? event.game_level : 'unknown';
        if (level !== 'unknown' && level > 0) {
          if (!eventsByLevel[level]) {
            eventsByLevel[level] = [];
          }
          eventsByLevel[level].push({ ...event, originalIndex: index });
        }
      });

      Object.keys(eventsByLevel).forEach((level) => {
        const levelNum = Number(level);
        if (levelNum <= 0) return;

        const levelEvents = eventsByLevel[level];
        const isAR = gameModeCategory === 'AR';
        const currentLevel = levelNum;

        // Find last Simon event
        let lastSimonEvent = null;
        if (isAR) {
          for (let i = levelEvents.length - 1; i >= 0; i--) {
            if (levelEvents[i].event_type === 'simon_select_end') {
              lastSimonEvent = levelEvents[i];
              break;
            }
          }
        } else {
          for (let i = levelEvents.length - 1; i >= 0; i--) {
            if (levelEvents[i].event_type === 'simon_select') {
              lastSimonEvent = levelEvents[i];
              break;
            }
          }
        }

        if (lastSimonEvent) {
          const lastSimonIndex = lastSimonEvent.originalIndex;
          let endEvent = null;

          for (let i = lastSimonIndex + 1; i < sortedEvents.length; i++) {
            const event = sortedEvents[i];
            if (event.event_type === 'level_complete' && event.game_level === currentLevel + 1) {
              endEvent = event;
              break;
            }
          }

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
              if (!responseTimeByLevel[gameModeCategory][currentLevel]) {
                responseTimeByLevel[gameModeCategory][currentLevel] = [];
              }
              responseTimeByLevel[gameModeCategory][currentLevel].push(duration / 1000);
            }
          }
        }
      });
    });

    // Convert player max levels to arrays
    const maxLevelPerPlayerAR = Object.values(playerMaxLevels.AR);
    const maxLevelPerPlayer2D = Object.values(playerMaxLevels['2D']);

    // Calculate players performing better in AR vs 2D
    let playersBetterInAR = 0;
    let playersBetterIn2D = 0;
    const playersWithBoth = new Set([...playersAR].filter((p) => players2D.has(p)));
    
    playersWithBoth.forEach((playerId) => {
      const arMax = playerMaxLevels.AR[playerId] || 0;
      const twoDMax = playerMaxLevels['2D'][playerId] || 0;
      if (arMax > twoDMax) {
        playersBetterInAR++;
      } else if (twoDMax > arMax) {
        playersBetterIn2D++;
      }
    });

    return {
      responseTimes,
      responseTimesByMode,
      levels,
      levelsByMode,
      sessionDurations,
      eventTypeCounts,
      colorFrequency,
      gameModeCounts,
      gameOutcomes,
      playerParticipation: {
        totalPlayers: totalPlayers.size,
        playersBoth: playersBoth.size,
        playersAROnly: playersAROnly.size,
        players2DOnly: players2DOnly.size,
        totalSessions: uniqueSessions.size,
        totalValidGames: gamesWithSimonSelect.size,
        sessionsPerPlayerCounts,
        gamesPerPlayerCounts,
      },
      maxLevelPerPlayerAR,
      maxLevelPerPlayer2D,
      avgLevelPerGame,
      responseTimeByLevel,
      playersBetterInAR,
      playersBetterIn2D,
      playersWithBothCount: playersWithBoth.size,
    };
  }, [data]);

  // Prepare chart data
  const chartData = useMemo(() => {
    if (!analysisData) return null;

    // Response time statistics
    const responseTimeStats = {
      mean: calculateMean(analysisData.responseTimes),
      median: calculateMedian(analysisData.responseTimes),
      mode: calculateMode(analysisData.responseTimes),
      stdDev: calculateStandardDeviation(analysisData.responseTimes),
      variance: calculateVariance(analysisData.responseTimes),
    };

    // Level statistics
    const levelStats = {
      mean: calculateMean(analysisData.levels),
      median: calculateMedian(analysisData.levels),
      mode: calculateMode(analysisData.levels),
      stdDev: calculateStandardDeviation(analysisData.levels),
      variance: calculateVariance(analysisData.levels),
    };

    // Session duration statistics
    const sessionStats = {
      mean: calculateMean(analysisData.sessionDurations),
      median: calculateMedian(analysisData.sessionDurations),
      mode: calculateMode(analysisData.sessionDurations),
      stdDev: calculateStandardDeviation(analysisData.sessionDurations),
      variance: calculateVariance(analysisData.sessionDurations),
    };

    // Event type frequency (top 10)
    const eventTypeData = Object.entries(analysisData.eventTypeCounts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);

    // Color frequency
    const colorData = Object.entries(analysisData.colorFrequency)
      .map(([name, value]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), value }))
      .sort((a, b) => b.value - a.value);

    // Game mode comparison
    const gameModeData = [
      { name: 'AR', value: analysisData.gameModeCounts.AR },
      { name: '2D', value: analysisData.gameModeCounts['2D'] },
    ];

    // Game outcomes
    const gameOutcomesData = Object.entries(analysisData.gameOutcomes)
      .map(([name, value]) => ({ name, value }));

    // Response time by mode
    const responseTimeByModeData = [
      {
        mode: 'AR',
        mean: calculateMean(analysisData.responseTimesByMode.AR),
        median: calculateMedian(analysisData.responseTimesByMode.AR),
      },
      {
        mode: '2D',
        mean: calculateMean(analysisData.responseTimesByMode['2D']),
        median: calculateMedian(analysisData.responseTimesByMode['2D']),
      },
    ];

    // Histogram data for response times (bins)
    const createHistogramData = (values, bins = 20) => {
      if (values.length === 0) return [];
      const validValues = values.filter(v => !isNaN(v) && isFinite(v));
      if (validValues.length === 0) return [];
      const min = Math.min(...validValues);
      const max = Math.max(...validValues);
      if (min === max) {
        // All values are the same, create a single bin
        return [{
          range: `${min.toFixed(1)}`,
          count: validValues.length,
          min: min,
          max: max,
        }];
      }
      const binWidth = (max - min) / bins;
      const histogram = Array(bins).fill(0).map((_, i) => ({
        range: `${(min + i * binWidth).toFixed(1)}-${(min + (i + 1) * binWidth).toFixed(1)}`,
        count: 0,
        min: min + i * binWidth,
        max: min + (i + 1) * binWidth,
      }));

      validValues.forEach((val) => {
        const binIndex = Math.min(Math.floor((val - min) / binWidth), bins - 1);
        if (binIndex >= 0 && binIndex < histogram.length) {
          histogram[binIndex].count++;
        }
      });

      return histogram;
    };

    const responseTimeHistogram = createHistogramData(analysisData.responseTimes, 15);
    const levelHistogram = createHistogramData(analysisData.levels, 10);
    
    // Create histogram for sessions per player with whole number bins
    const createSessionsHistogram = (values) => {
      if (values.length === 0) return [];
      const validValues = values.filter(v => !isNaN(v) && isFinite(v) && Number.isInteger(v));
      if (validValues.length === 0) return [];
      const min = Math.min(...validValues);
      const max = Math.max(...validValues);
      
      // Count frequency of each session count
      const frequency = {};
      validValues.forEach((val) => {
        frequency[val] = (frequency[val] || 0) + 1;
      });
      
      // Create bins for each whole number from min to max
      const histogram = [];
      for (let i = min; i <= max; i++) {
        histogram.push({
          range: `${i}`,
          count: frequency[i] || 0,
          min: i,
          max: i,
        });
      }
      
      return histogram;
    };
    
    const sessionsPerPlayerHistogram = createSessionsHistogram(
      analysisData.playerParticipation.sessionsPerPlayerCounts
    );

    const gamesPerPlayerHistogram = createSessionsHistogram(
      analysisData.playerParticipation.gamesPerPlayerCounts
    );

    // Player participation pie chart data
    const playerParticipationData = [
      { name: 'AR-only', value: analysisData.playerParticipation.playersAROnly },
      { name: '2D-only', value: analysisData.playerParticipation.players2DOnly },
      { name: 'Both', value: analysisData.playerParticipation.playersBoth },
    ].filter((item) => item.value > 0); // Only include categories with players

    // Sessions per player statistics
    const sessionsPerPlayerStats = {
      mean: calculateMean(analysisData.playerParticipation.sessionsPerPlayerCounts),
      median: calculateMedian(analysisData.playerParticipation.sessionsPerPlayerCounts),
      stdDev: calculateStandardDeviation(analysisData.playerParticipation.sessionsPerPlayerCounts),
      min: analysisData.playerParticipation.sessionsPerPlayerCounts.length > 0 
        ? Math.min(...analysisData.playerParticipation.sessionsPerPlayerCounts) 
        : 0,
      max: analysisData.playerParticipation.sessionsPerPlayerCounts.length > 0 
        ? Math.max(...analysisData.playerParticipation.sessionsPerPlayerCounts) 
        : 0,
    };

    // Box plot data for sessions per player
    const sessionsPerPlayerBoxPlot = [{
      name: 'Sessions per Player',
      min: sessionsPerPlayerStats.min,
      q1: calculatePercentile(analysisData.playerParticipation.sessionsPerPlayerCounts, 25),
      median: sessionsPerPlayerStats.median,
      q3: calculatePercentile(analysisData.playerParticipation.sessionsPerPlayerCounts, 75),
      max: sessionsPerPlayerStats.max,
      mean: sessionsPerPlayerStats.mean,
    }];

    // Games per player statistics
    const gamesPerPlayerStats = {
      mean: calculateMean(analysisData.playerParticipation.gamesPerPlayerCounts),
      median: calculateMedian(analysisData.playerParticipation.gamesPerPlayerCounts),
      stdDev: calculateStandardDeviation(analysisData.playerParticipation.gamesPerPlayerCounts),
      min: analysisData.playerParticipation.gamesPerPlayerCounts.length > 0 
        ? Math.min(...analysisData.playerParticipation.gamesPerPlayerCounts) 
        : 0,
      max: analysisData.playerParticipation.gamesPerPlayerCounts.length > 0 
        ? Math.max(...analysisData.playerParticipation.gamesPerPlayerCounts) 
        : 0,
    };

    // Box plot data for games per player
    const gamesPerPlayerBoxPlot = [{
      name: 'Games per Player',
      min: gamesPerPlayerStats.min,
      q1: calculatePercentile(analysisData.playerParticipation.gamesPerPlayerCounts, 25),
      median: gamesPerPlayerStats.median,
      q3: calculatePercentile(analysisData.playerParticipation.gamesPerPlayerCounts, 75),
      max: gamesPerPlayerStats.max,
      mean: gamesPerPlayerStats.mean,
    }];

    // Game mode performance data
    const gameModePerformance = {
      maxLevelPerPlayer: {
        AR: {
          mean: calculateMean(analysisData.maxLevelPerPlayerAR),
          median: calculateMedian(analysisData.maxLevelPerPlayerAR),
          stdDev: calculateStandardDeviation(analysisData.maxLevelPerPlayerAR),
        },
        '2D': {
          mean: calculateMean(analysisData.maxLevelPerPlayer2D),
          median: calculateMedian(analysisData.maxLevelPerPlayer2D),
          stdDev: calculateStandardDeviation(analysisData.maxLevelPerPlayer2D),
        },
      },
      avgLevelPerGame: {
        AR: {
          mean: calculateMean(analysisData.avgLevelPerGame.AR),
          median: calculateMedian(analysisData.avgLevelPerGame.AR),
          stdDev: calculateStandardDeviation(analysisData.avgLevelPerGame.AR),
        },
        '2D': {
          mean: calculateMean(analysisData.avgLevelPerGame['2D']),
          median: calculateMedian(analysisData.avgLevelPerGame['2D']),
          stdDev: calculateStandardDeviation(analysisData.avgLevelPerGame['2D']),
        },
      },
      playersBetterInAR: analysisData.playersBetterInAR,
      playersBetterIn2D: analysisData.playersBetterIn2D,
      playersWithBothCount: analysisData.playersWithBothCount,
    };

    // Game mode performance bar chart data
    const gameModePerformanceBarData = [
      {
        mode: 'AR',
        maxLevelMean: gameModePerformance.maxLevelPerPlayer.AR.mean,
        maxLevelMedian: gameModePerformance.maxLevelPerPlayer.AR.median,
        avgLevelMean: gameModePerformance.avgLevelPerGame.AR.mean,
        avgLevelMedian: gameModePerformance.avgLevelPerGame.AR.median,
      },
      {
        mode: '2D',
        maxLevelMean: gameModePerformance.maxLevelPerPlayer['2D'].mean,
        maxLevelMedian: gameModePerformance.maxLevelPerPlayer['2D'].median,
        avgLevelMean: gameModePerformance.avgLevelPerGame['2D'].mean,
        avgLevelMedian: gameModePerformance.avgLevelPerGame['2D'].median,
      },
    ];

    // Response time by level data
    const responseTimeByLevelData = [];
    const allLevels = new Set();
    Object.keys(analysisData.responseTimeByLevel.AR).forEach(l => allLevels.add(Number(l)));
    Object.keys(analysisData.responseTimeByLevel['2D']).forEach(l => allLevels.add(Number(l)));
    const sortedLevels = Array.from(allLevels).sort((a, b) => a - b);

    sortedLevels.forEach((level) => {
      const arTimes = analysisData.responseTimeByLevel.AR[level] || [];
      const twoDTimes = analysisData.responseTimeByLevel['2D'][level] || [];
      if (arTimes.length > 0 || twoDTimes.length > 0) {
        responseTimeByLevelData.push({
          level,
          arMean: arTimes.length > 0 ? calculateMean(arTimes) : null,
          twoDMean: twoDTimes.length > 0 ? calculateMean(twoDTimes) : null,
        });
      }
    });

    // Box plot data for response time by mode
    const responseTimeBoxPlot = [
      {
        name: 'AR',
        min: analysisData.responseTimesByMode.AR.length > 0 
          ? Math.min(...analysisData.responseTimesByMode.AR) 
          : 0,
        q1: calculatePercentile(analysisData.responseTimesByMode.AR, 25),
        median: calculateMedian(analysisData.responseTimesByMode.AR),
        q3: calculatePercentile(analysisData.responseTimesByMode.AR, 75),
        max: analysisData.responseTimesByMode.AR.length > 0 
          ? Math.max(...analysisData.responseTimesByMode.AR) 
          : 0,
        mean: calculateMean(analysisData.responseTimesByMode.AR),
      },
      {
        name: '2D',
        min: analysisData.responseTimesByMode['2D'].length > 0 
          ? Math.min(...analysisData.responseTimesByMode['2D']) 
          : 0,
        q1: calculatePercentile(analysisData.responseTimesByMode['2D'], 25),
        median: calculateMedian(analysisData.responseTimesByMode['2D']),
        q3: calculatePercentile(analysisData.responseTimesByMode['2D'], 75),
        max: analysisData.responseTimesByMode['2D'].length > 0 
          ? Math.max(...analysisData.responseTimesByMode['2D']) 
          : 0,
        mean: calculateMean(analysisData.responseTimesByMode['2D']),
      },
    ];

    // Response time statistics by mode
    const responseTimeStatsByMode = {
      AR: {
        mean: calculateMean(analysisData.responseTimesByMode.AR),
        median: calculateMedian(analysisData.responseTimesByMode.AR),
        stdDev: calculateStandardDeviation(analysisData.responseTimesByMode.AR),
        min: analysisData.responseTimesByMode.AR.length > 0 
          ? Math.min(...analysisData.responseTimesByMode.AR) 
          : 0,
        max: analysisData.responseTimesByMode.AR.length > 0 
          ? Math.max(...analysisData.responseTimesByMode.AR) 
          : 0,
      },
      '2D': {
        mean: calculateMean(analysisData.responseTimesByMode['2D']),
        median: calculateMedian(analysisData.responseTimesByMode['2D']),
        stdDev: calculateStandardDeviation(analysisData.responseTimesByMode['2D']),
        min: analysisData.responseTimesByMode['2D'].length > 0 
          ? Math.min(...analysisData.responseTimesByMode['2D']) 
          : 0,
        max: analysisData.responseTimesByMode['2D'].length > 0 
          ? Math.max(...analysisData.responseTimesByMode['2D']) 
          : 0,
      },
    };

    return {
      responseTimeStats,
      levelStats,
      sessionStats,
      eventTypeData,
      colorData,
      gameModeData,
      gameOutcomesData,
      responseTimeByModeData,
      responseTimeHistogram,
      levelHistogram,
      sessionsPerPlayerHistogram,
      playerParticipation: analysisData.playerParticipation,
      playerParticipationData,
      sessionsPerPlayerStats,
      sessionsPerPlayerBoxPlot,
      gamesPerPlayerHistogram,
      gamesPerPlayerStats,
      gamesPerPlayerBoxPlot,
      gameModePerformance,
      gameModePerformanceBarData,
      responseTimeByLevelData,
      responseTimeBoxPlot,
      responseTimeStatsByMode,
    };
  }, [analysisData]);

  const COLORS = ['#C41E3A', '#D4AF37', '#1A1A1A', '#6B7280', '#B91C1C'];

  if (loading) {
    return (
      <div className="descriptive-analysis-container">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="descriptive-analysis-container">
        <div className="error">{error}</div>
      </div>
    );
  }

  if (!chartData) {
    return (
      <div className="descriptive-analysis-container">
        <PageHeader title="Descriptive Analysis" />
        <div className="error">No data available for analysis</div>
      </div>
    );
  }

  return (
    <div className="descriptive-analysis-container">
      <PageHeader title="Descriptive Analysis" />

      {/* Game Mode Distribution */}
      <section className="analysis-section">
        <h2>Game Mode Distribution</h2>
        <div className="stats-grid">
          {chartData.gameModeData.map((mode, index) => (
            <div key={mode.name} className="stat-card">
              <div className="stat-label">Total Games in {mode.name} Mode</div>
              <div className="stat-value">{mode.value}</div>
            </div>
          ))}
        </div>
        <div className="chart-container">
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={chartData.gameModeData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {chartData.gameModeData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Player Engagement Overview */}
      <section className="analysis-section">
        <h2>Player Engagement Overview</h2>
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">Total Players</div>
            <div className="stat-value">{chartData.playerParticipation.totalPlayers}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Players (Both)</div>
            <div className="stat-value">{chartData.playerParticipation.playersBoth}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">AR-only Players</div>
            <div className="stat-value">{chartData.playerParticipation.playersAROnly}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">2D-only Players</div>
            <div className="stat-value">{chartData.playerParticipation.players2DOnly}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Total Sessions</div>
            <div className="stat-value">{chartData.playerParticipation.totalSessions}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Total Games</div>
            <div className="stat-value">{chartData.playerParticipation.totalValidGames}</div>
          </div>
        </div>
        <div className="chart-container">
          <h3>Players by Mode Participation</h3>
          {chartData.playerParticipationData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={chartData.playerParticipationData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {chartData.playerParticipationData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="no-data">No player participation data available</div>
          )}
        </div>
      </section>

      {/* Sessions per Player */}
      <section className="analysis-section">
        <h2>Sessions per Player</h2>
        <div className="chart-container">
          <h3>Distribution of Sessions per Player (Histogram)</h3>
          {chartData.sessionsPerPlayerHistogram.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData.sessionsPerPlayerHistogram}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="range" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#6B7280" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="no-data">No sessions per player data available</div>
          )}
        </div>
        <div className="chart-container">
          <h3>Statistical Summary: Sessions per Player</h3>
          {chartData.sessionsPerPlayerBoxPlot.length > 0 ? (
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '20px' }}>
              <thead>
                <tr style={{ backgroundColor: '#f3f4f6', borderBottom: '2px solid #d1d5db' }}>
                  <th style={{ padding: '12px', textAlign: 'left', border: '1px solid #d1d5db' }}>Metric</th>
                  <th style={{ padding: '12px', textAlign: 'right', border: '1px solid #d1d5db' }}>Min</th>
                  <th style={{ padding: '12px', textAlign: 'right', border: '1px solid #d1d5db' }}>Q1 (25th percentile)</th>
                  <th style={{ padding: '12px', textAlign: 'right', border: '1px solid #d1d5db' }}>Median</th>
                  <th style={{ padding: '12px', textAlign: 'right', border: '1px solid #d1d5db' }}>Q3 (75th percentile)</th>
                  <th style={{ padding: '12px', textAlign: 'right', border: '1px solid #d1d5db' }}>Max</th>
                  <th style={{ padding: '12px', textAlign: 'right', border: '1px solid #d1d5db' }}>Mean</th>
                  <th style={{ padding: '12px', textAlign: 'right', border: '1px solid #d1d5db' }}>SD</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ padding: '10px', border: '1px solid #d1d5db', fontWeight: '500' }}>Sessions per Player</td>
                  <td style={{ padding: '10px', textAlign: 'right', border: '1px solid #d1d5db' }}>{chartData.sessionsPerPlayerBoxPlot[0].min}</td>
                  <td style={{ padding: '10px', textAlign: 'right', border: '1px solid #d1d5db' }}>{chartData.sessionsPerPlayerBoxPlot[0].q1.toFixed(2)}</td>
                  <td style={{ padding: '10px', textAlign: 'right', border: '1px solid #d1d5db' }}>{chartData.sessionsPerPlayerBoxPlot[0].median.toFixed(2)}</td>
                  <td style={{ padding: '10px', textAlign: 'right', border: '1px solid #d1d5db' }}>{chartData.sessionsPerPlayerBoxPlot[0].q3.toFixed(2)}</td>
                  <td style={{ padding: '10px', textAlign: 'right', border: '1px solid #d1d5db' }}>{chartData.sessionsPerPlayerBoxPlot[0].max}</td>
                  <td style={{ padding: '10px', textAlign: 'right', border: '1px solid #d1d5db' }}>{chartData.sessionsPerPlayerBoxPlot[0].mean.toFixed(2)}</td>
                  <td style={{ padding: '10px', textAlign: 'right', border: '1px solid #d1d5db' }}>{chartData.sessionsPerPlayerStats.stdDev.toFixed(2)}</td>
                </tr>
              </tbody>
            </table>
          ) : (
            <div className="no-data">No data available</div>
          )}
        </div>
      </section>

      {/* Games per Player */}
      <section className="analysis-section">
        <h2>Games per Player</h2>
        <div className="chart-container">
          <h3>Distribution of Games per Player (Histogram)</h3>
          {chartData.gamesPerPlayerHistogram.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData.gamesPerPlayerHistogram}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="range" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#6B7280" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="no-data">No games per player data available</div>
          )}
        </div>
        <div className="chart-container">
          <h3>Statistical Summary: Games per Player</h3>
          {chartData.gamesPerPlayerBoxPlot.length > 0 ? (
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '20px' }}>
              <thead>
                <tr style={{ backgroundColor: '#f3f4f6', borderBottom: '2px solid #d1d5db' }}>
                  <th style={{ padding: '12px', textAlign: 'left', border: '1px solid #d1d5db' }}>Metric</th>
                  <th style={{ padding: '12px', textAlign: 'right', border: '1px solid #d1d5db' }}>Min</th>
                  <th style={{ padding: '12px', textAlign: 'right', border: '1px solid #d1d5db' }}>Q1 (25th percentile)</th>
                  <th style={{ padding: '12px', textAlign: 'right', border: '1px solid #d1d5db' }}>Median</th>
                  <th style={{ padding: '12px', textAlign: 'right', border: '1px solid #d1d5db' }}>Q3 (75th percentile)</th>
                  <th style={{ padding: '12px', textAlign: 'right', border: '1px solid #d1d5db' }}>Max</th>
                  <th style={{ padding: '12px', textAlign: 'right', border: '1px solid #d1d5db' }}>Mean</th>
                  <th style={{ padding: '12px', textAlign: 'right', border: '1px solid #d1d5db' }}>SD</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ padding: '10px', border: '1px solid #d1d5db', fontWeight: '500' }}>Games per Player</td>
                  <td style={{ padding: '10px', textAlign: 'right', border: '1px solid #d1d5db' }}>{chartData.gamesPerPlayerBoxPlot[0].min}</td>
                  <td style={{ padding: '10px', textAlign: 'right', border: '1px solid #d1d5db' }}>{chartData.gamesPerPlayerBoxPlot[0].q1.toFixed(2)}</td>
                  <td style={{ padding: '10px', textAlign: 'right', border: '1px solid #d1d5db' }}>{chartData.gamesPerPlayerBoxPlot[0].median.toFixed(2)}</td>
                  <td style={{ padding: '10px', textAlign: 'right', border: '1px solid #d1d5db' }}>{chartData.gamesPerPlayerBoxPlot[0].q3.toFixed(2)}</td>
                  <td style={{ padding: '10px', textAlign: 'right', border: '1px solid #d1d5db' }}>{chartData.gamesPerPlayerBoxPlot[0].max}</td>
                  <td style={{ padding: '10px', textAlign: 'right', border: '1px solid #d1d5db' }}>{chartData.gamesPerPlayerBoxPlot[0].mean.toFixed(2)}</td>
                  <td style={{ padding: '10px', textAlign: 'right', border: '1px solid #d1d5db' }}>{chartData.gamesPerPlayerStats.stdDev.toFixed(2)}</td>
                </tr>
              </tbody>
            </table>
          ) : (
            <div className="no-data">No data available</div>
          )}
        </div>
      </section>

      {/* Game Mode Performance */}
      <section className="analysis-section">
        <h2>Game Mode Performance (AR vs 2D)</h2>
        <div className="chart-container">
          <h3>Max Level & Avg Level per Game (Grouped Bar Chart)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData.gameModePerformanceBarData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="mode" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="maxLevelMean" fill="#C41E3A" name="Max Level (Mean)" />
              <Bar dataKey="maxLevelMedian" fill="#D4AF37" name="Max Level (Median)" />
              <Bar dataKey="avgLevelMean" fill="#1A1A1A" name="Avg Level (Mean)" />
              <Bar dataKey="avgLevelMedian" fill="#6B7280" name="Avg Level (Median)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="chart-container">
          <h3>Game Mode Performance Data Table</h3>
          {chartData.gameModePerformanceBarData.length > 0 ? (
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '20px' }}>
              <thead>
                <tr style={{ backgroundColor: '#f3f4f6', borderBottom: '2px solid #d1d5db' }}>
                  <th style={{ padding: '12px', textAlign: 'left', border: '1px solid #d1d5db' }}>Mode</th>
                  <th style={{ padding: '12px', textAlign: 'right', border: '1px solid #d1d5db' }}>Max Level (Mean)</th>
                  <th style={{ padding: '12px', textAlign: 'right', border: '1px solid #d1d5db' }}>Max Level (Median)</th>
                  <th style={{ padding: '12px', textAlign: 'right', border: '1px solid #d1d5db' }}>Avg Level (Mean)</th>
                  <th style={{ padding: '12px', textAlign: 'right', border: '1px solid #d1d5db' }}>Avg Level (Median)</th>
                </tr>
              </thead>
              <tbody>
                {chartData.gameModePerformanceBarData.map((row, index) => (
                  <tr key={row.mode} style={{ backgroundColor: index % 2 === 0 ? '#ffffff' : '#f9fafb' }}>
                    <td style={{ padding: '10px', border: '1px solid #d1d5db', fontWeight: '500' }}>{row.mode}</td>
                    <td style={{ padding: '10px', textAlign: 'right', border: '1px solid #d1d5db' }}>{row.maxLevelMean.toFixed(2)}</td>
                    <td style={{ padding: '10px', textAlign: 'right', border: '1px solid #d1d5db' }}>{row.maxLevelMedian.toFixed(2)}</td>
                    <td style={{ padding: '10px', textAlign: 'right', border: '1px solid #d1d5db' }}>{row.avgLevelMean.toFixed(2)}</td>
                    <td style={{ padding: '10px', textAlign: 'right', border: '1px solid #d1d5db' }}>{row.avgLevelMedian.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="no-data">No game mode performance data available</div>
          )}
        </div>
      </section>

      {/* Response Time per Level */}
      <section className="analysis-section">
        <h2>Response Time per Level</h2>
        <div className="chart-container">
          <h3>Average Response Time by Level (AR vs 2D)</h3>
          {chartData.responseTimeByLevelData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData.responseTimeByLevelData} margin={{ top: 5, right: 30, left: 0, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="level" label={{ value: 'Level', position: 'insideBottom', offset: -5 }} />
                <YAxis label={{ value: 'Response Time (seconds)', angle: -90, position: 'insideLeft', offset: 10, style: { textAnchor: 'middle' } }} />
                <Tooltip />
                <Legend verticalAlign="bottom" align="center" wrapperStyle={{ paddingTop: '20px' }} />
                <Line 
                  type="monotone" 
                  dataKey="arMean" 
                  stroke="#C41E3A" 
                  name="AR Mean" 
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  connectNulls
                />
                <Line 
                  type="monotone" 
                  dataKey="twoDMean" 
                  stroke="#D4AF37" 
                  name="2D Mean" 
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="no-data">No response time by level data available</div>
          )}
        </div>
        <div className="chart-container">
          <h3>Statistical Summary: Response Time by Mode</h3>
          {chartData.responseTimeBoxPlot.length > 0 ? (
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '20px' }}>
              <thead>
                <tr style={{ backgroundColor: '#f3f4f6', borderBottom: '2px solid #d1d5db' }}>
                  <th style={{ padding: '12px', textAlign: 'left', border: '1px solid #d1d5db' }}>Metric</th>
                  <th style={{ padding: '12px', textAlign: 'right', border: '1px solid #d1d5db' }}>Min</th>
                  <th style={{ padding: '12px', textAlign: 'right', border: '1px solid #d1d5db' }}>Q1 (25th percentile)</th>
                  <th style={{ padding: '12px', textAlign: 'right', border: '1px solid #d1d5db' }}>Median</th>
                  <th style={{ padding: '12px', textAlign: 'right', border: '1px solid #d1d5db' }}>Q3 (75th percentile)</th>
                  <th style={{ padding: '12px', textAlign: 'right', border: '1px solid #d1d5db' }}>Max</th>
                  <th style={{ padding: '12px', textAlign: 'right', border: '1px solid #d1d5db' }}>Mean</th>
                  <th style={{ padding: '12px', textAlign: 'right', border: '1px solid #d1d5db' }}>SD</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ padding: '10px', border: '1px solid #d1d5db', fontWeight: '500' }}>AR Mode</td>
                  <td style={{ padding: '10px', textAlign: 'right', border: '1px solid #d1d5db' }}>{chartData.responseTimeBoxPlot[0].min.toFixed(2)}</td>
                  <td style={{ padding: '10px', textAlign: 'right', border: '1px solid #d1d5db' }}>{chartData.responseTimeBoxPlot[0].q1.toFixed(2)}</td>
                  <td style={{ padding: '10px', textAlign: 'right', border: '1px solid #d1d5db' }}>{chartData.responseTimeBoxPlot[0].median.toFixed(2)}</td>
                  <td style={{ padding: '10px', textAlign: 'right', border: '1px solid #d1d5db' }}>{chartData.responseTimeBoxPlot[0].q3.toFixed(2)}</td>
                  <td style={{ padding: '10px', textAlign: 'right', border: '1px solid #d1d5db' }}>{chartData.responseTimeBoxPlot[0].max.toFixed(2)}</td>
                  <td style={{ padding: '10px', textAlign: 'right', border: '1px solid #d1d5db' }}>{chartData.responseTimeBoxPlot[0].mean.toFixed(2)}</td>
                  <td style={{ padding: '10px', textAlign: 'right', border: '1px solid #d1d5db' }}>{chartData.responseTimeStatsByMode.AR.stdDev.toFixed(2)}</td>
                </tr>
                <tr style={{ backgroundColor: '#f9fafb' }}>
                  <td style={{ padding: '10px', border: '1px solid #d1d5db', fontWeight: '500' }}>2D Mode</td>
                  <td style={{ padding: '10px', textAlign: 'right', border: '1px solid #d1d5db' }}>{chartData.responseTimeBoxPlot[1].min.toFixed(2)}</td>
                  <td style={{ padding: '10px', textAlign: 'right', border: '1px solid #d1d5db' }}>{chartData.responseTimeBoxPlot[1].q1.toFixed(2)}</td>
                  <td style={{ padding: '10px', textAlign: 'right', border: '1px solid #d1d5db' }}>{chartData.responseTimeBoxPlot[1].median.toFixed(2)}</td>
                  <td style={{ padding: '10px', textAlign: 'right', border: '1px solid #d1d5db' }}>{chartData.responseTimeBoxPlot[1].q3.toFixed(2)}</td>
                  <td style={{ padding: '10px', textAlign: 'right', border: '1px solid #d1d5db' }}>{chartData.responseTimeBoxPlot[1].max.toFixed(2)}</td>
                  <td style={{ padding: '10px', textAlign: 'right', border: '1px solid #d1d5db' }}>{chartData.responseTimeBoxPlot[1].mean.toFixed(2)}</td>
                  <td style={{ padding: '10px', textAlign: 'right', border: '1px solid #d1d5db' }}>{chartData.responseTimeStatsByMode['2D'].stdDev.toFixed(2)}</td>
                </tr>
              </tbody>
            </table>
          ) : (
            <div className="no-data">No response time data available</div>
          )}
        </div>
      </section>
    </div>
  );
};

export default DescriptiveAnalysis;


