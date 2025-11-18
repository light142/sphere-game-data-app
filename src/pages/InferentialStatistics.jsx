/**
 * Statistical Analysis Page
 * Paired t-Test: AR vs 2D performance difference
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
  ReferenceLine,
} from 'recharts';
import '../styles/InferentialStatistics.css';

const InferentialStatistics = () => {
  const { data, loading, error } = useGameData();

  // Process data for paired t-test
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

    // Track player performance by mode
    const playerData = {}; // { playerId: { AR: { maxLevel, avgLevel, avgRT }, '2D': { maxLevel, avgLevel, avgRT } } }

    Object.values(gamesMap).forEach((gameEvents) => {
      const sortedEvents = [...gameEvents].sort(
        (a, b) => new Date(a.event_at) - new Date(b.event_at)
      );

      const rawGameMode = sortedEvents.find((e) => e.game_mode)?.game_mode || null;
      const gameModeCategory = mapGameModeToCategory(rawGameMode);
      
      if (gameModeCategory !== 'AR' && gameModeCategory !== '2D') return;

      // Get players in this game
      const gamePlayers = new Set();
      sortedEvents.forEach((event) => {
        if (event.player_id) {
          gamePlayers.add(event.player_id);
        }
      });

      // Get max level reached in this game
      const gameLevels = sortedEvents
        .map((e) => e.game_level)
        .filter((l) => l !== null && l !== undefined && l > 0);
      const maxLevel = gameLevels.length > 0 ? Math.max(...gameLevels) : 0;

      // Calculate response times for this game
      const responseTimes = [];
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

      const isAR = gameModeCategory === 'AR';
      Object.keys(eventsByLevel).forEach((level) => {
        const levelNum = Number(level);
        if (levelNum <= 0) return;

        const levelEvents = eventsByLevel[level];
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
              responseTimes.push(duration / 1000);
            }
          }
        }
      });

      const avgRT = responseTimes.length > 0 
        ? responseTimes.reduce((sum, rt) => sum + rt, 0) / responseTimes.length 
        : 0;

      // Update player data
      gamePlayers.forEach((playerId) => {
        if (!playerData[playerId]) {
          playerData[playerId] = { AR: { maxLevels: [], avgLevels: [], avgRTs: [] }, '2D': { maxLevels: [], avgLevels: [], avgRTs: [] } };
        }
        
        if (maxLevel > 0) {
          playerData[playerId][gameModeCategory].maxLevels.push(maxLevel);
          playerData[playerId][gameModeCategory].avgLevels.push(maxLevel);
        }
        if (avgRT > 0) {
          playerData[playerId][gameModeCategory].avgRTs.push(avgRT);
        }
      });
    });

    // Calculate paired data (players who played both modes)
    const pairedData = [];
    
    Object.keys(playerData).forEach((playerId) => {
      const player = playerData[playerId];
      const hasAR = player.AR.maxLevels.length > 0 || player.AR.avgRTs.length > 0;
      const has2D = player['2D'].maxLevels.length > 0 || player['2D'].avgRTs.length > 0;

      if (hasAR && has2D) {
        // Calculate averages for this player
        const arMaxLevel = player.AR.maxLevels.length > 0 
          ? Math.max(...player.AR.maxLevels) 
          : 0;
        const twoDMaxLevel = player['2D'].maxLevels.length > 0 
          ? Math.max(...player['2D'].maxLevels) 
          : 0;

        const arAvgLevel = player.AR.avgLevels.length > 0
          ? player.AR.avgLevels.reduce((sum, l) => sum + l, 0) / player.AR.avgLevels.length
          : 0;
        const twoDAvgLevel = player['2D'].avgLevels.length > 0
          ? player['2D'].avgLevels.reduce((sum, l) => sum + l, 0) / player['2D'].avgLevels.length
          : 0;

        const arAvgRT = player.AR.avgRTs.length > 0
          ? player.AR.avgRTs.reduce((sum, rt) => sum + rt, 0) / player.AR.avgRTs.length
          : 0;
        const twoDAvgRT = player['2D'].avgRTs.length > 0
          ? player['2D'].avgRTs.reduce((sum, rt) => sum + rt, 0) / player['2D'].avgRTs.length
          : 0;

        if (arMaxLevel > 0 && twoDMaxLevel > 0) {
          pairedData.push({
            playerId,
            arMaxLevel,
            twoDMaxLevel,
            arAvgLevel,
            twoDAvgLevel,
            arAvgRT: arAvgRT > 0 ? arAvgRT : null,
            twoDAvgRT: twoDAvgRT > 0 ? twoDAvgRT : null,
          });
        }
      }
    });

    return { pairedData };
  }, [data]);

  // Statistical functions
  const calculateMean = (values) => {
    if (!values || values.length === 0) return 0;
    const validValues = values.filter(v => v !== null && !isNaN(v) && isFinite(v));
    if (validValues.length === 0) return 0;
    return validValues.reduce((acc, val) => acc + val, 0) / validValues.length;
  };

  const calculateStdDev = (values) => {
    if (!values || values.length === 0) return 0;
    const validValues = values.filter(v => v !== null && !isNaN(v) && isFinite(v));
    if (validValues.length === 0) return 0;
    const mean = calculateMean(validValues);
    const squaredDiffs = validValues.map((val) => Math.pow(val - mean, 2));
    const variance = calculateMean(squaredDiffs);
    return Math.sqrt(variance);
  };

  const calculateMedian = (values) => {
    if (!values || values.length === 0) return 0;
    const validValues = values.filter(v => v !== null && !isNaN(v) && isFinite(v));
    if (validValues.length === 0) return 0;
    const sorted = [...validValues].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];
  };

  const calculatePercentile = (values, percentile) => {
    if (!values || values.length === 0) return 0;
    const validValues = values.filter(v => v !== null && !isNaN(v) && isFinite(v));
    if (validValues.length === 0) return 0;
    const sorted = [...validValues].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
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

  // t-distribution CDF approximation
  const tCDF = (t, df) => {
    if (df <= 0) return 0.5;
    // Simplified approximation for t-distribution
    const x = t / Math.sqrt(df);
    return normalCDF(x);
  };

  // Paired t-Test
  const performPairedTTest = (pairs, arKey, twoDKey) => {
    const differences = pairs
      .filter(p => p[arKey] !== null && p[twoDKey] !== null)
      .map(p => p[arKey] - p[twoDKey]);

    if (differences.length < 2) {
      return { error: 'Insufficient data for paired t-test (need at least 2 pairs)' };
    }

    const meanDiff = calculateMean(differences);
    const stdDevDiff = calculateStdDev(differences);
    const n = differences.length;

    if (stdDevDiff === 0) {
      return { error: 'Cannot calculate t-test: standard deviation of differences is zero' };
    }

    // Standard error of the mean difference
    const stdErr = stdDevDiff / Math.sqrt(n);

    // t-statistic
    const t = meanDiff / stdErr;

    // Degrees of freedom
    const df = n - 1;

    // Two-tailed p-value
    const absT = Math.abs(t);
    const pValue = 2 * (1 - tCDF(absT, df));

    return {
      tStatistic: t,
      degreesOfFreedom: df,
      pValue: pValue,
      meanDifference: meanDiff,
      stdDevDifference: stdDevDiff,
      stdErr: stdErr,
      n: n,
      significant: pValue < 0.05,
      arMean: calculateMean(pairs.map(p => p[arKey]).filter(v => v !== null)),
      twoDMean: calculateMean(pairs.map(p => p[twoDKey]).filter(v => v !== null)),
    };
  };

  // Calculate paired differences (delta) statistics
  const deltaStatistics = useMemo(() => {
    if (!processedData || !processedData.pairedData || processedData.pairedData.length === 0) return null;

    // Calculate differences for each metric
    const maxLevelDeltas = processedData.pairedData
      .map(p => p.arMaxLevel - p.twoDMaxLevel);
    
    const avgLevelDeltas = processedData.pairedData
      .map(p => p.arAvgLevel - p.twoDAvgLevel);
    
    const avgRTDeltas = processedData.pairedData
      .filter(p => p.arAvgRT !== null && p.twoDAvgRT !== null)
      .map(p => p.arAvgRT - p.twoDAvgRT);

    // Helper function to calculate delta stats
    // higherIsBetter: true for metrics where higher values are better (e.g., Max Level, Avg Level)
    // higherIsBetter: false for metrics where lower values are better (e.g., Response Time)
    const calculateDeltaStats = (deltas, metricName, higherIsBetter = true) => {
      if (deltas.length === 0) return null;
      
      const validDeltas = deltas.filter(d => !isNaN(d) && isFinite(d));
      if (validDeltas.length === 0) return null;

      const meanDelta = calculateMean(validDeltas);
      const medianDelta = calculateMedian(validDeltas);
      const sdDelta = calculateStdDev(validDeltas);
      
      // For higher-is-better metrics: positive delta = improved
      // For lower-is-better metrics: negative delta = improved
      const improvedCount = higherIsBetter
        ? validDeltas.filter(d => d > 0).length
        : validDeltas.filter(d => d < 0).length;
      const percentImproved = (improvedCount / validDeltas.length) * 100;

      return {
        metric: metricName,
        n: validDeltas.length,
        meanDelta,
        medianDelta,
        sdDelta,
        percentImproved,
        deltas: validDeltas,
      };
    };

    return {
      maxLevel: calculateDeltaStats(maxLevelDeltas, 'Max Level', true), // Higher is better
      avgLevel: calculateDeltaStats(avgLevelDeltas, 'Avg Level', true), // Higher is better
      avgRT: calculateDeltaStats(avgRTDeltas, 'Avg RT (s)', false), // Lower is better
    };
  }, [processedData]);

  // Calculate test results
  const testResults = useMemo(() => {
    if (!processedData || !processedData.pairedData || processedData.pairedData.length === 0) return null;

    const pairedTTestMaxLevel = performPairedTTest(processedData.pairedData, 'arMaxLevel', 'twoDMaxLevel');
    const pairedTTestAvgLevel = performPairedTTest(processedData.pairedData, 'arAvgLevel', 'twoDAvgLevel');
    
    // Filter out null values for RT
    // Note: RT requires valid Simon select → level_complete/game_over event pairs
    // Some players may have level data but missing RT data if events don't match up properly
    const validRTData = processedData.pairedData.filter(p => p.arAvgRT !== null && p.twoDAvgRT !== null);
    const pairedTTestAvgRT = validRTData.length >= 2 
      ? performPairedTTest(validRTData, 'arAvgRT', 'twoDAvgRT')
      : { error: 'Insufficient response time data for paired t-test' };

    return {
      maxLevel: pairedTTestMaxLevel,
      avgLevel: pairedTTestAvgLevel,
      avgRT: pairedTTestAvgRT,
    };
  }, [processedData]);

  // Prepare chart data
  const chartData = useMemo(() => {
    if (!testResults) return null;

    const barChartData = [];

    if (!testResults.maxLevel.error) {
      barChartData.push({
        metric: 'Max Level',
        AR: testResults.maxLevel.arMean,
        '2D': testResults.maxLevel.twoDMean,
      });
    }

    if (!testResults.avgLevel.error) {
      barChartData.push({
        metric: 'Avg Level',
        AR: testResults.avgLevel.arMean,
        '2D': testResults.avgLevel.twoDMean,
      });
    }

    if (!testResults.avgRT.error) {
      barChartData.push({
        metric: 'Avg RT (s)',
        AR: testResults.avgRT.arMean,
        '2D': testResults.avgRT.twoDMean,
      });
    }

    // Prepare data for horizontal stacked bar chart showing % players better in AR vs 2D
    const playerComparisonData = [];
    if (deltaStatistics) {
      if (deltaStatistics.maxLevel) {
        playerComparisonData.push({
          metric: 'Max Level',
          betterInAR: deltaStatistics.maxLevel.percentImproved,
          betterIn2D: 100 - deltaStatistics.maxLevel.percentImproved,
          meanDelta: deltaStatistics.maxLevel.meanDelta,
        });
      }
      if (deltaStatistics.avgLevel) {
        playerComparisonData.push({
          metric: 'Avg Level',
          betterInAR: deltaStatistics.avgLevel.percentImproved,
          betterIn2D: 100 - deltaStatistics.avgLevel.percentImproved,
          meanDelta: deltaStatistics.avgLevel.meanDelta,
        });
      }
      if (deltaStatistics.avgRT) {
        playerComparisonData.push({
          metric: 'Avg RT (s)',
          betterInAR: deltaStatistics.avgRT.percentImproved,
          betterIn2D: 100 - deltaStatistics.avgRT.percentImproved,
          meanDelta: deltaStatistics.avgRT.meanDelta,
        });
      }
    }

    return { barChartData, playerComparisonData };
  }, [testResults, deltaStatistics]);

  if (loading) {
    return (
      <div className="inferential-statistics-container">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="inferential-statistics-container">
        <PageHeader title="Statistical Analysis" />
        <div className="error">{error}</div>
      </div>
    );
  }

  if (!testResults || !chartData || !deltaStatistics) {
    return (
      <div className="inferential-statistics-container">
        <PageHeader title="Statistical Analysis" />
        <div className="error">No data available for statistical analysis</div>
      </div>
    );
  }

  return (
    <div className="inferential-statistics-container">
      <PageHeader title="Statistical Analysis" />

      {/* Paired t-Test */}
      <section className="analysis-section">
        <h2>Paired t-Test: AR vs 2D Performance Difference</h2>

        {/* Results Table */}
        <div className="chart-container">
          <h3>Paired t-Test Results</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '20px' }}>
            <thead>
              <tr style={{ backgroundColor: '#f3f4f6', borderBottom: '2px solid #d1d5db' }}>
                <th style={{ padding: '12px', textAlign: 'left', border: '1px solid #d1d5db' }}>Metric</th>
                <th style={{ padding: '12px', textAlign: 'right', border: '1px solid #d1d5db' }}>AR Mean</th>
                <th style={{ padding: '12px', textAlign: 'right', border: '1px solid #d1d5db' }}>2D Mean</th>
                <th style={{ padding: '12px', textAlign: 'right', border: '1px solid #d1d5db' }}>Mean Difference</th>
                <th style={{ padding: '12px', textAlign: 'right', border: '1px solid #d1d5db' }}>t-Statistic</th>
                <th style={{ padding: '12px', textAlign: 'right', border: '1px solid #d1d5db' }}>df</th>
                <th style={{ padding: '12px', textAlign: 'right', border: '1px solid #d1d5db' }}>p-Value</th>
                <th style={{ padding: '12px', textAlign: 'center', border: '1px solid #d1d5db' }}>Significant</th>
              </tr>
            </thead>
            <tbody>
              {!testResults.maxLevel.error && (
                <tr>
                  <td style={{ padding: '10px', border: '1px solid #d1d5db', fontWeight: '500' }}>Max Level</td>
                  <td style={{ padding: '10px', textAlign: 'right', border: '1px solid #d1d5db' }}>{testResults.maxLevel.arMean.toFixed(2)}</td>
                  <td style={{ padding: '10px', textAlign: 'right', border: '1px solid #d1d5db' }}>{testResults.maxLevel.twoDMean.toFixed(2)}</td>
                  <td style={{ padding: '10px', textAlign: 'right', border: '1px solid #d1d5db' }}>{testResults.maxLevel.meanDifference.toFixed(2)}</td>
                  <td style={{ padding: '10px', textAlign: 'right', border: '1px solid #d1d5db' }}>{testResults.maxLevel.tStatistic.toFixed(2)}</td>
                  <td style={{ padding: '10px', textAlign: 'right', border: '1px solid #d1d5db' }}>{testResults.maxLevel.degreesOfFreedom.toFixed(0)}</td>
                  <td style={{ padding: '10px', textAlign: 'right', border: '1px solid #d1d5db' }}>{testResults.maxLevel.pValue.toFixed(2)}</td>
                  <td style={{ padding: '10px', textAlign: 'center', border: '1px solid #d1d5db', color: testResults.maxLevel.significant ? '#B91C1C' : '#6B7280', fontWeight: '500' }}>
                    {testResults.maxLevel.significant ? 'Yes' : 'No'}
                  </td>
                </tr>
              )}
              {!testResults.avgLevel.error && (
                <tr style={{ backgroundColor: '#f9fafb' }}>
                  <td style={{ padding: '10px', border: '1px solid #d1d5db', fontWeight: '500' }}>Avg Level</td>
                  <td style={{ padding: '10px', textAlign: 'right', border: '1px solid #d1d5db' }}>{testResults.avgLevel.arMean.toFixed(2)}</td>
                  <td style={{ padding: '10px', textAlign: 'right', border: '1px solid #d1d5db' }}>{testResults.avgLevel.twoDMean.toFixed(2)}</td>
                  <td style={{ padding: '10px', textAlign: 'right', border: '1px solid #d1d5db' }}>{testResults.avgLevel.meanDifference.toFixed(2)}</td>
                  <td style={{ padding: '10px', textAlign: 'right', border: '1px solid #d1d5db' }}>{testResults.avgLevel.tStatistic.toFixed(2)}</td>
                  <td style={{ padding: '10px', textAlign: 'right', border: '1px solid #d1d5db' }}>{testResults.avgLevel.degreesOfFreedom.toFixed(0)}</td>
                  <td style={{ padding: '10px', textAlign: 'right', border: '1px solid #d1d5db' }}>{testResults.avgLevel.pValue.toFixed(2)}</td>
                  <td style={{ padding: '10px', textAlign: 'center', border: '1px solid #d1d5db', color: testResults.avgLevel.significant ? '#B91C1C' : '#6B7280', fontWeight: '500' }}>
                    {testResults.avgLevel.significant ? 'Yes' : 'No'}
                  </td>
                </tr>
              )}
              {!testResults.avgRT.error && (
                <tr>
                  <td style={{ padding: '10px', border: '1px solid #d1d5db', fontWeight: '500' }}>Avg RT (s)</td>
                  <td style={{ padding: '10px', textAlign: 'right', border: '1px solid #d1d5db' }}>{testResults.avgRT.arMean.toFixed(2)}</td>
                  <td style={{ padding: '10px', textAlign: 'right', border: '1px solid #d1d5db' }}>{testResults.avgRT.twoDMean.toFixed(2)}</td>
                  <td style={{ padding: '10px', textAlign: 'right', border: '1px solid #d1d5db' }}>{testResults.avgRT.meanDifference.toFixed(2)}</td>
                  <td style={{ padding: '10px', textAlign: 'right', border: '1px solid #d1d5db' }}>{testResults.avgRT.tStatistic.toFixed(2)}</td>
                  <td style={{ padding: '10px', textAlign: 'right', border: '1px solid #d1d5db' }}>{testResults.avgRT.degreesOfFreedom.toFixed(0)}</td>
                  <td style={{ padding: '10px', textAlign: 'right', border: '1px solid #d1d5db' }}>{testResults.avgRT.pValue.toFixed(2)}</td>
                  <td style={{ padding: '10px', textAlign: 'center', border: '1px solid #d1d5db', color: testResults.avgRT.significant ? '#B91C1C' : '#6B7280', fontWeight: '500' }}>
                    {testResults.avgRT.significant ? 'Yes' : 'No'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Bar Chart */}
        {chartData.barChartData.length > 0 && (
          <div className="chart-container">
            <h3>Performance Comparison: AR vs 2D</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData.barChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="metric" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="AR" fill="#C41E3A" name="AR" />
                <Bar dataKey="2D" fill="#D4AF37" name="2D" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      {/* Paired Differences (Delta) Table */}
      <section className="analysis-section">
        <h2>Paired Differences (Delta) Table</h2>
        <p style={{ marginBottom: '20px', color: '#6B7280' }}>
          Shows per-player difference between AR and 2D for key metrics. Positive Δ indicates AR better, negative Δ indicates 2D better.
        </p>

        {/* Delta Statistics Table */}
        <div className="chart-container">
          <h3>Delta Statistics (AR - 2D)</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '20px' }}>
            <thead>
              <tr style={{ backgroundColor: '#f3f4f6', borderBottom: '2px solid #d1d5db' }}>
                <th style={{ padding: '12px', textAlign: 'left', border: '1px solid #d1d5db' }}>Metric</th>
                <th style={{ padding: '12px', textAlign: 'right', border: '1px solid #d1d5db' }}>Mean Δ (AR–2D)</th>
                <th style={{ padding: '12px', textAlign: 'right', border: '1px solid #d1d5db' }}>Median Δ</th>
                <th style={{ padding: '12px', textAlign: 'right', border: '1px solid #d1d5db' }}>SD Δ</th>
                <th style={{ padding: '12px', textAlign: 'right', border: '1px solid #d1d5db' }}>% Players Better in AR</th>
              </tr>
            </thead>
            <tbody>
              {deltaStatistics.maxLevel && (
                <tr>
                  <td style={{ padding: '10px', border: '1px solid #d1d5db', fontWeight: '500' }}>Max Level</td>
                  <td style={{ padding: '10px', textAlign: 'right', border: '1px solid #d1d5db' }}>{deltaStatistics.maxLevel.meanDelta.toFixed(2)}</td>
                  <td style={{ padding: '10px', textAlign: 'right', border: '1px solid #d1d5db' }}>{deltaStatistics.maxLevel.medianDelta.toFixed(2)}</td>
                  <td style={{ padding: '10px', textAlign: 'right', border: '1px solid #d1d5db' }}>{deltaStatistics.maxLevel.sdDelta.toFixed(2)}</td>
                  <td style={{ padding: '10px', textAlign: 'right', border: '1px solid #d1d5db' }}>{deltaStatistics.maxLevel.percentImproved.toFixed(1)}%</td>
                </tr>
              )}
              {deltaStatistics.avgLevel && (
                <tr style={{ backgroundColor: '#f9fafb' }}>
                  <td style={{ padding: '10px', border: '1px solid #d1d5db', fontWeight: '500' }}>Avg Level</td>
                  <td style={{ padding: '10px', textAlign: 'right', border: '1px solid #d1d5db' }}>{deltaStatistics.avgLevel.meanDelta.toFixed(2)}</td>
                  <td style={{ padding: '10px', textAlign: 'right', border: '1px solid #d1d5db' }}>{deltaStatistics.avgLevel.medianDelta.toFixed(2)}</td>
                  <td style={{ padding: '10px', textAlign: 'right', border: '1px solid #d1d5db' }}>{deltaStatistics.avgLevel.sdDelta.toFixed(2)}</td>
                  <td style={{ padding: '10px', textAlign: 'right', border: '1px solid #d1d5db' }}>{deltaStatistics.avgLevel.percentImproved.toFixed(1)}%</td>
                </tr>
              )}
              {deltaStatistics.avgRT && (
                <tr>
                  <td style={{ padding: '10px', border: '1px solid #d1d5db', fontWeight: '500' }}>Avg RT (s)</td>
                  <td style={{ padding: '10px', textAlign: 'right', border: '1px solid #d1d5db' }}>{deltaStatistics.avgRT.meanDelta.toFixed(2)}</td>
                  <td style={{ padding: '10px', textAlign: 'right', border: '1px solid #d1d5db' }}>{deltaStatistics.avgRT.medianDelta.toFixed(2)}</td>
                  <td style={{ padding: '10px', textAlign: 'right', border: '1px solid #d1d5db' }}>{deltaStatistics.avgRT.sdDelta.toFixed(2)}</td>
                  <td style={{ padding: '10px', textAlign: 'right', border: '1px solid #d1d5db' }}>{deltaStatistics.avgRT.percentImproved.toFixed(1)}%</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Player Comparison Chart */}
        {chartData.playerComparisonData && chartData.playerComparisonData.length > 0 && (
          <div className="chart-container">
            <h3>Player Performance Comparison: AR vs 2D</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart 
                data={chartData.playerComparisonData} 
                layout="vertical"
                margin={{ top: 20, right: 30, left: 20, bottom: 40 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  type="number" 
                  domain={[0, 100]}
                  label={{ value: '% of Players', position: 'insideBottom', offset: -5 }}
                />
                <YAxis 
                  type="category" 
                  dataKey="metric" 
                  width={100}
                />
                <Tooltip 
                  formatter={(value, name) => {
                    const labels = {
                      'betterInAR': 'Better in AR',
                      'betterIn2D': 'Better in 2D',
                      'meanDelta': 'Mean Δ'
                    };
                    if (name === 'meanDelta') {
                      return [`${value.toFixed(2)}`, labels[name] || name];
                    }
                    return [`${value.toFixed(1)}%`, labels[name] || name];
                  }}
                />
                <Legend verticalAlign="bottom" align="center" wrapperStyle={{ paddingTop: '20px' }} />
                <Bar 
                  dataKey="betterInAR" 
                  stackId="a" 
                  fill="#10B981" 
                  name="Better in AR"
                />
                <Bar 
                  dataKey="betterIn2D" 
                  stackId="a" 
                  fill="#EF4444" 
                  name="Better in 2D"
                />
                {/* Mean Delta markers - show as reference lines with labels */}
                {chartData.playerComparisonData.map((entry, index) => {
                  // Position marker at the boundary between AR and 2D sections
                  // Offset slightly to make it visible
                  const markerPosition = entry.betterInAR;
                  
                  return (
                    <ReferenceLine
                      key={`marker-${index}`}
                      x={markerPosition}
                      stroke="#D4AF37"
                      strokeWidth={2}
                      strokeDasharray="3 3"
                      label={{ 
                        value: `Δ=${entry.meanDelta.toFixed(2)}`, 
                        position: 'top',
                        fill: '#D4AF37',
                        fontSize: 11,
                        fontWeight: 'bold'
                      }}
                    />
                  );
                })}
              </BarChart>
            </ResponsiveContainer>
            <div style={{ marginTop: '10px', fontSize: '12px', color: '#6B7280' }}>
              <p>Shows the percentage of players who performed better in each mode. Green indicates better in AR, red indicates better in 2D.</p>
              <p style={{ marginTop: '5px' }}>The dashed gold line shows the Mean Δ (AR - 2D) value for reference.</p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};

export default InferentialStatistics;
