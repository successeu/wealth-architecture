/**
 * WEALTH SCORE API - Node.js Backend
 * 
 * Currency-aware, ratio-based scoring engine
 * Max Score: 50 points
 * 
 * Components:
 * - Income Capacity (0-10)
 * - Income Structure (0-10)
 * - Savings Rate (0-15)
 * - Asset Strength (0-15)
 */

// ============================================
// CURRENCY CONVERSION
// ============================================

const FX_RATES = {
  USD: 1,
  SGD: 0.74,
  MYR: 0.21,
  IDR: 0.000064,
  THB: 0.027,
  PHP: 0.018,
  AUD: 0.66,
  GBP: 1.27,
  EUR: 1.09,
  INR: 0.012,
  HKD: 0.13,
  CNY: 0.14,
  JPY: 0.0067,
  KRW: 0.00075,
  VND: 0.00004,
  NZD: 0.61,
  CAD: 0.74,
  CHF: 1.12
};

function toUSD(amount, currency) {
  return amount * (FX_RATES[currency] || 1);
}

// ============================================
// INCOME TIER MAPPING
// ============================================

const INCOME_TIER_MIDPOINTS = {
  '1': 75000,      // 50K-100K range
  '2': 125000,     // 100K-150K range
  '3': 200000,     // 150K-250K range
  '4': 375000,     // 250K-500K range
  '5': 750000,     // 500K+ range
  'Under 50K': 35000,
  '50-100K': 75000,
  '100-150K': 125000,
  '150-250K': 200000,
  '250-500K': 375000,
  '500K-1M': 750000,
  '1M-2M': 1500000,
  '2M-5M': 3500000,
  '5M+': 7500000
};

function getAnnualIncomeFromTier(incomeTier) {
  return INCOME_TIER_MIDPOINTS[incomeTier] || 100000;
}

// ============================================
// SCORING COMPONENTS
// ============================================

/**
 * Component 1: Income Capacity (0-10 points)
 * Measures raw earning power normalized to USD
 */
function scoreIncomeCapacity(annualIncomeUSD) {
  if (annualIncomeUSD < 30000) return 2;
  if (annualIncomeUSD < 70000) return 4;
  if (annualIncomeUSD < 150000) return 6;
  if (annualIncomeUSD < 300000) return 8;
  return 10;
}

/**
 * Component 2: Income Structure (0-10 points)
 * Measures passive vs active income, multiple streams
 */
const STRUCTURE_POINTS = {
  'multiple income': 4,
  'single income': 2,
  'growing income': 3,
  'stuck': 1,
  'exploring': 2,
  'business owner': 4,
  'investor': 4,
  'employed': 2,
  'professional': 3,
  'consultant': 3,
  'retired': 5,
  'other': 1
};

function scoreIncomeStructure(statusString) {
  if (!statusString) return 1;
  const statusLower = statusString.toLowerCase();
  
  let maxScore = 0;
  let matchCount = 0;
  
  for (const [key, points] of Object.entries(STRUCTURE_POINTS)) {
    if (statusLower.includes(key)) {
      maxScore = Math.max(maxScore, points);
      matchCount++;
    }
  }
  
  // Bonus for multiple income sources
  const bonus = matchCount >= 2 ? 2 : 0;
  return Math.min(maxScore + bonus, 10);
}

/**
 * Component 3: Savings Rate (0-15 points)
 * Measures surplus as percentage of income
 */
function scoreSavingsRate(monthlySurplusUSD, annualIncomeUSD) {
  const monthlyIncome = annualIncomeUSD / 12;
  if (monthlyIncome <= 0) return 0;
  
  const rate = monthlySurplusUSD / monthlyIncome;
  
  if (rate < 0.05) return 2;
  if (rate < 0.10) return 5;
  if (rate < 0.20) return 9;
  if (rate < 0.30) return 12;
  return 15;
}

/**
 * Component 4: Asset Strength (0-15 points)
 * Measures assets relative to annual income
 */
function scoreAssetStrength(totalAssetsUSD, annualIncomeUSD) {
  if (annualIncomeUSD <= 0) return 0;
  
  const ratio = totalAssetsUSD / annualIncomeUSD;
  
  if (ratio < 0.25) return 2;
  if (ratio < 0.50) return 5;
  if (ratio < 1.00) return 9;
  if (ratio < 2.00) return 12;
  return 15;
}

// ============================================
// STAGE MAPPING
// ============================================

function getWealthStage(score) {
  if (score <= 12) return 'Survival Mode';
  if (score <= 25) return 'Stability Trap';
  if (score <= 37) return 'Growth Phase';
  return 'Freedom Path';
}

