# Wealth Score API

Currency-aware, ratio-based wealth scoring engine with a 50-point maximum score.

## Overview

The Wealth Score API calculates a user's financial position based on four components:

| Component | Max Points | What It Measures |
|-----------|------------|------------------|
| **Income Capacity** | 10 | Raw earning power (USD normalized) |
| **Income Structure** | 10 | Passive vs active income |
| **Savings Rate** | 15 | Surplus ÷ Income ratio |
| **Asset Strength** | 15 | Assets ÷ Income ratio |
| **TOTAL** | **50** | |

## Wealth Stages

| Score Range | Stage | Description |
|-------------|-------|-------------|
| 0-12 | **Survival Mode** | Focused on meeting basic financial needs |
| 13-25 | **Stability Trap** | Stable but not building significant wealth |
| 26-37 | **Growth Phase** | Actively building wealth |
| 38-50 | **Freedom Path** | Strong foundations, optimizing for freedom |

---

## API Endpoint

```
POST /api/wealth-score
Content-Type: application/json
```

### Request Body

```json
{
  "currency": "SGD",
  "income_tier": "3",
  "monthly_surplus": 2500,
  "total_assets": 90000,
  "income_status": "Employed"
}
```

#### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `currency` | string | Currency code (USD, SGD, MYR, etc.) |
| `income_tier` OR `annual_income` | string/number | Income level |

#### Optional Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `annual_income` | number | - | Exact annual income (overrides tier) |
| `monthly_surplus` | number | 0 | Monthly savings amount |
| `total_assets` | number | 0 | Total liquid assets |
| `income_status` | string/array | - | Income source selections |

#### Supported Currencies

```
USD, SGD, MYR, IDR, THB, PHP, AUD, GBP, EUR, 
INR, HKD, CNY, JPY, KRW, VND, NZD, CAD, CHF
```

#### Income Tiers

| Tier | Range |
|------|-------|
| 1 | 50K-100K |
| 2 | 100K-150K |
| 3 | 150K-250K |
| 4 | 250K-500K |
| 5 | 500K+ |

---

### Response

```json
{
  "success": true,
  "data": {
    "score": 22,
    "maxScore": 50,
    "stage": "Stability Trap",
    "stageDescription": "You have stability but are not yet building significant wealth...",
    
    "breakdown": {
      "incomeCapacity": { "score": 6, "maxScore": 10, "percentage": 60 },
      "incomeStructure": { "score": 2, "maxScore": 10, "percentage": 20 },
      "savingsRate": { "score": 9, "maxScore": 15, "percentage": 60 },
      "assetStrength": { "score": 5, "maxScore": 15, "percentage": 33 }
    },
    
    "insights": {
      "primaryBottleneck": {
        "key": "incomeStructure",
        "label": "Income Structure",
        "insight": "Your income still depends too heavily on active effort...",
        "action": "Start building passive income through investments..."
      },
      "secondaryBottleneck": {
        "key": "assetStrength",
        "label": "Asset Strength",
        "insight": "You have not yet built enough financial reserves...",
        "action": "Prioritize consistent investing..."
      }
    },
    
    "metrics": {
      "annualIncomeUSD": 148000,
      "monthlySurplusUSD": 1850,
      "totalAssetsUSD": 66600,
      "savingsRatePercent": 15.0,
      "assetToIncomeRatio": 0.45
    },
    
    "input": {
      "currency": "SGD",
      "annualIncomeLocal": 200000,
      "monthlySurplus": 2500,
      "totalAssets": 90000,
      "incomeStatus": "Employed"
    }
  }
}
```

---

## Scoring Logic

### 1. Income Capacity (0-10 points)

Based on annual income converted to USD:

| USD Income | Points |
|------------|--------|
| < $30,000 | 2 |
| $30,000 - $69,999 | 4 |
| $70,000 - $149,999 | 6 |
| $150,000 - $299,999 | 8 |
| $300,000+ | 10 |

### 2. Income Structure (0-10 points)

Based on status keywords (highest match + bonus):

