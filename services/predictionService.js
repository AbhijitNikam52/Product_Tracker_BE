/**
 * Deterministic pseudo-random number generator seeded by string
 * Ensures the mock history is stable and consistent for each product.
 */
function getSeededRandom(seedStr) {
  let hash = 0;
  for (let i = 0; i < seedStr.length; i++) {
    hash = seedStr.charCodeAt(i) + ((hash << 5) - hash);
  }
  return function() {
    const x = Math.sin(hash++) * 10000;
    return x - Math.floor(x);
  };
}

/**
 * Helper to get the difference in days between two dates
 */
const getDiffDays = (d1, d2) => {
  return Math.ceil((d1.getTime() - d2.getTime()) / (1000 * 60 * 60 * 24));
};

/**
 * Helper to calculate the next occurrence of a specific month/day
 */
const getNextOccurrence = (month, day, fromDate) => {
  const d = new Date(fromDate.getFullYear(), month, day);
  if (d < fromDate) {
    d.setFullYear(fromDate.getFullYear() + 1);
  }
  return d;
};

/**
 * Predicts product prices and generates buy/wait recommendations
 * 
 * @param {object} item - Mongoose TrackedItem document
 * @param {Array} actualHistory - Historical price data points from database
 * @returns {object} - { history, predictions, recommendation }
 */
