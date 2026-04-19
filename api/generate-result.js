// /api/generate-result.js
// Hybrid Architecture: Backend calculates truth, Claude generates narratives only

import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY
});

// ============================================
// CURRENCY CONVERSION (Same as frontend)
// ============================================

const FX_RATES = {
    // Group 1: US/Standard
    USD: 1,
    // Group 2: Southeast Asia ASEAN
    SGD: 0.74, MYR: 0.21, IDR: 0.000062, THB: 0.028, PHP: 0.017, VND: 0.000039, BND: 0.74,
    // Group 3: Greater China
    HKD: 0.128, TWD: 0.031, CNY: 0.137,
    // Group 4: East Asia
    JPY: 0.0065, KRW: 0.00072,
    // Group 5: South Asia
    INR: 0.012, PKR: 0.0035, BDT: 0.0083, LKR: 0.003, NPR: 0.0074,
    // Group 6: Oceania
    AUD: 0.65, NZD: 0.59,
    // Group 7-9: Europe
    GBP: 1.27, EUR: 1.09, CHF: 1.14,
    // Group 10-12: Gulf
    AED: 0.27, SAR: 0.27, QAR: 0.27, KWD: 3.25, BHD: 2.65, OMR: 2.60,
    // Group 11: Canada
    CAD: 0.73,
    // Group 13-16: Africa & Americas
    ZAR: 0.053, NGN: 0.00063, BRL: 0.19, MXN: 0.058,
    // Group 17-20: Europe & Middle East
    SEK: 0.093, NOK: 0.089, DKK: 0.146,
    PLN: 0.25, CZK: 0.043, HUF: 0.0027, RON: 0.22, RUB: 0.011, UAH: 0.024,
    TRY: 0.029, ILS: 0.27
};

function toUSD(amount, currency) {
    return amount * (FX_RATES[currency] || 1);
}

// ============================================
// INCOME TIER PARSER (Same as frontend)
// ============================================

function getAnnualIncomeFromTier(incomeTier, currency) {
    const tierMidpoints = {
        // Group 1: US/Standard (USD)
        'Under 50K': 35000, '50-100K': 75000, '100-250K': 175000, '250-500K': 375000, '500K+': 750000,
        // Group 2: SE Asia (SGD, MYR, etc)
        'Under 100K': 70000, '500K-1M': 750000, '1M+': 1500000,
        // Group 3: Indonesia (IDR)
        'Under 100M': 70000000, '100-300M': 200000000, '300-750M': 525000000, '750M-1.5B': 1125000000, '1.5B+': 2000000000,
        // Group 4: Vietnam (VND)
        'Under 200M': 150000000, '200-500M': 350000000, '500M-1B': 750000000, '1-3B': 2000000000, '3B+': 4500000000,
        // Group 5: Japan (JPY)
        'Under 5M': 3500000, '5-10M': 7500000, '10-25M': 17500000, '25-50M': 37500000, '50M+': 75000000,
        // Group 6: Korea (KRW)
        'Under 50M': 35000000, '50-100M': 75000000, '100-250M': 175000000, '250-500M': 375000000, '500M+': 750000000,
        // Group 7: China (CNY)
        'Under 300K': 200000, '300-700K': 500000, '700K-1.5M': 1100000, '1.5-3M': 2250000, '3M+': 4500000,
        // Group 8: Taiwan (TWD)
        'Under 400K': 300000, '400-800K': 600000, '800K-2M': 1400000, '2-4M': 3000000, '4M+': 6000000,
        // Group 9: India (INR Lakh/Crore)
        'Under 5L': 350000, '5-15L': 1000000, '15-50L': 3250000, '50L-1Cr': 7500000, '1Cr+': 15000000,
        // Group 10: Bangladesh (BDT)
        'Under 10L': 700000, '10-25L': 1750000, '25-75L': 5000000, '75L-1.5Cr': 11250000, '1.5Cr+': 22500000,
        // Group 11: Gulf AED-pegged
        'Under 150K': 100000, '150-300K': 225000, '300-750K': 525000, '750K-1.5M': 1125000, '1.5M+': 2250000,
        // Group 12: High-value Gulf (KWD, BHD, OMR)
        'Under 15K': 10000, '15-30K': 22500, '30-75K': 52500, '75-150K': 112500, '150K+': 225000,
        // Group 13: South Africa (ZAR)
        'Under 500K': 350000, '500K-1M': 750000, '1-2.5M': 1750000, '2.5-5M': 3750000, '5M+': 7500000,
        // Group 14: Nigeria (NGN)
        'Under 10M': 7000000, '10-30M': 20000000, '30-75M': 52500000, '75-150M': 112500000, '150M+': 225000000,
        // Group 18: Eastern Europe
        'Under 200K': 150000, '200-500K': 350000, '1-2M': 1500000, '2M+': 3000000,
        // Group 19: Turkey
        '1-3M': 2000000, '3-6M': 4500000, '6M+': 9000000,
        // Legacy
        '1': 75000, '2': 125000, '3': 200000, '4': 375000, '5': 750000
    };
    
    if (tierMidpoints[incomeTier]) return tierMidpoints[incomeTier];
    
    // Parse tier string
    const parsed = parseTierValue(incomeTier);
    if (parsed) return parsed;
    
    console.warn(`⚠️ Unknown income tier: ${incomeTier} for ${currency}`);
    return 100000;
}