function getStageDescription(stage) {
  const descriptions = {
    'Survival Mode': 'You are focused on meeting basic financial needs. The priority is building stability and emergency reserves.',
    'Stability Trap': 'You have stability but are not yet building significant wealth. Income is not converting to assets fast enough.',
    'Growth Phase': 'You are actively building wealth. Focus on optimizing your strategy and accelerating asset accumulation.',
    'Freedom Path': 'You have strong financial foundations. Continue optimizing for passive income and long-term wealth preservation.'
  };
  return descriptions[stage] || '';
}

// ============================================
// BOTTLENECK DETECTION
// ============================================

const BOTTLENECK_INSIGHTS = {
  incomeCapacity: {
    label: 'Income Capacity',
    insight: 'Your earning capacity is still limiting your wealth-building options. Focus on increasing your income through skills, promotions, or additional revenue streams.',
    action: 'Invest in high-value skills or explore additional income opportunities.'
  },
  incomeStructure: {
    label: 'Income Structure',
    insight: 'Your income still depends too heavily on active effort. Building passive income streams will accelerate your path to financial freedom.',
    action: 'Start building passive income through investments, business systems, or royalties.'
  },
  savingsRate: {
    label: 'Savings Rate',
    insight: 'Your income is not converting into investable surplus fast enough. Review your expenses and find ways to increase your savings rate.',
    action: 'Audit expenses and automate savings to increase your surplus rate.'
  },
  assetStrength: {
    label: 'Asset Strength',
    insight: 'You have not yet built enough financial reserves to create real stability. Prioritize building your asset base through consistent investing.',
    action: 'Prioritize consistent investing and avoid lifestyle inflation.'
  }
};

function getPrimaryBottleneck(breakdown) {
  const entries = [
    { key: 'incomeCapacity', score: breakdown.incomeCapacity, max: 10 },
    { key: 'incomeStructure', score: breakdown.incomeStructure, max: 10 },
    { key: 'savingsRate', score: breakdown.savingsRate, max: 15 },
    { key: 'assetStrength', score: breakdown.assetStrength, max: 15 }
  ];
  
  // Calculate percentage of max for fair comparison
  entries.forEach(e => e.percentage = e.score / e.max);
  
  // Sort by percentage (lowest first)
  entries.sort((a, b) => a.percentage - b.percentage);
  
  return entries[0].key;
}

function getSecondaryBottleneck(breakdown) {
  const entries = [
    { key: 'incomeCapacity', score: breakdown.incomeCapacity, max: 10 },
    { key: 'incomeStructure', score: breakdown.incomeStructure, max: 10 },
    { key: 'savingsRate', score: breakdown.savingsRate, max: 15 },
    { key: 'assetStrength', score: breakdown.assetStrength, max: 15 }
  ];
  
  entries.forEach(e => e.percentage = e.score / e.max);
  entries.sort((a, b) => a.percentage - b.percentage);
  
  return entries[1].key;
}

// ============================================
// MAIN CALCULATOR
// ============================================

/**
 * Calculate wealth score from input data
 * 
 * @param {Object} data - Input data
 * @param {string} data.currency - Currency code (e.g., 'SGD', 'USD')
 * @param {string|number} data.income_tier - Income tier (1-5) or range string
 * @param {number} data.annual_income - Optional: exact annual income (overrides tier)
 * @param {number} data.monthly_surplus - Monthly savings/surplus amount
 * @param {number} data.total_assets - Total liquid assets/reserves
 * @param {string|string[]} data.income_status - Status selections (comma-separated or array)
 * 
 * @returns {Object} Score result with breakdown and insights
 */
