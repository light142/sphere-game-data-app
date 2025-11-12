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
    const sessionsMap = {};
    data.forEach((item) => {
      if (item.session_id) {
        if (!sessionsMap[item.session_id]) {
          sessionsMap[item.session_id] = {
            startTime: item.event_at,
            endTime: item.event_at,
          };
        } else {
          const eventTime = new Date(item.event_at);
          const startTime = new Date(sessionsMap[item.session_id].startTime);
          const endTime = new Date(sessionsMap[item.session_id].endTime);
          if (eventTime < startTime) {
            sessionsMap[item.session_id].startTime = item.event_at;
          }
          if (eventTime > endTime) {
            sessionsMap[item.session_id].endTime = item.event_at;
          }
        }
      }
    });

    Object.values(sessionsMap).forEach((session) => {
      const duration = new Date(session.endTime) - new Date(session.startTime);
      if (duration > 0) {
        sessionDurations.push(duration / 1000 / 60); // Convert to minutes
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

      {/* Response Time Statistics */}
      <section className="analysis-section">
        <h2>Response Time Statistics (seconds)</h2>
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">Mean</div>
            <div className="stat-value">{chartData.responseTimeStats.mean.toFixed(2)}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Median</div>
            <div className="stat-value">{chartData.responseTimeStats.median.toFixed(2)}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Mode</div>
            <div className="stat-value">{chartData.responseTimeStats.mode !== null ? chartData.responseTimeStats.mode.toFixed(2) : 'N/A'}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Standard Deviation</div>
            <div className="stat-value">{chartData.responseTimeStats.stdDev.toFixed(2)}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Variance</div>
            <div className="stat-value">{chartData.responseTimeStats.variance.toFixed(2)}</div>
          </div>
        </div>

        <div className="chart-container">
          <h3>Response Time Distribution (Histogram)</h3>
          {chartData.responseTimeHistogram.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData.responseTimeHistogram}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="range" angle={-45} textAnchor="end" height={80} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#C41E3A" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="no-data">No response time data available</div>
          )}
        </div>

        <div className="chart-container">
          <h3>Response Time by Game Mode</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData.responseTimeByModeData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="mode" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="mean" fill="#C41E3A" name="Mean" />
              <Bar dataKey="median" fill="#D4AF37" name="Median" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Level Statistics */}
      <section className="analysis-section">
        <h2>Level Statistics</h2>
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">Mean</div>
            <div className="stat-value">{chartData.levelStats.mean.toFixed(2)}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Median</div>
            <div className="stat-value">{chartData.levelStats.median.toFixed(2)}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Mode</div>
            <div className="stat-value">{chartData.levelStats.mode !== null ? chartData.levelStats.mode.toFixed(0) : 'N/A'}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Standard Deviation</div>
            <div className="stat-value">{chartData.levelStats.stdDev.toFixed(2)}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Variance</div>
            <div className="stat-value">{chartData.levelStats.variance.toFixed(2)}</div>
          </div>
        </div>

        <div className="chart-container">
          <h3>Level Distribution (Histogram)</h3>
          {chartData.levelHistogram.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData.levelHistogram}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="range" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#D4AF37" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="no-data">No level data available</div>
          )}
        </div>
      </section>

      {/* Session Duration Statistics */}
      <section className="analysis-section">
        <h2>Session Duration Statistics (minutes)</h2>
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">Mean</div>
            <div className="stat-value">{chartData.sessionStats.mean.toFixed(2)}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Median</div>
            <div className="stat-value">{chartData.sessionStats.median.toFixed(2)}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Mode</div>
            <div className="stat-value">{chartData.sessionStats.mode !== null ? chartData.sessionStats.mode.toFixed(2) : 'N/A'}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Standard Deviation</div>
            <div className="stat-value">{chartData.sessionStats.stdDev.toFixed(2)}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Variance</div>
            <div className="stat-value">{chartData.sessionStats.variance.toFixed(2)}</div>
          </div>
        </div>
      </section>

      {/* Event Type Frequency */}
      <section className="analysis-section">
        <h2>Event Type Frequency (Top 10)</h2>
        <div className="chart-container">
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={chartData.eventTypeData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis dataKey="name" type="category" width={150} />
              <Tooltip />
              <Bar dataKey="value" fill="#C41E3A" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Color Frequency */}
      <section className="analysis-section">
        <h2>Color Selection Frequency</h2>
        <div className="chart-container">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData.colorData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" fill="#D4AF37" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Game Mode Distribution */}
      <section className="analysis-section">
        <h2>Game Mode Distribution</h2>
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

      {/* Game Outcomes */}
      <section className="analysis-section">
        <h2>Game Outcomes</h2>
        <div className="chart-container">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData.gameOutcomesData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" fill="#1A1A1A" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
};

export default DescriptiveAnalysis;