function parseTierValue(tier) {
    if (!tier) return null;
    const multipliers = { 'K': 1000, 'L': 100000, 'Cr': 10000000, 'M': 1000000, 'B': 1000000000 };
    
    const rangeMatch = tier.match(/(\d+\.?\d*)\s*[-–]\s*(\d+\.?\d*)\s*([KLMBCr]+)?/i);
    if (rangeMatch) {
        const low = parseFloat(rangeMatch[1]);
        const high = parseFloat(rangeMatch[2]);
        const suffix = rangeMatch[3] || '';
        const mult = multipliers[suffix.toUpperCase()] || multipliers[suffix] || 1;
        return ((low + high) / 2) * mult;
    }
    
    const singleMatch = tier.match(/(\d+\.?\d*)\s*([KLMBCr]+)?/i);
    if (singleMatch) {
        const value = parseFloat(singleMatch[1]);
        const suffix = singleMatch[2] || '';
        const mult = multipliers[suffix.toUpperCase()] || multipliers[suffix] || 1;
        if (tier.toLowerCase().includes('under')) return value * mult * 0.7;
        if (tier.includes('+')) return value * mult * 1.5;
        return value * mult;
    }
    return null;
}

// ============================================
// MODULE 1: RULE ENGINE (SOURCE OF TRUTH)
// Currency-normalized, ratio-based scoring
// ============================================

