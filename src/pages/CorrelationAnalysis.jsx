/**
 * Correlation Analysis Page
 * Pearson's and Spearman's correlation
 */

import { useMemo } from 'react';
import { useGameData } from '../contexts/GameDataContext';
import { mapGameModeToCategory } from '../config';
import LoadingSpinner from '../components/LoadingSpinner';
import PageHeader from '../components/PageHeader';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import '../styles/CorrelationAnalysis.css';

const CorrelationAnalysis = () => {
  const { data, loading, error } = useGameData();

  // Process data for correlation analysis
  const processedData = useMemo(() => {
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

    // Process games
    const gamesMap = {};
    data.forEach((item) => {
      if (item.game_reference && item.game_reference.trim() !== '' && gamesWithSimonSelect.has(item.game_reference)) {
        if (!gamesMap[item.game_reference]) {
          gamesMap[item.game_reference] = [];
        }
        gamesMap[item.game_reference].push(item);
      }
    });

    // Data for correlations
    const responseTimeLevelPairs = []; // { responseTime, level }
    const sessionDurationMaxLevelPairs = []; // { sessionDuration, maxLevel }
    const playerStats = {}; // { playerId: { gamesCount, maxLevel } }

    // Process sessions
    const sessionsMap = {};
    data.forEach((item) => {
      if (item.session_id) {
        if (!sessionsMap[item.session_id]) {
          sessionsMap[item.session_id] = {
            playerId: item.player_id,
            startTime: item.event_at,
            endTime: item.event_at,
            games: new Set(),
            maxLevel: 0,
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

        if (item.game_reference && item.game_reference.trim() !== '') {
          sessionsMap[item.session_id].games.add(item.game_reference);
        }

        if (item.game_level !== null && item.game_level !== undefined && item.game_level > 0) {
          sessionsMap[item.session_id].maxLevel = Math.max(
            sessionsMap[item.session_id].maxLevel,
            item.game_level
          );
        }
      }
    });

    // Process each game for response time vs level
    Object.values(gamesMap).forEach((gameEvents) => {
      const sortedEvents = [...gameEvents].sort(
        (a, b) => new Date(a.event_at) - new Date(b.event_at)
      );

      const rawGameMode = sortedEvents.find((e) => e.game_mode)?.game_mode || null;
      const gameModeCategory = mapGameModeToCategory(rawGameMode) || 'Unknown';

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
        if (level === 'unknown' || Number(level) <= 0) return;

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
              responseTimeLevelPairs.push({
                responseTime: duration / 1000, // seconds
                level: currentLevel,
              });
            }
          }
        }
      });
    });

    // Process sessions for duration vs max level
    Object.values(sessionsMap).forEach((session) => {
      const duration = new Date(session.endTime) - new Date(session.startTime);
      if (duration > 0 && session.maxLevel > 0) {
        sessionDurationMaxLevelPairs.push({
          sessionDuration: duration / 1000 / 60, // minutes
          maxLevel: session.maxLevel,
        });
      }

      // Track player stats
      if (session.playerId) {
        if (!playerStats[session.playerId]) {
          playerStats[session.playerId] = {
            gamesCount: 0,
            maxLevel: 0,
          };
        }
        playerStats[session.playerId].gamesCount += session.games.size;
        playerStats[session.playerId].maxLevel = Math.max(
          playerStats[session.playerId].maxLevel,
          session.maxLevel
        );
      }
    });

    // Player stats for Spearman correlation
    const playerGamesLevelPairs = Object.values(playerStats)
      .filter(p => p.gamesCount > 0 && p.maxLevel > 0)
      .map(p => ({
        gamesCount: p.gamesCount,
        maxLevel: p.maxLevel,
      }));

    return {
      responseTimeLevelPairs,
      sessionDurationMaxLevelPairs,
      playerGamesLevelPairs,
    };
  }, [data]);

  // Calculate mean
  const calculateMean = (values) => {
    if (!values || values.length === 0) return 0;
    const validValues = values.filter(v => !isNaN(v) && isFinite(v));
    if (validValues.length === 0) return 0;
    return validValues.reduce((acc, val) => acc + val, 0) / validValues.length;
  };

  // Calculate standard deviation
  const calculateStdDev = (values) => {
    if (!values || values.length === 0) return 0;
    const validValues = values.filter(v => !isNaN(v) && isFinite(v));
    if (validValues.length === 0) return 0;
    const mean = calculateMean(validValues);
    const squaredDiffs = validValues.map((val) => Math.pow(val - mean, 2));
    const variance = calculateMean(squaredDiffs);
    return Math.sqrt(variance);
  };

  // Pearson's Correlation
  const calculatePearsonCorrelation = (x, y) => {
    if (x.length !== y.length || x.length < 2) {
      return { error: 'Insufficient data for Pearson correlation (need at least 2 pairs)' };
    }

    const validPairs = [];
    for (let i = 0; i < x.length; i++) {
      if (!isNaN(x[i]) && !isNaN(y[i]) && isFinite(x[i]) && isFinite(y[i])) {
        validPairs.push({ x: x[i], y: y[i] });
      }
    }

    if (validPairs.length < 2) {
      return { error: 'Insufficient valid data for Pearson correlation' };
    }

    const xValues = validPairs.map(p => p.x);
    const yValues = validPairs.map(p => p.y);

    const meanX = calculateMean(xValues);
    const meanY = calculateMean(yValues);
    const stdDevX = calculateStdDev(xValues);
    const stdDevY = calculateStdDev(yValues);

    if (stdDevX === 0 || stdDevY === 0) {
      return { error: 'Cannot calculate correlation: one or both variables have zero variance' };
    }

    let covariance = 0;
    for (let i = 0; i < validPairs.length; i++) {
      covariance += (validPairs[i].x - meanX) * (validPairs[i].y - meanY);
    }
    covariance /= validPairs.length;

    const correlation = covariance / (stdDevX * stdDevY);

    // Calculate p-value (simplified)
    const n = validPairs.length;
    const t = correlation * Math.sqrt((n - 2) / (1 - correlation * correlation));
    const pValue = 2 * (1 - tCDF(Math.abs(t), n - 2));

    return {
      correlation: correlation,
      pValue: pValue,
      n: n,
      significant: pValue < 0.05,
      strength: getCorrelationStrength(Math.abs(correlation)),
    };
  };

  // Spearman's Rank Correlation
  const calculateSpearmanCorrelation = (x, y) => {
    if (x.length !== y.length || x.length < 2) {
      return { error: 'Insufficient data for Spearman correlation (need at least 2 pairs)' };
    }

    const validPairs = [];
    for (let i = 0; i < x.length; i++) {
      if (!isNaN(x[i]) && !isNaN(y[i]) && isFinite(x[i]) && isFinite(y[i])) {
        validPairs.push({ x: x[i], y: y[i], index: i });
      }
    }

    if (validPairs.length < 2) {
      return { error: 'Insufficient valid data for Spearman correlation' };
    }

    // Rank the values
    const xRanked = rankValues(validPairs.map(p => p.x));
    const yRanked = rankValues(validPairs.map(p => p.y));

    // Calculate Pearson correlation on ranks
    const meanX = calculateMean(xRanked);
    const meanY = calculateMean(yRanked);
    const stdDevX = calculateStdDev(xRanked);
    const stdDevY = calculateStdDev(yRanked);

    if (stdDevX === 0 || stdDevY === 0) {
      return { error: 'Cannot calculate correlation: one or both variables have zero variance' };
    }

    let covariance = 0;
    for (let i = 0; i < validPairs.length; i++) {
      covariance += (xRanked[i] - meanX) * (yRanked[i] - meanY);
    }
    covariance /= validPairs.length;

    const correlation = covariance / (stdDevX * stdDevY);

    // Calculate p-value
    const n = validPairs.length;
    const t = correlation * Math.sqrt((n - 2) / (1 - correlation * correlation));
    const pValue = 2 * (1 - tCDF(Math.abs(t), n - 2));

    return {
      correlation: correlation,
      pValue: pValue,
      n: n,
      significant: pValue < 0.05,
      strength: getCorrelationStrength(Math.abs(correlation)),
    };
  };

  // Rank values (handle ties)
  const rankValues = (values) => {
    const sorted = values.map((val, index) => ({ val, index })).sort((a, b) => a.val - b.val);
    const ranks = new Array(values.length);

    let currentRank = 1;
    for (let i = 0; i < sorted.length; i++) {
      if (i > 0 && sorted[i].val !== sorted[i - 1].val) {
        currentRank = i + 1;
      }
      ranks[sorted[i].index] = currentRank;
    }

    return ranks;
  };

  // t-distribution CDF approximation
  const tCDF = (t, df) => {
    if (df <= 0) return 0.5;
    const x = t / Math.sqrt(df);
    return normalCDF(x);
  };

  // Normal CDF approximation
  const normalCDF = (x) => {
    return 0.5 * (1 + erf(x / Math.sqrt(2)));
  };

  // Error function approximation
  const erf = (x) => {
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;

    const sign = x < 0 ? -1 : 1;
    x = Math.abs(x);

    const t = 1.0 / (1.0 + p * x);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

    return sign * y;
  };

  // Get correlation strength description
  const getCorrelationStrength = (absCorr) => {
    if (absCorr >= 0.9) return 'Very Strong';
    if (absCorr >= 0.7) return 'Strong';
    if (absCorr >= 0.5) return 'Moderate';
    if (absCorr >= 0.3) return 'Weak';
    return 'Very Weak';
  };

  // Calculate correlation results
  const correlationResults = useMemo(() => {
    if (!processedData) return null;

    // Pearson: Response Time vs Level
    const responseTimeLevelPearson = calculatePearsonCorrelation(
      processedData.responseTimeLevelPairs.map(p => p.level),
      processedData.responseTimeLevelPairs.map(p => p.responseTime)
    );

    // Pearson: Session Duration vs Max Level
    const sessionDurationMaxLevelPearson = calculatePearsonCorrelation(
      processedData.sessionDurationMaxLevelPairs.map(p => p.sessionDuration),
      processedData.sessionDurationMaxLevelPairs.map(p => p.maxLevel)
    );

    // Spearman: Games Count vs Max Level
    const gamesCountMaxLevelSpearman = calculateSpearmanCorrelation(
      processedData.playerGamesLevelPairs.map(p => p.gamesCount),
      processedData.playerGamesLevelPairs.map(p => p.maxLevel)
    );

    return {
      responseTimeLevelPearson,
      sessionDurationMaxLevelPearson,
      gamesCountMaxLevelSpearman,
    };
  }, [processedData]);

  if (loading) {
    return (
      <div className="correlation-analysis-container">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="correlation-analysis-container">
        <PageHeader title="Correlation Analysis" />
        <div className="error">{error}</div>
      </div>
    );
  }

  if (!processedData || !correlationResults) {
    return (
      <div className="correlation-analysis-container">
        <PageHeader title="Correlation Analysis" />
        <div className="error">No data available for correlation analysis</div>
      </div>
    );
  }

  return (
    <div className="correlation-analysis-container">
      <PageHeader title="Correlation Analysis" />

      {/* Pearson's Correlation: Response Time vs Level */}
      <section className="analysis-section">
        <h2>Pearson's Correlation: Response Time vs Level</h2>
        <p className="test-description">
          <strong>Research Question:</strong> Is there a linear relationship between game level and player response time?
        </p>
        
        {correlationResults.responseTimeLevelPearson.error ? (
          <div className="error-message">{correlationResults.responseTimeLevelPearson.error}</div>
        ) : (
          <>
            <div className="test-results">
              <div className="result-card">
                <div className="result-label">Correlation Coefficient (r)</div>
                <div className="result-value">{correlationResults.responseTimeLevelPearson.correlation.toFixed(4)}</div>
              </div>
              <div className="result-card">
                <div className="result-label">p-Value</div>
                <div className={`result-value ${correlationResults.responseTimeLevelPearson.significant ? 'significant' : 'not-significant'}`}>
                  {correlationResults.responseTimeLevelPearson.pValue.toFixed(4)}
                </div>
              </div>
              <div className="result-card">
                <div className="result-label">Sample Size (n)</div>
                <div className="result-value">{correlationResults.responseTimeLevelPearson.n}</div>
              </div>
              <div className="result-card">
                <div className="result-label">Strength</div>
                <div className="result-value">{correlationResults.responseTimeLevelPearson.strength}</div>
              </div>
            </div>

            <div className="interpretation">
              <strong>Interpretation:</strong> {correlationResults.responseTimeLevelPearson.significant ? (
                <span className="significant-text">
                  There is a statistically significant {correlationResults.responseTimeLevelPearson.strength.toLowerCase()} 
                  {' '}{correlationResults.responseTimeLevelPearson.correlation > 0 ? 'positive' : 'negative'} 
                  {' '}linear relationship between level and response time (p &lt; 0.05).
                </span>
              ) : (
                <span className="not-significant-text">
                  There is no statistically significant linear relationship between level and response time (p ≥ 0.05).
                </span>
              )}
            </div>

            <div className="chart-container">
              <h3>Response Time vs Level (Scatter Plot)</h3>
              {processedData.responseTimeLevelPairs.length > 0 ? (
                <ResponsiveContainer width="100%" height={500}>
                  <ScatterChart data={processedData.responseTimeLevelPairs} margin={{ top: 50, right: 30, bottom: 80, left: 80 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      type="number" 
                      dataKey="level" 
                      name="Level" 
                      label={{ value: 'Level', position: 'bottom', offset: 15, style: { textAnchor: 'middle' } }} 
                    />
                    <YAxis 
                      type="number" 
                      dataKey="responseTime" 
                      name="Response Time" 
                      label={{ value: 'Response Time (seconds)', angle: -90, position: 'left', offset: 15, style: { textAnchor: 'middle' } }} 
                    />
                    <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                    <Scatter name="Response Time" data={processedData.responseTimeLevelPairs} fill="#C41E3A" />
                  </ScatterChart>
                </ResponsiveContainer>
              ) : (
                <div className="no-data">No data available</div>
              )}
            </div>
          </>
        )}
      </section>

      {/* Pearson's Correlation: Session Duration vs Max Level */}
      <section className="analysis-section">
        <h2>Pearson's Correlation: Session Duration vs Max Level Reached</h2>
        <p className="test-description">
          <strong>Research Question:</strong> Is there a linear relationship between session duration and the maximum level reached?
        </p>
        
        {correlationResults.sessionDurationMaxLevelPearson.error ? (
          <div className="error-message">{correlationResults.sessionDurationMaxLevelPearson.error}</div>
        ) : (
          <>
            <div className="test-results">
              <div className="result-card">
                <div className="result-label">Correlation Coefficient (r)</div>
                <div className="result-value">{correlationResults.sessionDurationMaxLevelPearson.correlation.toFixed(4)}</div>
              </div>
              <div className="result-card">
                <div className="result-label">p-Value</div>
                <div className={`result-value ${correlationResults.sessionDurationMaxLevelPearson.significant ? 'significant' : 'not-significant'}`}>
                  {correlationResults.sessionDurationMaxLevelPearson.pValue.toFixed(4)}
                </div>
              </div>
              <div className="result-card">
                <div className="result-label">Sample Size (n)</div>
                <div className="result-value">{correlationResults.sessionDurationMaxLevelPearson.n}</div>
              </div>
              <div className="result-card">
                <div className="result-label">Strength</div>
                <div className="result-value">{correlationResults.sessionDurationMaxLevelPearson.strength}</div>
              </div>
            </div>

            <div className="interpretation">
              <strong>Interpretation:</strong> {correlationResults.sessionDurationMaxLevelPearson.significant ? (
                <span className="significant-text">
                  There is a statistically significant {correlationResults.sessionDurationMaxLevelPearson.strength.toLowerCase()} 
                  {' '}{correlationResults.sessionDurationMaxLevelPearson.correlation > 0 ? 'positive' : 'negative'} 
                  {' '}linear relationship between session duration and max level reached (p &lt; 0.05).
                </span>
              ) : (
                <span className="not-significant-text">
                  There is no statistically significant linear relationship between session duration and max level reached (p ≥ 0.05).
                </span>
              )}
            </div>

            <div className="chart-container">
              <h3>Session Duration vs Max Level (Scatter Plot)</h3>
              {processedData.sessionDurationMaxLevelPairs.length > 0 ? (
                <ResponsiveContainer width="100%" height={500}>
                  <ScatterChart data={processedData.sessionDurationMaxLevelPairs} margin={{ top: 50, right: 30, bottom: 80, left: 80 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      type="number" 
                      dataKey="sessionDuration" 
                      name="Session Duration" 
                      label={{ value: 'Session Duration (minutes)', position: 'bottom', offset: 15, style: { textAnchor: 'middle' } }} 
                    />
                    <YAxis 
                      type="number" 
                      dataKey="maxLevel" 
                      name="Max Level" 
                      label={{ value: 'Max Level Reached', angle: -90, position: 'left', offset: 15, style: { textAnchor: 'middle' } }} 
                    />
                    <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                    <Scatter name="Max Level" data={processedData.sessionDurationMaxLevelPairs} fill="#D4AF37" />
                  </ScatterChart>
                </ResponsiveContainer>
              ) : (
                <div className="no-data">No data available</div>
              )}
            </div>
          </>
        )}
      </section>

      {/* Spearman's Correlation: Games Count vs Max Level */}
      <section className="analysis-section">
        <h2>Spearman's Rank Correlation: Games Count vs Max Level</h2>
        <p className="test-description">
          <strong>Research Question:</strong> Is there a monotonic relationship between the number of games played and the maximum level reached?
        </p>
        
        {correlationResults.gamesCountMaxLevelSpearman.error ? (
          <div className="error-message">{correlationResults.gamesCountMaxLevelSpearman.error}</div>
        ) : (
          <>
            <div className="test-results">
              <div className="result-card">
                <div className="result-label">Correlation Coefficient (ρ)</div>
                <div className="result-value">{correlationResults.gamesCountMaxLevelSpearman.correlation.toFixed(4)}</div>
              </div>
              <div className="result-card">
                <div className="result-label">p-Value</div>
                <div className={`result-value ${correlationResults.gamesCountMaxLevelSpearman.significant ? 'significant' : 'not-significant'}`}>
                  {correlationResults.gamesCountMaxLevelSpearman.pValue.toFixed(4)}
                </div>
              </div>
              <div className="result-card">
                <div className="result-label">Sample Size (n)</div>
                <div className="result-value">{correlationResults.gamesCountMaxLevelSpearman.n}</div>
              </div>
              <div className="result-card">
                <div className="result-label">Strength</div>
                <div className="result-value">{correlationResults.gamesCountMaxLevelSpearman.strength}</div>
              </div>
            </div>

            <div className="interpretation">
              <strong>Interpretation:</strong> {correlationResults.gamesCountMaxLevelSpearman.significant ? (
                <span className="significant-text">
                  There is a statistically significant {correlationResults.gamesCountMaxLevelSpearman.strength.toLowerCase()} 
                  {' '}{correlationResults.gamesCountMaxLevelSpearman.correlation > 0 ? 'positive' : 'negative'} 
                  {' '}monotonic relationship between games count and max level (p &lt; 0.05).
                </span>
              ) : (
                <span className="not-significant-text">
                  There is no statistically significant monotonic relationship between games count and max level (p ≥ 0.05).
                </span>
              )}
            </div>

            <div className="chart-container">
              <h3>Games Count vs Max Level (Scatter Plot)</h3>
              {processedData.playerGamesLevelPairs.length > 0 ? (
                <ResponsiveContainer width="100%" height={500}>
                  <ScatterChart data={processedData.playerGamesLevelPairs} margin={{ top: 50, right: 30, bottom: 80, left: 80 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      type="number" 
                      dataKey="gamesCount" 
                      name="Games Count" 
                      label={{ value: 'Number of Games Played', position: 'bottom', offset: 15, style: { textAnchor: 'middle' } }} 
                    />
                    <YAxis 
                      type="number" 
                      dataKey="maxLevel" 
                      name="Max Level" 
                      label={{ value: 'Max Level Reached', angle: -90, position: 'left', offset: 15, style: { textAnchor: 'middle' } }} 
                    />
                    <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                    <Scatter name="Max Level" data={processedData.playerGamesLevelPairs} fill="#1A1A1A" />
                  </ScatterChart>
                </ResponsiveContainer>
              ) : (
                <div className="no-data">No data available</div>
              )}
            </div>
          </>
        )}
      </section>
    </div>
  );
};

export default CorrelationAnalysis;

