"""
WEALTH SCORE API - Python Backend

Currency-aware, ratio-based scoring engine
Max Score: 50 points

Components:
- Income Capacity (0-10)
- Income Structure (0-10)
- Savings Rate (0-15)
- Asset Strength (0-15)
"""

from typing import Dict, List, Optional, Union
from dataclasses import dataclass
from enum import Enum
import json

# ============================================
# CURRENCY CONVERSION
# ============================================

FX_RATES: Dict[str, float] = {
    "USD": 1.0,
    "SGD": 0.74,
    "MYR": 0.21,
    "IDR": 0.000064,
    "THB": 0.027,
    "PHP": 0.018,
    "AUD": 0.66,
    "GBP": 1.27,
    "EUR": 1.09,
    "INR": 0.012,
    "HKD": 0.13,
    "CNY": 0.14,
    "JPY": 0.0067,
    "KRW": 0.00075,
    "VND": 0.00004,
    "NZD": 0.61,
    "CAD": 0.74,
    "CHF": 1.12,
}


def to_usd(amount: float, currency: str) -> float:
    """Convert amount from local currency to USD."""
    return amount * FX_RATES.get(currency.upper(), 1.0)


# ============================================
# INCOME TIER MAPPING
# ============================================

INCOME_TIER_MIDPOINTS: Dict[str, int] = {
    "1": 75000,       # 50K-100K range
    "2": 125000,      # 100K-150K range
    "3": 200000,      # 150K-250K range
    "4": 375000,      # 250K-500K range
    "5": 750000,      # 500K+ range
    "Under 50K": 35000,
    "50-100K": 75000,
    "100-150K": 125000,
    "150-250K": 200000,
    "250-500K": 375000,
    "500K-1M": 750000,
    "1M-2M": 1500000,
    "2M-5M": 3500000,
    "5M+": 7500000,
}


def get_annual_income_from_tier(income_tier: str) -> int:
    """Get annual income midpoint from tier selection."""
    return INCOME_TIER_MIDPOINTS.get(str(income_tier), 100000)


# ============================================
# SCORING COMPONENTS
# ============================================

def score_income_capacity(annual_income_usd: float) -> int:
    """
    Component 1: Income Capacity (0-10 points)
    Measures raw earning power normalized to USD.
    """
    if annual_income_usd < 30000:
        return 2
    if annual_income_usd < 70000:
        return 4
    if annual_income_usd < 150000:
        return 6
    if annual_income_usd < 300000:
        return 8
    return 10


STRUCTURE_POINTS: Dict[str, int] = {
    "multiple income": 4,
    "single income": 2,
    "growing income": 3,
    "stuck": 1,
    "exploring": 2,
    "business owner": 4,
    "investor": 4,
    "employed": 2,
    "professional": 3,
    "consultant": 3,
    "retired": 5,
    "other": 1,
}


def score_income_structure(status_string: Optional[str]) -> int:
    """
    Component 2: Income Structure (0-10 points)
    Measures passive vs active income, multiple streams.
    """
    if not status_string:
        return 1
    
    status_lower = status_string.lower()
    max_score = 0
    match_count = 0
    
    for key, points in STRUCTURE_POINTS.items():
        if key in status_lower:
            max_score = max(max_score, points)
            match_count += 1
    
    # Bonus for multiple income sources
    bonus = 2 if match_count >= 2 else 0
    return min(max_score + bonus, 10)


def score_savings_rate(monthly_surplus_usd: float, annual_income_usd: float) -> int:
    """
    Component 3: Savings Rate (0-15 points)
    Measures surplus as percentage of income.
    """
    monthly_income = annual_income_usd / 12
    if monthly_income <= 0:
        return 0
    
    rate = monthly_surplus_usd / monthly_income
    
    if rate < 0.05:
        return 2
    if rate < 0.10:
        return 5
    if rate < 0.20:
        return 9
    if rate < 0.30:
        return 12
    return 15