| Keyword | Points |
|---------|--------|
| retired | 5 |
| business owner, investor, multiple income | 4 |
| professional, consultant, growing income | 3 |
| employed, single income, exploring | 2 |
| stuck, other | 1 |

**Bonus:** +2 points if 2+ keywords match

### 3. Savings Rate (0-15 points)

Based on monthly surplus ÷ monthly income:

| Savings Rate | Points |
|--------------|--------|
| < 5% | 2 |
| 5% - 9.9% | 5 |
| 10% - 19.9% | 9 |
| 20% - 29.9% | 12 |
| 30%+ | 15 |

### 4. Asset Strength (0-15 points)

Based on total assets ÷ annual income:

| Asset Ratio | Points |
|-------------|--------|
| < 0.25x | 2 |
| 0.25x - 0.49x | 5 |
| 0.50x - 0.99x | 9 |
| 1.0x - 1.99x | 12 |
| 2.0x+ | 15 |

---

## Bottleneck Detection

The API identifies the **weakest component** (lowest percentage of max) as the primary bottleneck, with personalized insights and recommended actions.

---

## Installation

### Node.js

```bash
npm install
```

```javascript
const { calculateWealthScore } = require('./wealth-score-api');

const result = calculateWealthScore({
  currency: 'SGD',
  income_tier: '3',
  monthly_surplus: 2500,
  total_assets: 90000,
  income_status: 'Employed'
});

console.log(result);
```

### Python

```bash
pip install flask flask-cors
# or
pip install fastapi uvicorn
```

```python
from wealth_score_api import calculate_wealth_score

result = calculate_wealth_score({
    "currency": "SGD",
    "income_tier": "3",
    "monthly_surplus": 2500,
    "total_assets": 90000,
    "income_status": "Employed"
})

print(result)
```

---

## Deployment

### Vercel (Node.js)

1. Copy `wealth-score-api.js` to `api/wealth-score.js`
2. Deploy to Vercel

```bash
vercel
```

### AWS Lambda (Python)

Use the `lambda_handler` function from `wealth_score_api.py`.

### Flask

```python
from wealth_score_api import create_flask_app

app = create_flask_app()
app.run(port=5000)
```

### FastAPI

```python
from wealth_score_api import create_fastapi_app

app = create_fastapi_app()
# uvicorn main:app --reload
```

---

## Example Calculation

**Input:**
- Currency: SGD
- Annual Income: S$180,000 (Tier 3)
- Monthly Surplus: S$2,500
- Total Assets: S$90,000
- Status: Employed

**USD Conversion:**
- Annual Income: $133,200
- Monthly Surplus: $1,850
- Total Assets: $66,600

**Component Scores:**
- Income Capacity: 6/10 ($133K → 6 points)
- Income Structure: 2/10 (Employed only → 2 points)
- Savings Rate: 9/15 (16.7% rate → 9 points)
- Asset Strength: 5/15 (0.5x ratio → 5 points)

**Total: 22/50 → "Stability Trap"**

**Primary Bottleneck:** Income Structure (20% of max)

---

## Files

| File | Description |
|------|-------------|
| `wealth-score-api.js` | Node.js implementation |
| `wealth_score_api.py` | Python implementation |
| `wealth-score-schema.json` | JSON Schema + API spec |
| `README.md` | This documentation |

---

## Error Handling

```json
{
  "success": false,
  "error": "Currency is required"
}
```

Common errors:
- `Currency is required`
- `Either annual_income or income_tier is required`

---

## Integration with Zapier/Airtable

Store these fields in your CRM:

```json
{
  "currency": "SGD",
  "annual_income": 180000,
  "monthly_surplus": 2500,
  "total_assets": 90000,
  "income_status": "Employed",
  "wealth_score": 22,
  "wealth_stage": "Stability Trap",
  "primary_bottleneck": "incomeStructure",
  "breakdown_income_capacity": 6,
  "breakdown_income_structure": 2,
  "breakdown_savings_rate": 9,
  "breakdown_asset_strength": 5
}
```

This enables:
- Result page personalization
- CRM segmentation
- Follow-up automation
- Ad audience building