const RuleEngine = {
    // Income Capacity Score (0-10) - Based on USD-normalized income
    getIncomeCapacityScore(annualIncomeUSD) {
        if (annualIncomeUSD < 30000) return 2;
        if (annualIncomeUSD < 70000) return 4;
        if (annualIncomeUSD < 150000) return 6;
        if (annualIncomeUSD < 300000) return 8;
        return 10;
    },

    // Income Structure Score (0-10) - Based on professional status
    getIncomeStructureScore(status) {
        if (!status) return 2;
        const statusLower = status.toLowerCase();
        
        const scores = {
            'multiple income': 4, 'single income': 2, 'growing income': 3, 'stuck': 1,
            'exploring': 2, 'business owner': 4, 'investor': 4, 'employed': 2,
            'professional': 3, 'consultant': 3, 'retired': 5, 'other': 1
        };
        
        let maxScore = 0;
        let matchCount = 0;
        for (const [key, points] of Object.entries(scores)) {
            if (statusLower.includes(key)) {
                maxScore = Math.max(maxScore, points);
                matchCount++;
            }
        }
        const bonus = matchCount >= 2 ? 2 : 0;
        return Math.min(maxScore + bonus, 10) || 2;
    },

    // Savings Rate Score (0-15) - RATIO-BASED
    getSavingsRateScore(monthlySurplusUSD, annualIncomeUSD) {
        const monthlyIncome = annualIncomeUSD / 12;
        if (monthlyIncome <= 0) return 0;
        
        const rate = monthlySurplusUSD / monthlyIncome;
        
        if (rate < 0.05) return 2;
        if (rate < 0.10) return 5;
        if (rate < 0.20) return 9;
        if (rate < 0.30) return 12;
        return 15;
    },

    // Asset Strength Score (0-15) - RATIO-BASED
    getAssetStrengthScore(totalAssetsUSD, annualIncomeUSD) {
        if (annualIncomeUSD <= 0) return 0;
        
        const ratio = totalAssetsUSD / annualIncomeUSD;
        
        if (ratio < 0.25) return 2;
        if (ratio < 0.50) return 5;
        if (ratio < 1.00) return 9;
        if (ratio < 2.00) return 12;
        return 15;
    },

    // Timeframe → Urgency Score (1-4)
    getUrgencyScore(timeframe) {
        const map = {
            '0-3 months': 4, 'Immediate (0-3 months)': 4,
            '3-6 months': 3, 'Soon (3-6 months)': 3,
            'Within this year': 2,
            'Just exploring': 1
        };
        return map[timeframe] || 2;
    },

    // Wealth Score → Stage
    getStage(score) {
        if (score <= 12) return 'Survival Mode';
        if (score <= 25) return 'Stability Trap';
        if (score <= 37) return 'Growth Phase';
        return 'Freedom Path';
    },

    // Lead Tier Classifier
    getLeadTier(urgencyScore, wealthScore) {
        if (urgencyScore >= 4 && wealthScore >= 25) return 'Hot';
        if (urgencyScore >= 3) return 'Warm';
        return 'Cold';
    },

    // Primary Bottleneck Detector
    getBottleneck(breakdown) {
        const pillars = [
            { key: 'incomeCapacity', label: 'Income Capacity', score: breakdown.incomeCapacity, max: 10 },
            { key: 'incomeStructure', label: 'Income Structure', score: breakdown.incomeStructure, max: 10 },
            { key: 'savingsRate', label: 'Savings Rate', score: breakdown.savingsRate, max: 15 },
            { key: 'assetStrength', label: 'Asset Strength', score: breakdown.assetStrength, max: 15 }
        ];

        let weakest = pillars[0];
        pillars.forEach(p => {
            if ((p.score / p.max) < (weakest.score / weakest.max)) {
                weakest = p;
            }
        });

        return weakest;
    },

    // Generate complete truth payload with currency normalization
    generateTruthPayload(input) {
        const currency = input.currency || 'USD';
        
        // Step 1: Parse income tier to local currency amount
        const annualIncomeLocal = getAnnualIncomeFromTier(input.incomeLevel, currency);
        
        // Step 2: Convert to USD for scoring
        const annualIncomeUSD = toUSD(annualIncomeLocal, currency);
        const monthlySurplusUSD = toUSD(parseFloat(input.monthlySurplus) || 0, currency);
        const totalAssetsUSD = toUSD(parseFloat(input.liquidAssets) || 0, currency);
        
        // Step 3: Calculate ratios (for logging)
        const monthlyIncomeUSD = annualIncomeUSD / 12;
        const savingsRateRatio = monthlyIncomeUSD > 0 ? monthlySurplusUSD / monthlyIncomeUSD : 0;
        const assetRatio = annualIncomeUSD > 0 ? totalAssetsUSD / annualIncomeUSD : 0;
        
        // Step 4: Calculate pillar scores using USD-normalized values
        const breakdown = {
            incomeCapacity: this.getIncomeCapacityScore(annualIncomeUSD),
            incomeStructure: this.getIncomeStructureScore(input.professionalStatus),
            savingsRate: this.getSavingsRateScore(monthlySurplusUSD, annualIncomeUSD),
            assetStrength: this.getAssetStrengthScore(totalAssetsUSD, annualIncomeUSD)
        };

        const wealthScore = breakdown.incomeCapacity + breakdown.incomeStructure + breakdown.savingsRate + breakdown.assetStrength;
        const stage = this.getStage(wealthScore);
        const urgencyScore = this.getUrgencyScore(input.timeframe);
        const leadTier = this.getLeadTier(urgencyScore, wealthScore);
        const bottleneck = this.getBottleneck(breakdown);
        const percentage = Math.round((wealthScore / 50) * 100);

        // Log for debugging
        console.log('═══════════════════════════════════════════════');
        console.log('💰 BACKEND WEALTH SCORE CALCULATION');
        console.log('═══════════════════════════════════════════════');
        console.log(`Currency: ${currency} | FX Rate: ${FX_RATES[currency] || 'unknown'}`);
        console.log(`Income Tier: "${input.incomeLevel}" → ${annualIncomeLocal.toLocaleString()} ${currency}`);
        console.log(`Annual Income USD: $${annualIncomeUSD.toLocaleString()}`);
        console.log(`Savings Rate: ${(savingsRateRatio * 100).toFixed(1)}%`);
        console.log(`Asset Ratio: ${assetRatio.toFixed(2)}x annual income`);
        console.log(`Pillar Scores: IC=${breakdown.incomeCapacity}, IS=${breakdown.incomeStructure}, SR=${breakdown.savingsRate}, AS=${breakdown.assetStrength}`);
        console.log(`Total Score: ${wealthScore}/50 → ${stage}`);
        console.log('═══════════════════════════════════════════════');

        return {
            // User info
            firstName: input.firstName,
            lastName: input.lastName,
            fullName: `${input.firstName} ${input.lastName}`,
            email: input.email,
            phone: input.phone,
            country: input.country,
            currency: input.currency,

            // Financial inputs (local currency - for display)
            incomeLevel: input.incomeLevel,
            monthlySurplus: input.monthlySurplus,
            liquidAssets: input.liquidAssets,
            professionalStatus: input.professionalStatus,
            primaryConcern: input.primaryConcern,
            timeframe: input.timeframe,

            // Calculated scores (TRUTH)
            wealthScore,
            percentage,
            stage,
            urgencyScore,
            leadTier,

            // Breakdown
            incomeCapacityScore: breakdown.incomeCapacity,
            incomeStructureScore: breakdown.incomeStructure,
            savingsRateScore: breakdown.savingsRate,
            assetStrengthScore: breakdown.assetStrength,

            // Bottleneck
            primaryBottleneck: bottleneck.label,
            bottleneckKey: bottleneck.key,
            bottleneckScore: bottleneck.score,
            bottleneckMax: bottleneck.max,
            
            // Ratios (for AI narrative context)
            savingsRatePercent: Math.round(savingsRateRatio * 100),
            assetRatioX: assetRatio.toFixed(2)
        };
    }
};