def score_asset_strength(total_assets_usd: float, annual_income_usd: float) -> int:
    """
    Component 4: Asset Strength (0-15 points)
    Measures assets relative to annual income.
    """
    if annual_income_usd <= 0:
        return 0
    
    ratio = total_assets_usd / annual_income_usd
    
    if ratio < 0.25:
        return 2
    if ratio < 0.50:
        return 5
    if ratio < 1.00:
        return 9
    if ratio < 2.00:
        return 12
    return 15


# ============================================
# STAGE MAPPING
# ============================================

class WealthStage(Enum):
    SURVIVAL_MODE = "Survival Mode"
    STABILITY_TRAP = "Stability Trap"
    GROWTH_PHASE = "Growth Phase"
    FREEDOM_PATH = "Freedom Path"


def get_wealth_stage(score: int) -> str:
    """Get wealth stage label from score."""
    if score <= 12:
        return WealthStage.SURVIVAL_MODE.value
    if score <= 25:
        return WealthStage.STABILITY_TRAP.value
    if score <= 37:
        return WealthStage.GROWTH_PHASE.value
    return WealthStage.FREEDOM_PATH.value


STAGE_DESCRIPTIONS: Dict[str, str] = {
    "Survival Mode": "You are focused on meeting basic financial needs. The priority is building stability and emergency reserves.",
    "Stability Trap": "You have stability but are not yet building significant wealth. Income is not converting to assets fast enough.",
    "Growth Phase": "You are actively building wealth. Focus on optimizing your strategy and accelerating asset accumulation.",
    "Freedom Path": "You have strong financial foundations. Continue optimizing for passive income and long-term wealth preservation.",
}


# ============================================
# BOTTLENECK DETECTION
# ============================================

BOTTLENECK_INSIGHTS: Dict[str, Dict[str, str]] = {
    "incomeCapacity": {
        "label": "Income Capacity",
        "insight": "Your earning capacity is still limiting your wealth-building options. Focus on increasing your income through skills, promotions, or additional revenue streams.",
        "action": "Invest in high-value skills or explore additional income opportunities.",
    },
    "incomeStructure": {
        "label": "Income Structure",
        "insight": "Your income still depends too heavily on active effort. Building passive income streams will accelerate your path to financial freedom.",
        "action": "Start building passive income through investments, business systems, or royalties.",
    },
    "savingsRate": {
        "label": "Savings Rate",
        "insight": "Your income is not converting into investable surplus fast enough. Review your expenses and find ways to increase your savings rate.",
        "action": "Audit expenses and automate savings to increase your surplus rate.",
    },
    "assetStrength": {
        "label": "Asset Strength",
        "insight": "You have not yet built enough financial reserves to create real stability. Prioritize building your asset base through consistent investing.",
        "action": "Prioritize consistent investing and avoid lifestyle inflation.",
    },
}


def get_bottlenecks(breakdown: Dict[str, int]) -> tuple:
    """Get primary and secondary bottlenecks from breakdown."""
    entries = [
        {"key": "incomeCapacity", "score": breakdown["incomeCapacity"], "max": 10},
        {"key": "incomeStructure", "score": breakdown["incomeStructure"], "max": 10},
        {"key": "savingsRate", "score": breakdown["savingsRate"], "max": 15},
        {"key": "assetStrength", "score": breakdown["assetStrength"], "max": 15},
    ]
    
    # Calculate percentage of max for fair comparison
    for e in entries:
        e["percentage"] = e["score"] / e["max"]
    
    # Sort by percentage (lowest first)
    entries.sort(key=lambda x: x["percentage"])
    
    return entries[0]["key"], entries[1]["key"]


# ============================================
# DATA CLASSES
# ============================================

@dataclass
class WealthScoreInput:
    """Input data for wealth score calculation."""
    currency: str
    income_tier: Optional[str] = None
    annual_income: Optional[float] = None
    monthly_surplus: float = 0
    total_assets: float = 0
    income_status: Union[str, List[str], None] = None


@dataclass
class ComponentScore:
    """Individual component score."""
    score: int
    max_score: int
    percentage: int


@dataclass
class BottleneckInsight:
    """Bottleneck insight data."""
    key: str
    label: str
    insight: str
    action: str


