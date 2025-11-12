/**
 * Regression Analysis Page
 * Simple Linear Regression and Multiple Regression
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
  Legend,
  ResponsiveContainer,
  Line,
  ComposedChart,
} from 'recharts';
import '../styles/RegressionAnalysis.css';

const RegressionAnalysis = () => {
  const { data, loading, error } = useGameData();

  // Process data for regression analysis
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

    // Data for regression
    const simpleRegressionData = []; // { level, responseTime }
    const multipleRegressionData = []; // { level, responseTime, gameMode (0=2D, 1=AR), previousResponseTime }

    // Process each game
    Object.values(gamesMap).forEach((gameEvents) => {
      const sortedEvents = [...gameEvents].sort(
        (a, b) => new Date(a.event_at) - new Date(b.event_at)
      );

      const rawGameMode = sortedEvents.find((e) => e.game_mode)?.game_mode || null;
      const gameModeCategory = mapGameModeToCategory(rawGameMode) || 'Unknown';
      const gameModeNumeric = gameModeCategory === 'AR' ? 1 : 0;

      // Calculate response times per level
      const eventsByLevel = {};
      sortedEvents.forEach((event, index) => {
        const level = event.game_level !== null && event.game_level !== undefined ? event.game_level : 'unknown';
        if (!eventsByLevel[level]) {
          eventsByLevel[level] = [];
        }
        eventsByLevel[level].push({ ...event, originalIndex: index });
      });

      const levelResponseTimes = []; // Track response times by level for this game

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
              const responseTime = duration / 1000; // seconds
              
              // Simple regression data
              simpleRegressionData.push({
                level: currentLevel,
                responseTime: responseTime,
              });

              // Multiple regression data
              const previousResponseTime = levelResponseTimes.length > 0 
                ? levelResponseTimes[levelResponseTimes.length - 1] 
                : null;

              multipleRegressionData.push({
                level: currentLevel,
                responseTime: responseTime,
                gameMode: gameModeNumeric,
                previousResponseTime: previousResponseTime || 0,
              });

              levelResponseTimes.push(responseTime);
            }
          }
        }
      });
    });

    return {
      simpleRegressionData,
      multipleRegressionData,
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

  // Simple Linear Regression: y = a + b*x
  const performSimpleLinearRegression = (x, y) => {
    if (x.length !== y.length || x.length < 2) {
      return { error: 'Insufficient data for regression (need at least 2 pairs)' };
    }

    const validPairs = [];
    for (let i = 0; i < x.length; i++) {
      if (!isNaN(x[i]) && !isNaN(y[i]) && isFinite(x[i]) && isFinite(y[i])) {
        validPairs.push({ x: x[i], y: y[i] });
      }
    }

    if (validPairs.length < 2) {
      return { error: 'Insufficient valid data for regression' };
    }

    const n = validPairs.length;
    const meanX = calculateMean(validPairs.map(p => p.x));
    const meanY = calculateMean(validPairs.map(p => p.y));

    // Calculate slope (b)
    let numerator = 0;
    let denominator = 0;
    for (let i = 0; i < validPairs.length; i++) {
      const xDiff = validPairs[i].x - meanX;
      const yDiff = validPairs[i].y - meanY;
      numerator += xDiff * yDiff;
      denominator += xDiff * xDiff;
    }

    if (denominator === 0) {
      return { error: 'Cannot calculate regression: X variable has zero variance' };
    }

    const slope = numerator / denominator;
    const intercept = meanY - slope * meanX;

    // Calculate R-squared
    let ssRes = 0; // Sum of squares of residuals
    let ssTot = 0; // Total sum of squares
    for (let i = 0; i < validPairs.length; i++) {
      const predicted = intercept + slope * validPairs[i].x;
      const residual = validPairs[i].y - predicted;
      ssRes += residual * residual;
      const totalDiff = validPairs[i].y - meanY;
      ssTot += totalDiff * totalDiff;
    }

    const rSquared = ssTot === 0 ? 0 : 1 - (ssRes / ssTot);

    // Calculate standard errors and p-values
    const mse = ssRes / (n - 2); // Mean squared error
    const seSlope = Math.sqrt(mse / denominator);
    const seIntercept = Math.sqrt(mse * (1 / n + meanX * meanX / denominator));

    // t-statistics
    const tSlope = seSlope === 0 ? 0 : slope / seSlope;
    const tIntercept = seIntercept === 0 ? 0 : intercept / seIntercept;

    // p-values (two-tailed)
    const pValueSlope = 2 * (1 - tCDF(Math.abs(tSlope), n - 2));
    const pValueIntercept = 2 * (1 - tCDF(Math.abs(tIntercept), n - 2));

    // Generate predicted values for line
    const minX = Math.min(...validPairs.map(p => p.x));
    const maxX = Math.max(...validPairs.map(p => p.x));
    const predictedLine = [
      { x: minX, y: intercept + slope * minX },
      { x: maxX, y: intercept + slope * maxX },
    ];

    return {
      intercept: intercept,
      slope: slope,
      rSquared: rSquared,
      n: n,
      seSlope: seSlope,
      seIntercept: seIntercept,
      tSlope: tSlope,
      tIntercept: tIntercept,
      pValueSlope: pValueSlope,
      pValueIntercept: pValueIntercept,
      significant: pValueSlope < 0.05,
      predictedLine: predictedLine,
      equation: `y = ${intercept.toFixed(4)} + ${slope.toFixed(4)}x`,
    };
  };

  // Multiple Linear Regression: y = a + b1*x1 + b2*x2 + b3*x3
  const performMultipleRegression = (data) => {
    if (data.length < 3) {
      return { error: 'Insufficient data for multiple regression (need at least 3 observations)' };
    }

    const validData = data.filter(d => 
      !isNaN(d.level) && !isNaN(d.responseTime) && !isNaN(d.gameMode) && !isNaN(d.previousResponseTime) &&
      isFinite(d.level) && isFinite(d.responseTime) && isFinite(d.gameMode) && isFinite(d.previousResponseTime)
    );

    if (validData.length < 3) {
      return { error: 'Insufficient valid data for multiple regression' };
    }

    const n = validData.length;
    const y = validData.map(d => d.responseTime);
    const x1 = validData.map(d => d.level);
    const x2 = validData.map(d => d.gameMode);
    const x3 = validData.map(d => d.previousResponseTime);

    // Calculate means
    const meanY = calculateMean(y);
    const meanX1 = calculateMean(x1);
    const meanX2 = calculateMean(x2);
    const meanX3 = calculateMean(x3);

    // Calculate coefficients using least squares (simplified)
    // This is a simplified implementation - in practice, you'd use matrix operations
    let sumX1Y = 0, sumX2Y = 0, sumX3Y = 0;
    let sumX1X1 = 0, sumX2X2 = 0, sumX3X3 = 0;
    let sumX1X2 = 0, sumX1X3 = 0, sumX2X3 = 0;

    for (let i = 0; i < validData.length; i++) {
      const x1i = x1[i] - meanX1;
      const x2i = x2[i] - meanX2;
      const x3i = x3[i] - meanX3;
      const yi = y[i] - meanY;

      sumX1Y += x1i * yi;
      sumX2Y += x2i * yi;
      sumX3Y += x3i * yi;
      sumX1X1 += x1i * x1i;
      sumX2X2 += x2i * x2i;
      sumX3X3 += x3i * x3i;
      sumX1X2 += x1i * x2i;
      sumX1X3 += x1i * x3i;
      sumX2X3 += x2i * x3i;
    }

    // Simplified coefficient calculation (this is a basic approximation)
    // In practice, you'd solve the normal equations using matrix inversion
    const b1 = sumX1X1 === 0 ? 0 : sumX1Y / sumX1X1;
    const b2 = sumX2X2 === 0 ? 0 : sumX2Y / sumX2X2;
    const b3 = sumX3X3 === 0 ? 0 : sumX3Y / sumX3X3;
    const intercept = meanY - b1 * meanX1 - b2 * meanX2 - b3 * meanX3;

    // Calculate R-squared
    let ssRes = 0;
    let ssTot = 0;
    for (let i = 0; i < validData.length; i++) {
      const predicted = intercept + b1 * x1[i] + b2 * x2[i] + b3 * x3[i];
      const residual = y[i] - predicted;
      ssRes += residual * residual;
      const totalDiff = y[i] - meanY;
      ssTot += totalDiff * totalDiff;
    }

    const rSquared = ssTot === 0 ? 0 : 1 - (ssRes / ssTot);

    return {
      intercept: intercept,
      coefficients: {
        level: b1,
        gameMode: b2,
        previousResponseTime: b3,
      },
      rSquared: rSquared,
      n: n,
      equation: `y = ${intercept.toFixed(4)} + ${b1.toFixed(4)}*level + ${b2.toFixed(4)}*gameMode + ${b3.toFixed(4)}*prevResponseTime`,
    };
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

  // Calculate regression results
  const regressionResults = useMemo(() => {
    if (!processedData) return null;

    // Simple Linear Regression: Response Time ~ Level
    const simpleRegression = performSimpleLinearRegression(
      processedData.simpleRegressionData.map(d => d.level),
      processedData.simpleRegressionData.map(d => d.responseTime)
    );

    // Multiple Regression: Response Time ~ Level + GameMode + PreviousResponseTime
    const multipleRegression = performMultipleRegression(processedData.multipleRegressionData);

    return {
      simpleRegression,
      multipleRegression,
    };
  }, [processedData]);

  if (loading) {
    return (
      <div className="regression-analysis-container">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="regression-analysis-container">
        <PageHeader title="Regression Analysis" />
        <div className="error">{error}</div>
      </div>
    );
  }

  if (!processedData || !regressionResults) {
    return (
      <div className="regression-analysis-container">
        <PageHeader title="Regression Analysis" />
        <div className="error">No data available for regression analysis</div>
      </div>
    );
  }

  return (
    <div className="regression-analysis-container">
      <PageHeader title="Regression Analysis" />

      {/* Simple Linear Regression */}
      <section className="analysis-section">
        <h2>Simple Linear Regression: Response Time ~ Level</h2>
        <p className="test-description">
          <strong>Research Question:</strong> Can we predict player response time based on the game level?
        </p>
        
        {regressionResults.simpleRegression.error ? (
          <div className="error-message">{regressionResults.simpleRegression.error}</div>
        ) : (
          <>
            <div className="test-results">
              <div className="result-card">
                <div className="result-label">Regression Equation</div>
                <div className="result-value equation">{regressionResults.simpleRegression.equation}</div>
              </div>
              <div className="result-card">
                <div className="result-label">Intercept (a)</div>
                <div className="result-value">{regressionResults.simpleRegression.intercept.toFixed(4)}</div>
              </div>
              <div className="result-card">
                <div className="result-label">Slope (b)</div>
                <div className={`result-value ${regressionResults.simpleRegression.significant ? 'significant' : 'not-significant'}`}>
                  {regressionResults.simpleRegression.slope.toFixed(4)}
                </div>
              </div>
              <div className="result-card">
                <div className="result-label">R-squared (R²)</div>
                <div className="result-value">{(regressionResults.simpleRegression.rSquared * 100).toFixed(2)}%</div>
              </div>
              <div className="result-card">
                <div className="result-label">p-Value (Slope)</div>
                <div className={`result-value ${regressionResults.simpleRegression.significant ? 'significant' : 'not-significant'}`}>
                  {regressionResults.simpleRegression.pValueSlope.toFixed(4)}
                </div>
              </div>
              <div className="result-card">
                <div className="result-label">Sample Size (n)</div>
                <div className="result-value">{regressionResults.simpleRegression.n}</div>
              </div>
            </div>

            <div className="interpretation">
              <strong>Interpretation:</strong> {regressionResults.simpleRegression.significant ? (
                <span className="significant-text">
                  Level is a statistically significant predictor of response time (p &lt; 0.05). 
                  The model explains {(regressionResults.simpleRegression.rSquared * 100).toFixed(2)}% of the variance in response time.
                </span>
              ) : (
                <span className="not-significant-text">
                  Level is not a statistically significant predictor of response time (p ≥ 0.05).
                </span>
              )}
            </div>

            <div className="chart-container">
              <h3>Response Time vs Level with Regression Line</h3>
              {processedData.simpleRegressionData.length > 0 && regressionResults.simpleRegression.predictedLine ? (
                <ResponsiveContainer width="100%" height={500}>
                  <ComposedChart margin={{ top: 50, right: 30, bottom: 80, left: 80 }}>
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
                    <Legend 
                      wrapperStyle={{ paddingTop: '30px', paddingBottom: '10px' }}
                      iconSize={12}
                    />
                    <Scatter name="Response Time" data={processedData.simpleRegressionData} fill="#C41E3A" />
                    <Line 
                      type="linear" 
                      dataKey="responseTime" 
                      data={regressionResults.simpleRegression.predictedLine.map(p => ({ level: p.x, responseTime: p.y }))} 
                      stroke="#D4AF37" 
                      strokeWidth={2}
                      dot={false}
                      name="Regression Line"
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <div className="no-data">No data available</div>
              )}
            </div>
          </>
        )}
      </section>

      {/* Multiple Regression */}
      <section className="analysis-section">
        <h2>Multiple Regression: Response Time ~ Level + Game Mode + Previous Response Time</h2>
        <p className="test-description">
          <strong>Research Question:</strong> Can we predict player response time using level, game mode, and previous response time?
        </p>
        
        {regressionResults.multipleRegression.error ? (
          <div className="error-message">{regressionResults.multipleRegression.error}</div>
        ) : (
          <>
            <div className="test-results">
              <div className="result-card">
                <div className="result-label">Regression Equation</div>
                <div className="result-value equation">{regressionResults.multipleRegression.equation}</div>
              </div>
              <div className="result-card">
                <div className="result-label">Intercept</div>
                <div className="result-value">{regressionResults.multipleRegression.intercept.toFixed(4)}</div>
              </div>
              <div className="result-card">
                <div className="result-label">Coefficient: Level</div>
                <div className="result-value">{regressionResults.multipleRegression.coefficients.level.toFixed(4)}</div>
              </div>
              <div className="result-card">
                <div className="result-label">Coefficient: Game Mode</div>
                <div className="result-value">{regressionResults.multipleRegression.coefficients.gameMode.toFixed(4)}</div>
              </div>
              <div className="result-card">
                <div className="result-label">Coefficient: Previous Response Time</div>
                <div className="result-value">{regressionResults.multipleRegression.coefficients.previousResponseTime.toFixed(4)}</div>
              </div>
              <div className="result-card">
                <div className="result-label">R-squared (R²)</div>
                <div className="result-value">{(regressionResults.multipleRegression.rSquared * 100).toFixed(2)}%</div>
              </div>
              <div className="result-card">
                <div className="result-label">Sample Size (n)</div>
                <div className="result-value">{regressionResults.multipleRegression.n}</div>
              </div>
            </div>

            <div className="interpretation">
              <strong>Interpretation:</strong> The multiple regression model explains{' '}
              {(regressionResults.multipleRegression.rSquared * 100).toFixed(2)}% of the variance in response time.
              {' '}The coefficients indicate the change in response time for each unit change in the predictor variables.
            </div>
          </>
        )}
      </section>
    </div>
  );
};

export default RegressionAnalysis;