// ============================================
// MODULE 2: TEMPLATE ENGINE (FIXED STRUCTURE)
// Deterministic content based on stage/timeframe
// ============================================

const TemplateEngine = {
    stageTemplates: {
        'Survival Mode': {
            title: 'SURVIVAL MODE',
            description: "You're in survival mode, focused on covering immediate needs.",
            ctaText: 'ESCAPE SURVIVAL MODE →',
            urgencyLevel: 'critical'
        },
        'Stability Trap': {
            title: 'STABILITY TRAP',
            description: "You're earning well, but your wealth isn't growing at the same rate.",
            ctaText: 'BREAK THE STABILITY TRAP →',
            urgencyLevel: 'high'
        },
        'Growth Phase': {
            title: 'GROWTH PHASE',
            description: "You've built a foundation, but you're not accelerating yet.",
            ctaText: 'ACCELERATE YOUR GROWTH →',
            urgencyLevel: 'moderate'
        },
        'Freedom Path': {
            title: 'FREEDOM PATH',
            description: "You're on track, but there's still untapped potential.",
            ctaText: 'UNLOCK YOUR FULL POTENTIAL →',
            urgencyLevel: 'optimize'
        }
    },

    timeframeVariants: {
        '0-3 months': {
            urgencyTitle: 'You want change NOW',
            ctaText: 'SECURE YOUR SPOT NOW →',
            ctaSubtext: 'Limited seats available this month',
            ctaStyle: 'aggressive'
        },
        '3-6 months': {
            urgencyTitle: "You're ready to take action soon",
            ctaText: 'RESERVE YOUR SEAT →',
            ctaSubtext: 'Start your transformation',
            ctaStyle: 'moderate'
        },
        'Within this year': {
            urgencyTitle: "You're planning ahead",
            ctaText: 'EXPLORE THE PROGRAM →',
            ctaSubtext: 'See how it fits your timeline',
            ctaStyle: 'soft'
        },
        'Just exploring': {
            urgencyTitle: "You're doing your research",
            ctaText: 'LEARN MORE →',
            ctaSubtext: 'No commitment required',
            ctaStyle: 'exploratory'
        }
    },

    bottleneckContent: {
        incomeCapacity: {
            title: 'INCOME CAPACITY',
            shortDesc: 'Your earning potential needs attention',
            fullDesc: "You have the potential to earn more, but it's not fully optimized yet.",
            opportunity: 'Increase your earning power through skills, positioning, or career moves.'
        },
        incomeStructure: {
            title: 'INCOME STRUCTURE',
            shortDesc: 'Your income depends too much on your time',
            fullDesc: "Your income is still dependent on active effort. You're trading hours for dollars.",
            opportunity: 'Build passive income streams and diversify your revenue sources.'
        },
        savingsRate: {
            title: 'SAVINGS RATE',
            shortDesc: "You're not saving enough to accelerate",
            fullDesc: "You're saving, but not enough to accelerate your financial freedom.",
            opportunity: 'Optimize your expenses and increase your savings rate to 20%+ of income.'
        },
        assetStrength: {
            title: 'ASSET STRENGTH',
            shortDesc: 'Your financial reserves need building',
            fullDesc: "You haven't built strong enough financial reserves or productive assets yet.",
            opportunity: 'Focus on building 6-12 months of expenses in liquid reserves, then invest.'
        }
    },

    pillarTexts: {
        incomeCapacity(score) {
            if (score >= 8) return 'You have strong earning power.';
            if (score >= 5) return 'You have the potential to earn more.';
            return 'Your earning capacity needs attention.';
        },
        incomeStructure(score) {
            if (score >= 8) return 'You have diversified income sources.';
            if (score >= 5) return 'Your income structure is developing.';
            return 'Your income is still too dependent on active effort.';
        },
        savingsRate(score) {
            if (score >= 12) return 'Excellent savings discipline.';
            if (score >= 7) return "You're saving, but not enough to accelerate your freedom.";
            return 'Your savings rate needs improvement.';
        },
        assetStrength(score) {
            if (score >= 12) return 'Strong asset base established.';
            if (score >= 7) return "You're building reserves.";
            return "You haven't built enough financial reserves yet.";
        }
    },

    generateTemplatePayload(truth) {
        const stageTemplate = this.stageTemplates[truth.stage] || this.stageTemplates['Stability Trap'];
        const timeframeVariant = this.timeframeVariants[truth.timeframe] || this.timeframeVariants['Within this year'];
        const bottleneckTemplate = this.bottleneckContent[truth.bottleneckKey] || this.bottleneckContent.savingsRate;

        return {
            // Stage-based
            stageTitle: stageTemplate.title,
            stageDescription: stageTemplate.description,
            stageCta: stageTemplate.ctaText,
            urgencyLevel: stageTemplate.urgencyLevel,

            // Timeframe-based
            urgencyTitle: timeframeVariant.urgencyTitle,
            timeframeCta: timeframeVariant.ctaText,
            ctaSubtext: timeframeVariant.ctaSubtext,
            ctaStyle: timeframeVariant.ctaStyle,

            // Bottleneck-based
            bottleneckTitle: `${bottleneckTemplate.title} (${truth.bottleneckScore}/${truth.bottleneckMax})`,
            bottleneckShortDesc: bottleneckTemplate.shortDesc,
            bottleneckFullDesc: bottleneckTemplate.fullDesc,
            bottleneckOpportunity: bottleneckTemplate.opportunity,

            // Pillar texts
            incomeCapacityText: this.pillarTexts.incomeCapacity(truth.incomeCapacityScore),
            incomeStructureText: this.pillarTexts.incomeStructure(truth.incomeStructureScore),
            savingsRateText: this.pillarTexts.savingsRate(truth.savingsRateScore),
            assetStrengthText: this.pillarTexts.assetStrength(truth.assetStrengthScore),

            // Final CTA (Hot leads get timeframe CTA, others get stage CTA)
            finalCta: truth.leadTier === 'Hot' ? timeframeVariant.ctaText : stageTemplate.ctaText
        };
    }
};