@dataclass 
class WealthScoreResult:
    """Complete wealth score result."""
    score: int
    max_score: int
    stage: str
    stage_description: str
    breakdown: Dict[str, ComponentScore]
    insights: Dict[str, BottleneckInsight]
    metrics: Dict[str, float]
    input_echo: Dict[str, any]
    
    def to_dict(self) -> Dict:
        """Convert to dictionary for JSON serialization."""
        return {
            "score": self.score,
            "maxScore": self.max_score,
            "stage": self.stage,
            "stageDescription": self.stage_description,
            "breakdown": {
                k: {"score": v.score, "maxScore": v.max_score, "percentage": v.percentage}
                for k, v in self.breakdown.items()
            },
            "insights": {
                k: {"key": v.key, "label": v.label, "insight": v.insight, "action": v.action}
                for k, v in self.insights.items()
            },
            "metrics": self.metrics,
            "input": self.input_echo,
        }


# ============================================
# MAIN CALCULATOR
# ============================================

def calculate_wealth_score(data: Union[Dict, WealthScoreInput]) -> Dict:
    """
    Calculate wealth score from input data.
    
    Args:
        data: Dictionary or WealthScoreInput with:
            - currency: Currency code (e.g., 'SGD', 'USD')
            - income_tier: Income tier (1-5) or range string
            - annual_income: Optional exact annual income (overrides tier)
            - monthly_surplus: Monthly savings/surplus amount
            - total_assets: Total liquid assets/reserves
            - income_status: Status selections (comma-separated or list)
    
    Returns:
        Dictionary with score, breakdown, insights, and metrics
    """
    # Handle dict input
    if isinstance(data, dict):
        currency = data.get("currency", "USD")
        income_tier = data.get("income_tier")
        annual_income = data.get("annual_income")
        monthly_surplus = data.get("monthly_surplus", 0) or 0
        total_assets = data.get("total_assets", 0) or 0
        income_status = data.get("income_status")
    else:
        currency = data.currency
        income_tier = data.income_tier
        annual_income = data.annual_income
        monthly_surplus = data.monthly_surplus
        total_assets = data.total_assets
        income_status = data.income_status
    
    # Validate required fields
    if not currency:
        raise ValueError("Currency is required")
    
    # Get annual income (prefer exact amount, fall back to tier)
    if annual_income and annual_income > 0:
        annual_income_local = annual_income
    elif income_tier:
        annual_income_local = get_annual_income_from_tier(income_tier)
    else:
        raise ValueError("Either annual_income or income_tier is required")
    
    # Convert to USD
    currency = currency.upper()
    annual_income_usd = to_usd(annual_income_local, currency)
    monthly_surplus_usd = to_usd(monthly_surplus, currency)
    total_assets_usd = to_usd(total_assets, currency)
    
    # Normalize status to string
    if isinstance(income_status, list):
        status_string = ", ".join(income_status)
    elif isinstance(income_status, str):
        status_string = income_status
    else:
        status_string = ""
    
    # Calculate component scores
    income_capacity = score_income_capacity(annual_income_usd)
    income_structure = score_income_structure(status_string)
    savings_rate = score_savings_rate(monthly_surplus_usd, annual_income_usd)
    asset_strength = score_asset_strength(total_assets_usd, annual_income_usd)
    
    # Calculate totals
    raw_total = income_capacity + income_structure + savings_rate + asset_strength
    total = round(min(raw_total, 50))
    
    # Get stage and bottlenecks
    stage = get_wealth_stage(total)
    breakdown = {
        "incomeCapacity": income_capacity,
        "incomeStructure": income_structure,
        "savingsRate": savings_rate,
        "assetStrength": asset_strength,
    }
    primary_bottleneck, secondary_bottleneck = get_bottlenecks(breakdown)
    
    # Calculate ratios for reference
    monthly_income = annual_income_usd / 12
    savings_rate_percent = (monthly_surplus_usd / monthly_income * 100) if monthly_income > 0 else 0
    asset_ratio = total_assets_usd / annual_income_usd if annual_income_usd > 0 else 0
    
    # Build result
    result = {
        # Core result
        "score": total,
        "maxScore": 50,
        "stage": stage,
        "stageDescription": STAGE_DESCRIPTIONS.get(stage, ""),
        
        # Breakdown
        "breakdown": {
            "incomeCapacity": {
                "score": income_capacity,
                "maxScore": 10,
                "percentage": round(income_capacity / 10 * 100),
            },
            "incomeStructure": {
                "score": income_structure,
                "maxScore": 10,
                "percentage": round(income_structure / 10 * 100),
            },
            "savingsRate": {
                "score": savings_rate,
                "maxScore": 15,
                "percentage": round(savings_rate / 15 * 100),
            },
            "assetStrength": {
                "score": asset_strength,
                "maxScore": 15,
                "percentage": round(asset_strength / 15 * 100),
            },
        },
        
        # Insights
        "insights": {
            "primaryBottleneck": {
                "key": primary_bottleneck,
                **BOTTLENECK_INSIGHTS[primary_bottleneck],
            },
            "secondaryBottleneck": {
                "key": secondary_bottleneck,
                **BOTTLENECK_INSIGHTS[secondary_bottleneck],
            },
        },
        
        # Calculated metrics
        "metrics": {
            "annualIncomeUSD": round(annual_income_usd),
            "monthlySurplusUSD": round(monthly_surplus_usd),
            "totalAssetsUSD": round(total_assets_usd),
            "savingsRatePercent": round(savings_rate_percent * 10) / 10,
            "assetToIncomeRatio": round(asset_ratio * 100) / 100,
        },
        
        # Input echo
        "input": {
            "currency": currency,
            "annualIncomeLocal": annual_income_local,
            "monthlySurplus": monthly_surplus,
            "totalAssets": total_assets,
            "incomeStatus": status_string,
        },
    }
    
    return result


