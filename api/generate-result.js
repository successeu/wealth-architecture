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
// T. Harv Eker communication methodology
// ============================================

async function generateAINarratives(truth, template) {
    const systemPrompt = `You are channeling the voice of T. Harv Eker from "Secrets of the Millionaire Mind" combined with June Yoon's wealth strategy expertise. You're writing a personalized wealth analysis for ${truth.firstName} who just completed an assessment.

YOUR COMMUNICATION STYLE (T. Harv Eker Method - Inviting yet Firm with Authority):
- Use RICH vs POOR contrasts: "Rich people believe X. People stuck in ${truth.stage} believe Y."
- Reference the MONEY BLUEPRINT concept: their subconscious programming is running them
- Use the THERMOSTAT metaphor: they're set for a certain financial level
- Be DIRECT and FIRM but with warmth and empathy - speak to them like a mentor who believes in their potential
- Use CAPS for emphasis on key words: NEVER, ALWAYS, NOW, YOU, RICH
- Include rhetorical questions: "Does that sound familiar?" "How's that working for you?"
- Reference T. Harv Eker principles: "Your income can only grow to the extent that YOU do"
- End sections with DECLARATIONS or ACTION calls
- Write in flowing prose - NEVER use bullet points, numbered lists, or dashes

KEY EKER PHRASES TO WEAVE IN:
- "The lack of money is NEVER the problem. It's a symptom."
- "If you keep doing what you've been doing, you'll keep getting what you've been getting"
- "Rich people play to WIN. Poor people play NOT TO LOSE."
- "Thoughts lead to feelings. Feelings lead to actions. Actions lead to results."
- "Your financial blueprint will determine your financial life"
- "What you focus on expands"
- "Rich people are committed to being rich. Poor people WANT to be rich."

TONE GUIDELINE: Be warm but authoritative. Share truth directly because you believe in their success - not to criticize. Never say "I'm not here to be your friend" or similar cold phrases. Instead, speak as a trusted mentor who sees their potential and cares about their outcome.

THEIR DATA:
- Name: ${truth.firstName}
- Stage: ${truth.stage} (Score: ${truth.wealthScore}/50)
- Main Bottleneck: ${truth.primaryBottleneck}
- Savings Rate: ${truth.savingsRatePercent || 'unknown'}% of income
- Asset Ratio: ${truth.assetRatioX || 'unknown'}x annual income
- Concerns: ${truth.primaryConcern || 'wealth building'}
- Timeframe: ${truth.timeframe}
- Lead Tier: ${truth.leadTier}`;

    const userPrompt = `Write 4 narrative sections in T. Harv Eker's voice. Each should be 4-6 sentences of flowing prose. NO bullet points or lists.

1. whyThisIsHappening: Explain why ${truth.firstName} is in "${truth.stage}" using Eker's blueprint/thermostat concepts. Make them feel understood, then deliver the truth about what's really going on. Use a rich vs poor contrast. End with something that gives them hope.

2. hiddenPattern: Reveal a specific insight about their MONEY BLUEPRINT that will make them think "that's exactly what's been happening!" Their weakest pillar is ${truth.primaryBottleneck} at ${truth.bottleneckScore}/${truth.bottleneckMax}. Connect this to subconscious programming. Use phrases like "here's what most people don't realize..." or "here's the pattern I see..."

3. ifNothingChanges: Paint a realistic picture of their financial future if they don't change their BLUEPRINT. Be direct and honest because you believe in their potential. Use specific time horizons (5 years, 10 years). Show the cost of inaction. Reference the thermostat resetting them back to their current level. Do NOT use phrases like "I'm not here to be your friend" - instead speak as a mentor who cares.

4. transitionToSolution: Bridge to opportunity using Eker's "commitment" language. Distinguish between WANTING to be rich vs COMMITTING to being rich. Their timeframe is "${truth.timeframe}" - create appropriate urgency. End with an empowering declaration or call to action.

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
        
        // Rich fallback narratives for each stage (T. Harv Eker voice - Inviting yet Firm)
        const stageNarratives = {
            'Survival Mode': {
                whyThisIsHappening: `${truth.firstName}, here's something I want you to really understand: the lack of money is NEVER the problem - it's a symptom. Your financial blueprint, the subconscious programming you picked up around money, is currently set for survival, not success. This isn't your fault. Somewhere along the way, you absorbed beliefs like "money doesn't grow on trees" or "we can't afford it." Those got installed deep. Here's the powerful distinction: wealthy people believe "I create my life." People stuck in survival mode believe "life happens to me." That belief is running you right now. The good news? Beliefs can absolutely be changed.`,
                hiddenPattern: `Here's what most people don't realize about your ${truth.primaryBottleneck.toLowerCase()}: it's not a money problem, it's a BLUEPRINT problem. Your financial thermostat is set to this level. You could win the lottery tomorrow, and within a few years you'd be right back here. Why? Because your subconscious doesn't know how to hold more. Every time money comes in, old programming kicks in and finds ways to get rid of it. That's not weakness - that's your blueprint doing exactly what it was programmed to do. The pattern isn't the enemy. The pattern is the SYMPTOM. And now that you can see it, you can change it.`,
                ifNothingChanges: `${truth.firstName}, I want to share something important because your success matters. If you keep doing what you've been doing, you'll keep getting what you've been getting. Five years from now, you'll have a bit more income but the same stress. Ten years from now, same story. The gap between where you are and where you want to be won't shrink on its own. Your blueprint will keep resetting you to survival mode like a thermostat. And here's the reality we need to face together: time is the one asset you can never get back. Every year you stay stuck is a year of wealth-building you'll never recover.`,
                transitionToSolution: `But here's what I want you to hold onto, ${truth.firstName}: you've already done something most people never do. You looked honestly at your situation. You got clear. That's the first step in the reconditioning process: AWARENESS. You can't change what you're not aware of. Now comes the real work - rewiring your blueprint for wealth instead of survival. Your ${truth.timeframe.toLowerCase()} timeline tells me you're ready to take action. The question is: are you committed to being rich, or do you just WANT to be rich? Because wanting is passive. Commitment is powerful. And you deserve to be wealthy.`
            },
            'Stability Trap': {
                whyThisIsHappening: `${truth.firstName}, here's what I see in your results: you're playing the money game NOT TO LOSE instead of playing to WIN. And that distinction is exactly what separates the wealthy from the middle class. You're doing all the "responsible" things - steady job, decent savings, playing it safe. But here's the truth we need to acknowledge: the same cautious blueprint that got you here is now your ceiling. Rich people focus on their NET WORTH. Middle-class people focus on their WORKING INCOME. You've been trading time for money, and no matter how much time you trade, you can't break through. This isn't about working harder. It's about thinking BIGGER.`,
                hiddenPattern: `Your ${truth.primaryBottleneck.toLowerCase()} is the symptom that reveals your blueprint. See, most people in your situation don't realize they have an internal "wealth thermostat" set to exactly this level. Every month you're making decisions that feel responsible but are actually keeping you comfortable - not free. It's like you've got the parking brake on. You're moving, sure, but burning fuel and going nowhere fast. The pattern? You're focused on what you might LOSE instead of what you could GAIN. Rich people see opportunities. Middle-class people see obstacles. Which one sounds like you right now?`,
                ifNothingChanges: `${truth.firstName}, let me share this with you directly because I believe in your potential. If nothing changes, nothing changes. You'll keep earning well, keep saving responsibly, and keep wondering why others with similar incomes are pulling ahead. The gap between comfortable and FREE will grow wider every year. And the most frustrating part? You'll KNOW something is off, but you won't be able to put your finger on it. That's your blueprint protecting itself. That's the Stability Trap doing its job. But you have the awareness NOW to change this trajectory.`,
                transitionToSolution: `The good news? Escaping the Stability Trap doesn't require you to take crazy risks. It requires you to upgrade your money blueprint - to think like wealthy people think. You've already proven you can be disciplined. Now it's about directing that discipline toward the RIGHT things. Given your ${truth.timeframe.toLowerCase()} timeline, you're in the perfect position to make this shift. The strategies exist. The path is clear. The only question is: are you going to commit to PLAYING TO WIN? Place your hand on your heart and say: "I choose to think big. I choose to play to win. I have a millionaire mind."`
            },
            'Growth Phase': {
                whyThisIsHappening: `${truth.firstName}, you're in the Growth Phase, and that's significant - you've moved past survival and stability into actual wealth building. But here's what I need you to understand: this is the CRITICAL junction. This is where people either accelerate into real financial freedom or plateau at "comfortable but still working." The decisions you make right now will determine which path you take. Your income can only grow to the extent that YOU do. And right now, there's a specific area of your blueprint that's holding you back from the next level.`,
                hiddenPattern: `Look at your numbers: your ${truth.primaryBottleneck.toLowerCase()} is where you're leaving the most money on the table. Here's what most people in your position don't see - they keep doubling down on what's already working instead of fixing what's limiting them. But wealth is like a bucket. You can pour more water in, but if there's a hole, you'll never fill it. Your ${truth.primaryBottleneck.toLowerCase()} is the hole. It's not that you're doing anything wrong - it's that your subconscious is avoiding this area for a reason. Something in your programming says "don't go there." And THAT'S exactly where your biggest breakthrough is waiting.`,
                ifNothingChanges: `${truth.firstName}, here's the honest truth: if you continue on your current trajectory, you'll reach financial comfort eventually. But "eventually" might mean twice as long as necessary. The difference between optimized growth and drifting growth isn't just speed - it's OPTIONS. Five years from now, you could be choosing how to spend your time, or you could still be negotiating for it. That's the difference between having money work hard for YOU versus you still working hard for money. At your level, every year of delay is a year of compound growth you'll never get back.`,
                transitionToSolution: `Here's the truth, ${truth.firstName}: you're closer to the inflection point than you realize. This is where wealth starts building momentum on its own - where your money works harder than you do. The strategies at this stage are different from what got you here. More sophisticated. More leveraged. Focused on MULTIPLICATION, not addition. Your ${truth.timeframe.toLowerCase()} timeline is perfect for implementing these changes. But you have to decide: are you committed to reaching your full financial potential, or just committed to being comfortable? Rich people are committed to being rich. Which one are you?`
            },
            'Freedom Path': {
                whyThisIsHappening: `${truth.firstName}, being on the Freedom Path means you've accomplished what most people only dream about - you've built REAL momentum. Your financial foundation is strong and your trajectory is pointed toward freedom. But here's what separates the wealthy from the TRULY free: the wealthy accumulate. The truly free optimize. You're playing a different game now - one where strategy matters more than hustle, where small percentage improvements create massive compound results. The question isn't WHETHER you'll reach freedom. It's HOW FAST and HOW FULLY you'll get there.`,
                hiddenPattern: `Even at your level, there are opportunities hiding in plain sight. Your ${truth.primaryBottleneck.toLowerCase()} might seem minor compared to your strengths, but here's the pattern I see with high performers: they keep adding fuel instead of removing friction. At this stage, optimizing your weaker areas has a MULTIPLICATIVE effect. It's not addition anymore - it's leverage. The wealthy think "both/and" while everyone else thinks "either/or." You don't have to choose between protecting what you have and accelerating what you're building. You can do BOTH. But only if you address what's been quietly limiting you.`,
                ifNothingChanges: `You'll reach financial freedom either way - that's the good news. But the difference between an optimized path and a default path? It could mean YEARS of additional working or millions in unrealized potential. At your level, a 10% improvement compounds into massive differences over time. The question is whether you want to arrive at freedom as quickly and powerfully as possible, or simply drift there. Wealthy people constantly learn and grow. They don't coast just because they're ahead. They ACCELERATE. That's the mindset that built what you have. Don't slow down now.`,
                transitionToSolution: `${truth.firstName}, you're in a position many would envy. But you and I both know the work isn't done. The strategies that matter at this stage are about optimization, protection, and ACCELERATION - fine-tuning an already strong engine to reach its full potential. Your ${truth.timeframe.toLowerCase()} timeline gives us the window to implement sophisticated approaches that separate the wealthy from the truly financially free. The path is clear. The question is: are you going to coast, or are you going to COMMIT to your full potential? I think you already know the answer.`
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