// ============================================
// MODULE 3: AI ENGINE (NARRATIVE GENERATION)
// Claude generates ONLY personalized explanations
// T. Harv Eker communication methodology (Balanced with McKinsey Consulting Authority)
// ============================================

async function generateAINarratives(truth, template) {
    const systemPrompt = `You are a senior wealth strategist combining T. Harv Eker's "Secrets of the Millionaire Mind" concepts with McKinsey-style consulting clarity. You're writing a personalized wealth analysis for ${truth.firstName}.

YOUR COMMUNICATION STYLE (40% Harv Identity Shift + 60% Consulting Authority):
- Reference the MONEY BLUEPRINT and THERMOSTAT concepts but use them diagnostically, not dramatically
- Be DIRECT but measured - speak as a trusted advisor diagnosing a situation, not a speaker rallying an audience
- Use strategic language: "constraint," "structure," "leverage," "optimization"
- Keep sentences concise and impactful - avoid repetition
- Write in clean prose - NEVER use bullet points, numbered lists, or dashes
- End sections with logical conclusions, not declarations or demands

KEY CONCEPTS TO WEAVE IN (subtly, not dramatically):
- Financial blueprint shapes decisions subconsciously
- Income structure determines growth trajectory
- The difference between effort-based and leveraged income
- Optimization vs. working harder

TONE GUIDELINE: Be warm but clinical. Diagnose clearly. Offer insight without hype. Sound like a trusted advisor in a private consultation, not a seminar speaker. Avoid ALL CAPS emphasis. Avoid phrases like "I DECLARE" or "commit to being rich."

THEIR DATA:
- Name: ${truth.firstName}
- Stage: ${truth.stage} (Score: ${truth.wealthScore}/50)
- Main Bottleneck: ${truth.primaryBottleneck}
- Savings Rate: ${truth.savingsRatePercent || 'unknown'}% of income
- Asset Ratio: ${truth.assetRatioX || 'unknown'}x annual income
- Concerns: ${truth.primaryConcern || 'wealth building'}
- Timeframe: ${truth.timeframe}
- Lead Tier: ${truth.leadTier}`;

    const userPrompt = `Write 4 narrative sections with balanced consulting authority + Harv Eker concepts. Each should be 3-5 sentences of clean prose. NO bullet points or lists. NO dramatic capitalization.

1. whyThisIsHappening: Explain why ${truth.firstName} is in "${truth.stage}" using blueprint concepts but with consulting clarity. Diagnose the structural issue, not the personal failing. Keep it concise.

2. hiddenPattern: Reveal a specific insight about their income/wealth structure. Their weakest pillar is ${truth.primaryBottleneck} at ${truth.bottleneckScore}/${truth.bottleneckMax}. Focus on the structural pattern, not emotional impact.

3. ifNothingChanges: Paint a realistic picture of their trajectory if the structure doesn't change. Be direct but not fear-based. Use specific time horizons. Keep it brief - 3 sentences max.

4. transitionToSolution: Bridge to next steps using logic, not pressure. Their timeframe is "${truth.timeframe}". Focus on structural change, not emotional commitment. End with a question that invites reflection.

Return ONLY valid JSON:
{
  "whyThisIsHappening": "...",
  "hiddenPattern": "...",
  "ifNothingChanges": "...",
  "transitionToSolution": "..."
}`;

    try {
        const response = await anthropic.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 1200,
            messages: [
                { role: 'user', content: userPrompt }
            ],
            system: systemPrompt
        });

        const content = response.content[0].text;
        
        // Parse JSON response
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }
        
        throw new Error('No valid JSON found in response');
    } catch (error) {
        console.error('AI generation error:', error);
        
        // Balanced fallback narratives (Harv Eker concepts + McKinsey consulting clarity)
        const stageNarratives = {
            'Survival Mode': {
                whyThisIsHappening: `${truth.firstName}, your current financial position reflects a common pattern. When income barely covers expenses, most decisions become reactive rather than strategic. This isn't about capability - it's about the structure you're operating within. The challenge at this stage is that financial stress creates a cycle: limited resources lead to short-term thinking, which limits the ability to build long-term wealth. What's important to recognize is that this pattern can be changed once you understand how your financial blueprint is influencing your decisions.`,
                hiddenPattern: `The real constraint isn't your income level. It's how decisions are being made under pressure. When survival is the priority, opportunities for growth often get filtered out automatically. Your ${truth.primaryBottleneck.toLowerCase()} reveals where this shows up most clearly. This isn't a character flaw - it's a blueprint operating exactly as programmed. The pattern works like a thermostat: it keeps resetting to a familiar level, regardless of temporary gains. Understanding this is the first step to changing it.`,
                ifNothingChanges: `If your current pattern continues, the likely outcome is more of the same - income that covers expenses but doesn't create freedom. The gap between where you are and where you want to be tends to widen over time, not shrink. Time compounds in both directions - working for you or against you.`,
                transitionToSolution: `${truth.firstName}, the fact that you completed this assessment shows something important: you're willing to look honestly at your situation. That's the foundation for change. The next step isn't about working harder within the same structure. It's about understanding how to shift the structure itself. Your ${truth.timeframe.toLowerCase()} timeline suggests you're ready to move forward. The question is whether you'll continue managing the symptoms, or address the underlying pattern.`
            },
            'Stability Trap': {
                whyThisIsHappening: `${truth.firstName}, you've built something real - steady income, reasonable savings, financial responsibility. But there's a pattern worth examining: your results are still tied to how much you work. At this stage, the limitation isn't effort. It's structure. When income depends heavily on time and active involvement, growth remains linear. This reflects a financial blueprint optimized for safety rather than acceleration. It's not wrong - it's just limiting.`,
                hiddenPattern: `Most people try to improve results by increasing income or cutting expenses. However, the real constraint is often how income is structured in the first place. Your ${truth.primaryBottleneck.toLowerCase()} highlights where this shows up for you. If income remains effort-based, growth naturally slows over time. This is where wealth builders think differently - they focus less on doing more, and more on creating leverage that allows results to grow independently of effort.`,
                ifNothingChanges: `If your current pattern continues: income remains tied to effort, growth slows as responsibilities increase, and financial independence takes longer than expected. You'll likely remain comfortable but not free. The gap between where you are and true financial freedom tends to widen rather than narrow when the underlying structure stays the same.`,
                transitionToSolution: `${truth.firstName}, the good news is that escaping the Stability Trap doesn't require taking excessive risks. It requires understanding how your financial blueprint is shaping your decisions, and making targeted adjustments. You've already proven you can be disciplined. The opportunity now is to direct that discipline toward creating leverage rather than just maintaining stability. Given your ${truth.timeframe.toLowerCase()} timeline, you're positioned to make this shift.`
            },
            'Growth Phase': {
                whyThisIsHappening: `${truth.firstName}, you're clearly making progress, but your results are still tied to how much you work. At this stage, the limitation is not effort - it's structure. When income depends heavily on time and active involvement, growth remains linear. This makes it difficult to scale beyond a certain level. What most people don't see is that this pattern reflects a financial blueprint that shapes how income is created and managed. Recognizing this is the first step to changing it.`,
                hiddenPattern: `Most people try to improve results by increasing income or optimizing expenses. However, the real constraint is often how income is structured in the first place. Your ${truth.primaryBottleneck.toLowerCase()} reveals where this limitation shows up most clearly for you. If income remains effort-based, growth naturally slows over time. This is where wealth builders think differently - they focus less on doing more, and more on creating leverage that allows results to grow independently of effort.`,
                ifNothingChanges: `If your current pattern continues: income remains tied to effort, growth slows as responsibilities increase, and financial independence takes longer than expected. The difference between optimized growth and default growth isn't just speed - it's options. Five years from now, you could be choosing how to spend your time, or still negotiating for it.`,
                transitionToSolution: `${truth.firstName}, you're closer to an inflection point than you might realize. At this stage, the next step is not to push harder - it's to change how your financial decisions and income structure work together. When that shift happens, results tend to follow. The strategies that matter now are different from what got you here. Your ${truth.timeframe.toLowerCase()} timeline gives you a clear window to implement these changes. The question is whether you'll continue optimizing within the current structure, or upgrade the structure itself.`
            },
            'Freedom Path': {
                whyThisIsHappening: `${truth.firstName}, you've built something most people only talk about - real financial momentum. Your foundation is strong and your trajectory is pointed toward freedom. At this level, the game changes. It's less about accumulation and more about optimization. Small percentage improvements create massive compound results over time. The question isn't whether you'll reach freedom - it's how quickly and completely you'll get there.`,
                hiddenPattern: `Even at your level, there are opportunities worth examining. Your ${truth.primaryBottleneck.toLowerCase()} might seem minor compared to your strengths, but here's what high performers often miss: they keep adding fuel instead of removing friction. At this stage, optimizing your weaker areas has a multiplicative effect. It's not addition anymore - it's leverage. The opportunity is to accelerate what's already working while addressing what's quietly limiting your potential.`,
                ifNothingChanges: `You'll reach financial freedom either way - that's the good news. But the difference between an optimized path and a default path could mean years of additional time or significant unrealized potential. At your level, a 10% improvement compounds into substantial differences over time. The question is whether you want to arrive at freedom as quickly as possible, or simply drift there.`,
                transitionToSolution: `${truth.firstName}, you're in a position many would envy. The strategies that matter at this stage are about optimization, protection, and acceleration - fine-tuning what's already working to reach its full potential. Your ${truth.timeframe.toLowerCase()} timeline gives you the window to implement sophisticated approaches that separate the wealthy from the truly free. The path forward is clear. The question is whether you'll coast, or commit to your full potential.`
            }
        };
        
        return stageNarratives[truth.stage] || stageNarratives['Stability Trap'];
    }
}

