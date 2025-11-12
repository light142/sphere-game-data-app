/**
 * Inferential Statistics Page
 * Statistical tests: t-Test, ANOVA, Chi-Square
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
  Cell,
} from 'recharts';
import '../styles/InferentialStatistics.css';

const InferentialStatistics = () => {
  const { data, loading, error } = useGameData();

  // Process data for statistical tests
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

    // Data for tests
    const responseTimesAR = [];
    const responseTimes2D = [];
    const responseTimesByLevel = {}; // { level: [times] }
    const gameOutcomesByMode = {
      AR: { 'Game Over': 0, 'Level Complete': 0, 'Restarted': 0, 'Player Left': 0 },
      '2D': { 'Game Over': 0, 'Level Complete': 0, 'Restarted': 0, 'Player Left': 0 },
    };

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
              const responseTime = duration / 1000; // Convert to seconds
              
              // Group by mode
              if (gameModeCategory === 'AR') {
                responseTimesAR.push(responseTime);
              } else if (gameModeCategory === '2D') {
                responseTimes2D.push(responseTime);
              }

              // Group by level
              if (!responseTimesByLevel[currentLevel]) {
                responseTimesByLevel[currentLevel] = [];
              }
              responseTimesByLevel[currentLevel].push(responseTime);
            }
          }
        }
      });

      // Track game outcomes by mode
      if (gameModeCategory === 'AR' || gameModeCategory === '2D') {
        const hasGameOver = sortedEvents.some((e) => e.event_type === 'game_over');
        const hasRestart = sortedEvents.some((e) => e.event_type === 'restart_game');
        const hasQuit = sortedEvents.some((e) => e.event_type === 'quit_application');
        const hasBackToMenu = sortedEvents.some((e) => e.event_type === 'back_to_menu');
        const hasLevelComplete = sortedEvents.some((e) => e.event_type === 'level_complete');

        if (hasGameOver) {
          gameOutcomesByMode[gameModeCategory]['Game Over']++;
        } else if (hasRestart) {
          gameOutcomesByMode[gameModeCategory]['Restarted']++;
        } else if (hasQuit || hasBackToMenu) {
          gameOutcomesByMode[gameModeCategory]['Player Left']++;
        } else if (hasLevelComplete) {
          gameOutcomesByMode[gameModeCategory]['Level Complete']++;
        }
      }
    });

    return {
      responseTimesAR,
      responseTimes2D,
      responseTimesByLevel,
      gameOutcomesByMode,
    };
  }, [data]);

  // Statistical test functions
  const calculateMean = (values) => {
    if (!values || values.length === 0) return 0;
    const validValues = values.filter(v => !isNaN(v) && isFinite(v));
    if (validValues.length === 0) return 0;
    return validValues.reduce((acc, val) => acc + val, 0) / validValues.length;
  };

  const calculateVariance = (values) => {
    if (!values || values.length === 0) return 0;
    const validValues = values.filter(v => !isNaN(v) && isFinite(v));
    if (validValues.length === 0) return 0;
    const mean = calculateMean(validValues);
    const squaredDiffs = validValues.map((val) => Math.pow(val - mean, 2));
    return calculateMean(squaredDiffs);
  };

  const calculateStdDev = (values) => {
    return Math.sqrt(calculateVariance(values));
  };

  // Independent Samples t-Test
  const performTTest = (group1, group2) => {
    if (group1.length < 2 || group2.length < 2) {
      return { error: 'Insufficient data for t-test (need at least 2 samples per group)' };
    }

    const mean1 = calculateMean(group1);
    const mean2 = calculateMean(group2);
    const var1 = calculateVariance(group1);
    const var2 = calculateVariance(group2);
    const n1 = group1.length;
    const n2 = group2.length;

    // Pooled standard error
    const pooledStdErr = Math.sqrt((var1 / n1) + (var2 / n2));
    
    if (pooledStdErr === 0) {
      return { error: 'Cannot calculate t-test: pooled standard error is zero' };
    }

    // t-statistic
    const t = (mean1 - mean2) / pooledStdErr;

    // Degrees of freedom (Welch's approximation)
    const df = Math.pow((var1 / n1) + (var2 / n2), 2) / 
      (Math.pow(var1 / n1, 2) / (n1 - 1) + Math.pow(var2 / n2, 2) / (n2 - 1));

    // Approximate p-value using t-distribution (simplified)
    // For large samples, t follows approximately normal distribution
    const absT = Math.abs(t);
    // Simplified p-value calculation (two-tailed)
    let pValue;
    if (df > 30) {
      // Normal approximation
      pValue = 2 * (1 - normalCDF(absT));
    } else {
      // Use t-distribution approximation
      pValue = 2 * (1 - tCDF(absT, df));
    }

    return {
      tStatistic: t,
      degreesOfFreedom: df,
      pValue: pValue,
      mean1: mean1,
      mean2: mean2,
      stdDev1: calculateStdDev(group1),
      stdDev2: calculateStdDev(group2),
      n1: n1,
      n2: n2,
      significant: pValue < 0.05,
    };
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

  // ANOVA (Analysis of Variance)
  const performANOVA = (groups) => {
    const groupKeys = Object.keys(groups).filter(key => {
      const values = groups[key];
      return values && values.length >= 2;
    });

    if (groupKeys.length < 2) {
      return { error: 'ANOVA requires at least 2 groups with at least 2 samples each' };
    }

    const allValues = [];
    const groupMeans = {};
    const groupSizes = {};
    let totalSum = 0;
    let totalCount = 0;

    groupKeys.forEach((key) => {
      const values = groups[key].filter(v => !isNaN(v) && isFinite(v));
      if (values.length === 0) return;
      
      groupMeans[key] = calculateMean(values);
      groupSizes[key] = values.length;
      allValues.push(...values);
      totalSum += values.reduce((acc, val) => acc + val, 0);
      totalCount += values.length;
    });

    if (totalCount === 0) {
      return { error: 'No valid data for ANOVA' };
    }

    const grandMean = totalSum / totalCount;

    // Sum of Squares Between (SSB)
    let ssb = 0;
    groupKeys.forEach((key) => {
      const n = groupSizes[key];
      const mean = groupMeans[key];
      ssb += n * Math.pow(mean - grandMean, 2);
    });

    // Sum of Squares Within (SSW)
    let ssw = 0;
    groupKeys.forEach((key) => {
      const values = groups[key].filter(v => !isNaN(v) && isFinite(v));
      const mean = groupMeans[key];
      values.forEach((val) => {
        ssw += Math.pow(val - mean, 2);
      });
    });

    // Degrees of freedom
    const dfBetween = groupKeys.length - 1;
    const dfWithin = totalCount - groupKeys.length;

    if (dfWithin <= 0) {
      return { error: 'Insufficient degrees of freedom for ANOVA' };
    }

    // Mean Squares
    const msBetween = ssb / dfBetween;
    const msWithin = ssw / dfWithin;

    // F-statistic
    const fStatistic = msWithin === 0 ? 0 : msBetween / msWithin;

    // Approximate p-value (simplified)
    const pValue = 1 - fCDF(fStatistic, dfBetween, dfWithin);

    return {
      fStatistic: fStatistic,
      pValue: pValue,
      dfBetween: dfBetween,
      dfWithin: dfWithin,
      ssb: ssb,
      ssw: ssw,
      msBetween: msBetween,
      msWithin: msWithin,
      groupMeans: groupMeans,
      groupSizes: groupSizes,
      grandMean: grandMean,
      significant: pValue < 0.05,
    };
  };

  // F-distribution CDF approximation
  const fCDF = (f, df1, df2) => {
    if (f <= 0) return 0;
    // Simplified approximation
    const x = df2 / (df2 + df1 * f);
    return incompleteBeta(x, df2 / 2, df1 / 2);
  };

  // Incomplete Beta function approximation
  const incompleteBeta = (x, a, b) => {
    // Simplified approximation
    if (x === 0) return 0;
    if (x === 1) return 1;
    // Use normal approximation for simplicity
    return normalCDF(Math.sqrt(x));
  };

  // Chi-Square Test
  const performChiSquare = (observed) => {
    const categories = Object.keys(observed);
    if (categories.length < 2) {
      return { error: 'Chi-square test requires at least 2 categories' };
    }

    const groups = Object.keys(observed[categories[0]]);
    if (groups.length < 2) {
      return { error: 'Chi-square test requires at least 2 groups' };
    }

    // Calculate totals
    const rowTotals = {};
    const colTotals = {};
    let grandTotal = 0;

    categories.forEach((cat) => {
      rowTotals[cat] = 0;
      groups.forEach((group) => {
        const value = observed[cat][group] || 0;
        rowTotals[cat] += value;
        colTotals[group] = (colTotals[group] || 0) + value;
        grandTotal += value;
      });
    });

    if (grandTotal === 0) {
      return { error: 'No data for chi-square test' };
    }

    // Calculate expected frequencies and chi-square statistic
    let chiSquare = 0;
    const expected = {};
    const residuals = {};

    categories.forEach((cat) => {
      expected[cat] = {};
      residuals[cat] = {};
      groups.forEach((group) => {
        const observedValue = observed[cat][group] || 0;
        const expectedValue = (rowTotals[cat] * colTotals[group]) / grandTotal;
        expected[cat][group] = expectedValue;
        
        if (expectedValue > 0) {
          const residual = observedValue - expectedValue;
          residuals[cat][group] = residual;
          chiSquare += Math.pow(residual, 2) / expectedValue;
        }
      });
    });

    // Degrees of freedom
    const df = (categories.length - 1) * (groups.length - 1);

    // Approximate p-value using chi-square distribution
    const pValue = 1 - chiSquareCDF(chiSquare, df);

    return {
      chiSquare: chiSquare,
      degreesOfFreedom: df,
      pValue: pValue,
      expected: expected,
      observed: observed,
      residuals: residuals,
      significant: pValue < 0.05,
    };
  };

  // Chi-square CDF approximation
  const chiSquareCDF = (x, df) => {
    if (x <= 0) return 0;
    // Simplified approximation using normal distribution
    const z = Math.sqrt(2 * x) - Math.sqrt(2 * df - 1);
    return normalCDF(z);
  };

  // Percentile calculation
  const percentile = (values, p) => {
    if (!values || values.length === 0) return 0;
    const sorted = [...values].filter(v => !isNaN(v) && isFinite(v)).sort((a, b) => a - b);
    if (sorted.length === 0) return 0;
    const index = Math.floor(sorted.length * p);
    return sorted[Math.min(index, sorted.length - 1)];
  };

  // Calculate test results
  const testResults = useMemo(() => {
    if (!processedData) return null;

    // t-Test: AR vs 2D response times
    const tTestResult = performTTest(processedData.responseTimesAR, processedData.responseTimes2D);

    // ANOVA: Response times by level
    const anovaResult = performANOVA(processedData.responseTimesByLevel);

    // Chi-Square: Game outcomes by mode
    const chiSquareResult = performChiSquare(processedData.gameOutcomesByMode);

    return {
      tTest: tTestResult,
      anova: anovaResult,
      chiSquare: chiSquareResult,
    };
  }, [processedData]);

  // Prepare chart data
  const chartData = useMemo(() => {
    if (!processedData || !testResults) return null;

    // Box plot data for t-Test
    const boxPlotData = [
      {
        name: 'AR',
        min: Math.min(...processedData.responseTimesAR),
        q1: percentile(processedData.responseTimesAR, 0.25),
        median: percentile(processedData.responseTimesAR, 0.5),
        q3: percentile(processedData.responseTimesAR, 0.75),
        max: Math.max(...processedData.responseTimesAR),
        mean: calculateMean(processedData.responseTimesAR),
      },
      {
        name: '2D',
        min: Math.min(...processedData.responseTimes2D),
        q1: percentile(processedData.responseTimes2D, 0.25),
        median: percentile(processedData.responseTimes2D, 0.5),
        q3: percentile(processedData.responseTimes2D, 0.75),
        max: Math.max(...processedData.responseTimes2D),
        mean: calculateMean(processedData.responseTimes2D),
      },
    ];

    // ANOVA data by level
    const anovaChartData = Object.keys(processedData.responseTimesByLevel)
      .sort((a, b) => Number(a) - Number(b))
      .map((level) => {
        const values = processedData.responseTimesByLevel[level];
        return {
          level: `Level ${level}`,
          mean: calculateMean(values),
          stdDev: calculateStdDev(values),
          count: values.length,
        };
      });

    // Chi-Square data
    const chiSquareChartData = [];
    Object.keys(processedData.gameOutcomesByMode).forEach((mode) => {
      Object.keys(processedData.gameOutcomesByMode[mode]).forEach((outcome) => {
        chiSquareChartData.push({
          mode: mode,
          outcome: outcome,
          count: processedData.gameOutcomesByMode[mode][outcome],
        });
      });
    });

    return {
      boxPlotData,
      anovaChartData,
      chiSquareChartData,
    };
  }, [processedData, testResults]);

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
        <PageHeader title="Inferential Statistics" />
        <div className="error">{error}</div>
      </div>
    );
  }

  if (!testResults || !chartData) {
    return (
      <div className="inferential-statistics-container">
        <PageHeader title="Inferential Statistics" />
        <div className="error">No data available for statistical analysis</div>
      </div>
    );
  }

  return (
    <div className="inferential-statistics-container">
      <PageHeader title="Inferential Statistics" />

      {/* Independent Samples t-Test */}
      <section className="analysis-section">
        <h2>Independent Samples t-Test</h2>
        <p className="test-description">
          <strong>Research Question:</strong> Is there a significant difference in response times between AR and 2D game modes?
        </p>
        
        {testResults.tTest.error ? (
          <div className="error-message">{testResults.tTest.error}</div>
        ) : (
          <>
            <div className="test-results">
              <div className="result-card">
                <div className="result-label">t-Statistic</div>
                <div className="result-value">{testResults.tTest.tStatistic.toFixed(4)}</div>
              </div>
              <div className="result-card">
                <div className="result-label">Degrees of Freedom</div>
                <div className="result-value">{testResults.tTest.degreesOfFreedom.toFixed(2)}</div>
              </div>
              <div className="result-card">
                <div className="result-label">p-Value</div>
                <div className={`result-value ${testResults.tTest.significant ? 'significant' : 'not-significant'}`}>
                  {testResults.tTest.pValue.toFixed(4)}
                </div>
              </div>
              <div className="result-card">
                <div className="result-label">AR Mean (s)</div>
                <div className="result-value">{testResults.tTest.mean1.toFixed(2)}</div>
              </div>
              <div className="result-card">
                <div className="result-label">2D Mean (s)</div>
                <div className="result-value">{testResults.tTest.mean2.toFixed(2)}</div>
              </div>
              <div className="result-card">
                <div className="result-label">AR Std Dev</div>
                <div className="result-value">{testResults.tTest.stdDev1.toFixed(2)}</div>
              </div>
              <div className="result-card">
                <div className="result-label">2D Std Dev</div>
                <div className="result-value">{testResults.tTest.stdDev2.toFixed(2)}</div>
              </div>
              <div className="result-card">
                <div className="result-label">AR Sample Size</div>
                <div className="result-value">{testResults.tTest.n1}</div>
              </div>
              <div className="result-card">
                <div className="result-label">2D Sample Size</div>
                <div className="result-value">{testResults.tTest.n2}</div>
              </div>
            </div>

            <div className="interpretation">
              <strong>Interpretation:</strong> {testResults.tTest.significant ? (
                <span className="significant-text">
                  There is a statistically significant difference in response times between AR and 2D modes (p &lt; 0.05).
                </span>
              ) : (
                <span className="not-significant-text">
                  There is no statistically significant difference in response times between AR and 2D modes (p ≥ 0.05).
                </span>
              )}
            </div>

            <div className="chart-container">
              <h3>Response Time Comparison: AR vs 2D</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData.boxPlotData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis label={{ value: 'Response Time (seconds)', angle: -90, position: 'insideLeft' }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="mean" fill="#C41E3A" name="Mean" />
                  <Bar dataKey="median" fill="#D4AF37" name="Median" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </section>

      {/* ANOVA */}
      <section className="analysis-section">
        <h2>ANOVA (Analysis of Variance)</h2>
        <p className="test-description">
          <strong>Research Question:</strong> Are there significant differences in response times across different game levels?
        </p>
        
        {testResults.anova.error ? (
          <div className="error-message">{testResults.anova.error}</div>
        ) : (
          <>
            <div className="test-results">
              <div className="result-card">
                <div className="result-label">F-Statistic</div>
                <div className="result-value">{testResults.anova.fStatistic.toFixed(4)}</div>
              </div>
              <div className="result-card">
                <div className="result-label">p-Value</div>
                <div className={`result-value ${testResults.anova.significant ? 'significant' : 'not-significant'}`}>
                  {testResults.anova.pValue.toFixed(4)}
                </div>
              </div>
              <div className="result-card">
                <div className="result-label">df Between</div>
                <div className="result-value">{testResults.anova.dfBetween}</div>
              </div>
              <div className="result-card">
                <div className="result-label">df Within</div>
                <div className="result-value">{testResults.anova.dfWithin}</div>
              </div>
            </div>

            <div className="interpretation">
              <strong>Interpretation:</strong> {testResults.anova.significant ? (
                <span className="significant-text">
                  There are statistically significant differences in response times across different levels (p &lt; 0.05).
                </span>
              ) : (
                <span className="not-significant-text">
                  There are no statistically significant differences in response times across different levels (p ≥ 0.05).
                </span>
              )}
            </div>

            <div className="chart-container">
              <h3>Response Time by Level</h3>
              {chartData.anovaChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData.anovaChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="level" />
                    <YAxis label={{ value: 'Mean Response Time (seconds)', angle: -90, position: 'insideLeft' }} />
                    <Tooltip />
                    <Bar dataKey="mean" fill="#C41E3A" name="Mean Response Time" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="no-data">No data available</div>
              )}
            </div>
          </>
        )}
      </section>

      {/* Chi-Square Test */}
      <section className="analysis-section">
        <h2>Chi-Square Test</h2>
        <p className="test-description">
          <strong>Research Question:</strong> Is there an association between game mode (AR vs 2D) and game outcomes?
        </p>
        
        {testResults.chiSquare.error ? (
          <div className="error-message">{testResults.chiSquare.error}</div>
        ) : (
          <>
            <div className="test-results">
              <div className="result-card">
                <div className="result-label">Chi-Square Statistic</div>
                <div className="result-value">{testResults.chiSquare.chiSquare.toFixed(4)}</div>
              </div>
              <div className="result-card">
                <div className="result-label">Degrees of Freedom</div>
                <div className="result-value">{testResults.chiSquare.degreesOfFreedom}</div>
              </div>
              <div className="result-card">
                <div className="result-label">p-Value</div>
                <div className={`result-value ${testResults.chiSquare.significant ? 'significant' : 'not-significant'}`}>
                  {testResults.chiSquare.pValue.toFixed(4)}
                </div>
              </div>
            </div>

            <div className="interpretation">
              <strong>Interpretation:</strong> {testResults.chiSquare.significant ? (
                <span className="significant-text">
                  There is a statistically significant association between game mode and game outcomes (p &lt; 0.05).
                </span>
              ) : (
                <span className="not-significant-text">
                  There is no statistically significant association between game mode and game outcomes (p ≥ 0.05).
                </span>
              )}
            </div>

            <div className="chart-container">
              <h3>Game Outcomes by Mode</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData.chiSquareChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="outcome" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="count" fill="#C41E3A" name="Count">
                    {chartData.chiSquareChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.mode === 'AR' ? '#C41E3A' : '#D4AF37'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </section>
    </div>
  );
};

export default InferentialStatistics;