# ============================================
# FLASK API ENDPOINT (Example)
# ============================================

def create_flask_app():
    """Create Flask app with wealth score endpoint."""
    from flask import Flask, request, jsonify
    from flask_cors import CORS
    
    app = Flask(__name__)
    CORS(app)
    
    @app.route("/api/wealth-score", methods=["POST"])
    def wealth_score_endpoint():
        try:
            data = request.get_json()
            result = calculate_wealth_score(data)
            return jsonify({"success": True, "data": result})
        except Exception as e:
            return jsonify({"success": False, "error": str(e)}), 400
    
    return app


# ============================================
# FASTAPI ENDPOINT (Example)
# ============================================

def create_fastapi_app():
    """Create FastAPI app with wealth score endpoint."""
    from fastapi import FastAPI, HTTPException
    from fastapi.middleware.cors import CORSMiddleware
    from pydantic import BaseModel
    from typing import Optional, List
    
    app = FastAPI(title="Wealth Score API")
    
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["POST"],
        allow_headers=["*"],
    )
    
    class WealthScoreRequest(BaseModel):
        currency: str
        income_tier: Optional[str] = None
        annual_income: Optional[float] = None
        monthly_surplus: float = 0
        total_assets: float = 0
        income_status: Optional[Union[str, List[str]]] = None
    
    @app.post("/api/wealth-score")
    def wealth_score_endpoint(request: WealthScoreRequest):
        try:
            result = calculate_wealth_score(request.dict())
            return {"success": True, "data": result}
        except Exception as e:
            raise HTTPException(status_code=400, detail=str(e))
    
    return app


# ============================================
# AWS LAMBDA HANDLER
# ============================================

def lambda_handler(event, context):
    """AWS Lambda handler for wealth score API."""
    try:
        # Parse body
        if isinstance(event.get("body"), str):
            data = json.loads(event["body"])
        else:
            data = event.get("body", {})
        
        result = calculate_wealth_score(data)
        
        return {
            "statusCode": 200,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
            },
            "body": json.dumps({"success": True, "data": result}),
        }
    except Exception as e:
        return {
            "statusCode": 400,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
            },
            "body": json.dumps({"success": False, "error": str(e)}),
        }


# ============================================
# MAIN (for testing)
# ============================================

if __name__ == "__main__":
    # Test calculation
    test_data = {
        "currency": "SGD",
        "income_tier": "3",
        "monthly_surplus": 2500,
        "total_assets": 90000,
        "income_status": "Employed",
    }
    
    result = calculate_wealth_score(test_data)
    print(json.dumps(result, indent=2))