// ============================================
// MODULE 4: RESULT COMPOSER (MERGE ALL LAYERS)
// ============================================

function composeResultPayload(truth, template, aiNarratives) {
    return {
        // ===== TRUTH LAYER (from Rule Engine) =====
        user: {
            firstName: truth.firstName,
            lastName: truth.lastName,
            fullName: truth.fullName,
            email: truth.email,
            phone: truth.phone,
            country: truth.country,
            currency: truth.currency
        },
        
        inputs: {
            incomeLevel: truth.incomeLevel,
            monthlySurplus: truth.monthlySurplus,
            liquidAssets: truth.liquidAssets,
            professionalStatus: truth.professionalStatus,
            primaryConcern: truth.primaryConcern,
            timeframe: truth.timeframe
        },
        
        scores: {
            wealthScore: truth.wealthScore,
            percentage: truth.percentage,
            stage: truth.stage,
            urgencyScore: truth.urgencyScore,
            leadTier: truth.leadTier,
            breakdown: {
                incomeCapacity: truth.incomeCapacityScore,
                incomeStructure: truth.incomeStructureScore,
                savingsRate: truth.savingsRateScore,
                assetStrength: truth.assetStrengthScore
            },
            bottleneck: {
                key: truth.bottleneckKey,
                label: truth.primaryBottleneck,
                score: truth.bottleneckScore,
                max: truth.bottleneckMax
            }
        },
        
        // ===== TEMPLATE LAYER (from Template Engine) =====
        template: {
            stageTitle: template.stageTitle,
            stageDescription: template.stageDescription,
            stageCta: template.stageCta,
            urgencyLevel: template.urgencyLevel,
            urgencyTitle: template.urgencyTitle,
            timeframeCta: template.timeframeCta,
            ctaSubtext: template.ctaSubtext,
            ctaStyle: template.ctaStyle,
            bottleneckTitle: template.bottleneckTitle,
            bottleneckFullDesc: template.bottleneckFullDesc,
            bottleneckOpportunity: template.bottleneckOpportunity,
            pillarTexts: {
                incomeCapacity: template.incomeCapacityText,
                incomeStructure: template.incomeStructureText,
                savingsRate: template.savingsRateText,
                assetStrength: template.assetStrengthText
            },
            finalCta: template.finalCta
        },
        
        // ===== AI LAYER (from Claude - narratives only) =====
        narratives: {
            whyThisIsHappening: aiNarratives.whyThisIsHappening,
            hiddenPattern: aiNarratives.hiddenPattern,
            ifNothingChanges: aiNarratives.ifNothingChanges,
            transitionToSolution: aiNarratives.transitionToSolution
        },
        
        // ===== META =====
        meta: {
            generatedAt: new Date().toISOString(),
            version: '2.0',
            architecture: 'hybrid'
        }
    };
}