function calculateWealthScore(data) {
  // Validate required fields
  if (!data.currency) {
    throw new Error('Currency is required');
  }
  
  // Get annual income (prefer exact amount, fall back to tier)
  let annualIncomeLocal;
  if (data.annual_income && data.annual_income > 0) {
    annualIncomeLocal = data.annual_income;
  } else if (data.income_tier) {
    annualIncomeLocal = getAnnualIncomeFromTier(data.income_tier);
  } else {
    throw new Error('Either annual_income or income_tier is required');
  }
  
  // Convert to USD
  const currency = data.currency.toUpperCase();
  const annualIncomeUSD = toUSD(annualIncomeLocal, currency);
  const monthlySurplusUSD = toUSD(data.monthly_surplus || 0, currency);
  const totalAssetsUSD = toUSD(data.total_assets || 0, currency);
  
  // Normalize status to string
  let statusString = '';
  if (Array.isArray(data.income_status)) {
    statusString = data.income_status.join(', ');
  } else if (typeof data.income_status === 'string') {
    statusString = data.income_status;
  }
  
  // Calculate component scores
  const incomeCapacity = scoreIncomeCapacity(annualIncomeUSD);
  const incomeStructure = scoreIncomeStructure(statusString);
  const savingsRate = scoreSavingsRate(monthlySurplusUSD, annualIncomeUSD);
  const assetStrength = scoreAssetStrength(totalAssetsUSD, annualIncomeUSD);
  
  // Calculate totals
  const rawTotal = incomeCapacity + incomeStructure + savingsRate + assetStrength;
  const total = Math.round(Math.min(rawTotal, 50));
  
  // Get stage and bottlenecks
  const stage = getWealthStage(total);
  const breakdown = { incomeCapacity, incomeStructure, savingsRate, assetStrength };
  const primaryBottleneck = getPrimaryBottleneck(breakdown);
  const secondaryBottleneck = getSecondaryBottleneck(breakdown);
  
  // Calculate ratios for reference
  const monthlyIncome = annualIncomeUSD / 12;
  const savingsRatePercent = monthlyIncome > 0 ? (monthlySurplusUSD / monthlyIncome) * 100 : 0;
  const assetRatio = annualIncomeUSD > 0 ? totalAssetsUSD / annualIncomeUSD : 0;
  
  return {
    // Core result
    score: total,
    maxScore: 50,
    stage: stage,
    stageDescription: getStageDescription(stage),
    
    // Breakdown
    breakdown: {
      incomeCapacity: {
        score: incomeCapacity,
        maxScore: 10,
        percentage: Math.round((incomeCapacity / 10) * 100)
      },
      incomeStructure: {
        score: incomeStructure,
        maxScore: 10,
        percentage: Math.round((incomeStructure / 10) * 100)
      },
      savingsRate: {
        score: savingsRate,
        maxScore: 15,
        percentage: Math.round((savingsRate / 15) * 100)
      },
      assetStrength: {
        score: assetStrength,
        maxScore: 15,
        percentage: Math.round((assetStrength / 15) * 100)
      }
    },
    
    // Insights
    insights: {
      primaryBottleneck: {
        key: primaryBottleneck,
        ...BOTTLENECK_INSIGHTS[primaryBottleneck]
      },
      secondaryBottleneck: {
        key: secondaryBottleneck,
        ...BOTTLENECK_INSIGHTS[secondaryBottleneck]
      }
    },
    
    // Calculated metrics (for reference)
    metrics: {
      annualIncomeUSD: Math.round(annualIncomeUSD),
      monthlySurplusUSD: Math.round(monthlySurplusUSD),
      totalAssetsUSD: Math.round(totalAssetsUSD),
      savingsRatePercent: Math.round(savingsRatePercent * 10) / 10,
      assetToIncomeRatio: Math.round(assetRatio * 100) / 100
    },
    
    // Input echo (for verification)
    input: {
      currency: currency,
      annualIncomeLocal: annualIncomeLocal,
      monthlySurplus: data.monthly_surplus || 0,
      totalAssets: data.total_assets || 0,
      incomeStatus: statusString
    }
  };
}

// ============================================
// EXPRESS API ENDPOINT (Example)
// ============================================

/**
 * Example Express.js route handler
 * 
 * POST /api/wealth-score
 * Content-Type: application/json
 * 
 * Request body: see calculateWealthScore input
 * Response: see calculateWealthScore output
 */
function createExpressHandler() {
  return (req, res) => {
    try {
      const result = calculateWealthScore(req.body);
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  };
}

// ============================================
// VERCEL SERVERLESS FUNCTION
// ============================================

/**
 * Vercel serverless function handler
 * 
 * Deploy as: api/wealth-score.js
 */
async function vercelHandler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }
  
  try {
    const result = calculateWealthScore(req.body);
    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      error: error.message
    });
  }
}

// ============================================
// EXPORTS
// ============================================

module.exports = {
  // Main function
  calculateWealthScore,
  
  // Individual components (for testing)
  scoreIncomeCapacity,
  scoreIncomeStructure,
  scoreSavingsRate,
  scoreAssetStrength,
  
  // Helpers
  toUSD,
  getWealthStage,
  getPrimaryBottleneck,
  getAnnualIncomeFromTier,
  
  // Constants
  FX_RATES,
  INCOME_TIER_MIDPOINTS,
  STRUCTURE_POINTS,
  BOTTLENECK_INSIGHTS,
  
  // Handlers
  createExpressHandler,
  vercelHandler
};

// For Vercel deployment
module.exports.default = vercelHandler;