const getPredictions = (item, actualHistory) => {
  const currentPrice = item.currentPrice || item.targetPrice || 100;
  const symbol = item.currency === 'USD' ? '$' : '₹';
  const now = new Date();

  // 1. Prepare history dataset. If sparse, generate seeded stable mock history.
  let historyPoints = [];
  const minPointsRequired = 10;

  if (actualHistory && actualHistory.length >= minPointsRequired) {
    historyPoints = actualHistory.map(h => ({
      price: h.price,
      recordedAt: new Date(h.recordedAt)
    }));
  } else {
    // Generate deterministic mock history based on item ID seed
    const random = getSeededRandom(item._id.toString());
    const startDayOffset = 20; // 20 days of simulated history
    let currentWalkPrice = currentPrice * (1.05 + (random() * 0.1)); // Start slightly higher than current price

    for (let i = startDayOffset; i >= 1; i--) {
      const date = new Date(now);
      date.setDate(now.getDate() - i);
      
      // Seeded random walk: fluctuations between -1.8% and +1.6% per day
      // Adds a small organic downward pull if the starting price was high
      const pull = (currentWalkPrice > currentPrice) ? -0.003 : 0.001;
      const changePct = (random() * 0.034) - 0.017 + pull;
      currentWalkPrice = currentWalkPrice * (1 + changePct);

      if (currentWalkPrice <= 0) currentWalkPrice = 1;

      historyPoints.push({
        price: Math.round(currentWalkPrice),
        recordedAt: date
      });
    }

    // Append any actual history points overlaying the generated history
    if (actualHistory && actualHistory.length > 0) {
      actualHistory.forEach(h => {
        historyPoints.push({
          price: h.price,
          recordedAt: new Date(h.recordedAt)
        });
      });
    } else {
      // If absolutely no history, append the current price point as today's actual price
      historyPoints.push({
        price: currentPrice,
        recordedAt: new Date(now)
      });
    }
  }

  // Sort history points by date ascending
  historyPoints.sort((a, b) => a.recordedAt - b.recordedAt);

  // 2. Perform Linear Regression on history
  const n = historyPoints.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
  for (let i = 0; i < n; i++) {
    const x = i;
    const y = historyPoints[i].price;
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumXX += x * x;
  }

  const denominator = (n * sumXX - sumX * sumX);
  const slope = denominator !== 0 ? (n * sumXY - sumX * sumY) / denominator : 0;

  // 3. Evaluate Festival Sale Heuristics
  // Diwali / Indian Festive Sale: Oct 1 - Nov 15
  const diwaliStart = getNextOccurrence(9, 1, now); // Oct 1
  const diwaliEnd = new Date(diwaliStart.getFullYear(), 10, 15); // Nov 15
  
  // Black Friday / Christmas Sales: Nov 15 - Dec 25
  const blackFridayStart = getNextOccurrence(10, 15, now); // Nov 15
  const blackFridayEnd = new Date(blackFridayStart.getFullYear(), 11, 25); // Dec 25

  // Summer Sale: May 1 - June 15
  const summerStart = getNextOccurrence(4, 1, now); // May 1
  const summerEnd = new Date(summerStart.getFullYear(), 5, 15); // Jun 15

  const daysToDiwali = getDiffDays(diwaliStart, now);
  const daysToBF = getDiffDays(blackFridayStart, now);
  const daysToSummer = getDiffDays(summerStart, now);

  const isIndianMarket = item.currency === 'INR' || 
                         ['flipkart', 'myntra', 'ajio', 'meesho'].includes(item.site?.toLowerCase()) || 
                         (item.url && item.url.includes('.in'));

  let activeFestival = null;
  let daysToFestival = 999;
  let isCurrentlyInFestival = false;

  // Determine market-relevant festival
  if (isIndianMarket) {
    // Check if we are currently inside Diwali festive season
    const currentYear = now.getFullYear();
    const tempDiwaliStart = new Date(currentYear, 9, 1);
    const tempDiwaliEnd = new Date(currentYear, 10, 15);
    
    if (now >= tempDiwaliStart && now <= tempDiwaliEnd) {
      isCurrentlyInFestival = true;
      activeFestival = { name: 'Diwali Festive Sale', code: 'diwali' };
    } else {
      activeFestival = { name: 'Diwali Festive Sale', code: 'diwali' };
      daysToFestival = daysToDiwali;
    }
  } else {
    // Check if currently inside BF holiday season
    const currentYear = now.getFullYear();
    const tempBFStart = new Date(currentYear, 10, 15);
    const tempBFEnd = new Date(currentYear, 11, 25);

    if (now >= tempBFStart && now <= tempBFEnd) {
      isCurrentlyInFestival = true;
      activeFestival = { name: 'Black Friday & Holiday Sale', code: 'blackfriday' };
    } else {
      activeFestival = { name: 'Black Friday / Holiday Sale', code: 'blackfriday' };
      daysToFestival = daysToBF;
    }
  }

  // Fallback to summer sale if it's closer and within 45 days
  if (!isCurrentlyInFestival && daysToSummer < daysToFestival && daysToSummer <= 45) {
    activeFestival = { name: 'Summer Sale', code: 'summer' };
    daysToFestival = daysToSummer;
  }

  // 4. Forecast next 7 days of prices
  const predictions = [];
  let festivalPriceDropRatio = 0;

  // If approaching festival (within 30 days), start applying drop factor in predictions
  if (activeFestival && !isCurrentlyInFestival && daysToFestival <= 30) {
    // Expected drop strength escalates closer to the festival (up to 12% total drop)
    festivalPriceDropRatio = (31 - daysToFestival) * 0.004; // max ~0.12 (12% discount)
  }

  // Generate 7 predicted days
  for (let d = 1; d <= 7; d++) {
    const predDate = new Date(now);
    predDate.setDate(now.getDate() + d);

    // Apply linear trend slope + festival discount pull
    let predictedPrice = currentPrice + (slope * d);
    if (festivalPriceDropRatio > 0) {
      // Pull price down gradually towards the sale start
      const dailyDropFactor = (d / 7) * festivalPriceDropRatio;
      predictedPrice = predictedPrice * (1 - dailyDropFactor);
    }

    // Clamp predicted price: shouldn't drop below 20% of current price or go negative
    const minClampedPrice = Math.max(1, Math.round(currentPrice * 0.2));
    predictedPrice = Math.max(minClampedPrice, Math.round(predictedPrice));

    predictions.push({
      predictedPrice: predictedPrice,
      recordedAt: predDate
    });
  }

  // 5. Formulate Recommendation
  let decision = 'WAIT';
  let message = '';
  let confidence = 75;

  if (isCurrentlyInFestival) {
    // If inside a festival sale, check if price is discounted compared to history maximum
    const maxHistPrice = Math.max(...historyPoints.map(h => h.price));
    const isDiscounted = currentPrice < maxHistPrice * 0.95; // at least 5% off peak

    if (isDiscounted || currentPrice <= item.targetPrice) {
      decision = 'BUY';
      message = `BUY NOW: ${activeFestival.name} is live! The current price is discounted and highly unlikely to get cheaper before the festival ends.`;
      confidence = 90;
    } else {
      decision = 'WAIT';
      message = `WAIT: Although ${activeFestival.name} is live, the current price is still elevated. We recommend waiting for a flash deal or price drop.`;
      confidence = 72;
    }
  } else if (activeFestival && daysToFestival <= 30) {
    // Approaching a major sale
    decision = 'WAIT';
    message = `WAIT: The major ${activeFestival.name} is starting in just ${daysToFestival} days! Prices are highly expected to drop. Hold off your purchase if possible.`;
    confidence = 88;
  } else {
    // Standard Trend Analysis (Linear Regression slope)
    const relativeSlope = slope / currentPrice; // relative daily change rate

    if (currentPrice <= item.targetPrice) {
      decision = 'BUY';
      message = `BUY NOW: Price has dropped to ${symbol}${currentPrice.toLocaleString()}, meeting your target threshold of ${symbol}${item.targetPrice.toLocaleString()}!`;
      confidence = 95;
    } else if (relativeSlope < -0.004) {
      // Declining more than 0.4% per day
      decision = 'WAIT';
      message = `WAIT: Price is on a steady downward trend, likely to decrease in the next 7 days. Better deals are around the corner.`;
      confidence = Math.min(92, Math.max(68, Math.round(75 + Math.abs(relativeSlope) * 1000)));
    } else if (relativeSlope > 0.004) {
      // Rising more than 0.4% per day
      decision = 'BUY';
      message = `BUY NOW: Price is on an upward trend. Buy now before it gets more expensive in the coming days.`;
      confidence = Math.min(90, Math.max(65, Math.round(70 + relativeSlope * 1000)));
    } else {
      // Stable price
      decision = 'BUY';
      message = `BUY NOW: Price is stable and unlikely to get significantly cheaper in the near future. Good time to buy.`;
      confidence = 78;
    }
  }

  // Adjust expectation details
  const endPredictedPrice = predictions[predictions.length - 1].predictedPrice;
  const expectedChange = endPredictedPrice - currentPrice;

  return {
    history: historyPoints,
    predictions: predictions,
    recommendation: {
      decision,
      message,
      confidence,
      expectedChange
    }
  };
};

module.exports = {
  getPredictions
};