// ============================================
// API HANDLER
// ============================================

export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const input = req.body;

        // Validate required fields (professionalStatus is now optional)
        const required = ['firstName', 'email', 'incomeLevel', 'monthlySurplus', 'liquidAssets', 'timeframe'];
        const missing = required.filter(field => !input[field] && input[field] !== 0);
        
        if (missing.length > 0) {
            console.log('❌ Missing fields:', missing);
            return res.status(400).json({ 
                error: 'Missing required fields', 
                missing 
            });
        }
        
        // Default professionalStatus if empty
        if (!input.professionalStatus) {
            input.professionalStatus = 'Professional';
        }

        console.log('📥 Input received:', input.firstName, input.email);

        // Step 1: Rule Engine - Calculate truth
        console.log('⚙️ Step 1: Calculating truth layer...');
        const truth = RuleEngine.generateTruthPayload(input);
        console.log('✅ Truth:', truth.wealthScore, truth.stage, truth.leadTier);

        // Step 2: Template Engine - Generate fixed structure
        console.log('📋 Step 2: Generating template layer...');
        const template = TemplateEngine.generateTemplatePayload(truth);
        console.log('✅ Template:', template.stageTitle, template.finalCta);

        // Step 3: AI Engine - Generate narratives only
        console.log('🤖 Step 3: Generating AI narratives...');
        const aiNarratives = await generateAINarratives(truth, template);
        console.log('✅ AI Narratives generated');

        // Step 4: Compose final result
        console.log('🔗 Step 4: Composing final result...');
        const result = composeResultPayload(truth, template, aiNarratives);

        console.log('✅ Result composed successfully');

        return res.status(200).json({
            success: true,
            result
        });

    } catch (error) {
        console.error('❌ Error:', error);
        return res.status(500).json({ 
            error: 'Internal server error',
            message: error.message 
        });
    }
}
