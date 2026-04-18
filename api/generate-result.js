// /api/generate-result.js
// Hybrid Architecture: Backend calculates truth, Claude generates narratives only

import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY
});

// ============================================
// MODULE 1: RULE ENGINE (SOURCE OF TRUTH)
// All scoring logic - deterministic, no AI
// ============================================

const RuleEngine = {
    // Income Level → Score (0-10)
    getIncomeCapacityScore(incomeLevel) {
        const map = {
            'Under $50,000': 2,
            '$50,000 - $100,000': 4,
            '$100,000 - $150,000': 6,
            '$150,000 - $250,000': 7,
            '$250,000 - $500,000': 8,
            '$500,000 - $1,000,000': 9,
            'Over $1,000,000': 10
        };
        return map[incomeLevel] || 5;
    },

    // Professional Status → Score (0-10)
    getIncomeStructureScore(status) {
        const map = {
            'Employee': 3,
            'Self-Employed': 5,
            'Business Owner': 7,
            'Investor': 9,
            'Executive': 6,
            'Professional': 5,
            'Entrepreneur': 7,
            'Retired': 4
        };
        return map[status] || 4;
    },

    // Monthly Surplus / Income → Score (0-15)
    getSavingsRateScore(surplus, incomeLevel) {
        // Estimate monthly income from level
        const incomeMap = {
            'Under $50,000': 3500,
            '$50,000 - $100,000': 6250,
            '$100,000 - $150,000': 10400,
            '$150,000 - $250,000': 16600,
            '$250,000 - $500,000': 31250,
            '$500,000 - $1,000,000': 62500,
            'Over $1,000,000': 100000
        };
        const monthlyIncome = incomeMap[incomeLevel] || 6250;
        const savingsRate = (surplus / monthlyIncome) * 100;

        if (savingsRate >= 30) return 15;
        if (savingsRate >= 25) return 13;
        if (savingsRate >= 20) return 11;
        if (savingsRate >= 15) return 9;
        if (savingsRate >= 10) return 7;
        if (savingsRate >= 5) return 4;
        return 2;
    },

    // Liquid Assets → Score (0-15)
    getAssetStrengthScore(liquid, incomeLevel) {
        const incomeMap = {
            'Under $50,000': 42000,
            '$50,000 - $100,000': 75000,
            '$100,000 - $150,000': 125000,
            '$150,000 - $250,000': 200000,
            '$250,000 - $500,000': 375000,
            '$500,000 - $1,000,000': 750000,
            'Over $1,000,000': 1200000
        };
        const annualIncome = incomeMap[incomeLevel] || 75000;
        const assetRatio = liquid / annualIncome;

        if (assetRatio >= 5) return 15;
        if (assetRatio >= 3) return 13;
        if (assetRatio >= 2) return 11;
        if (assetRatio >= 1) return 9;
        if (assetRatio >= 0.5) return 6;
        if (assetRatio >= 0.25) return 4;
        return 2;
    },

    // Timeframe → Urgency Score (1-4)
    getUrgencyScore(timeframe) {
        const map = {
            '0-3 months': 4,
            '3-6 months': 3,
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

        // Find weakest by percentage
        let weakest = pillars[0];
        pillars.forEach(p => {
            if ((p.score / p.max) < (weakest.score / weakest.max)) {
                weakest = p;
            }
        });

        return weakest;
    },

    // Generate complete truth payload
    generateTruthPayload(input) {
        const breakdown = {
            incomeCapacity: this.getIncomeCapacityScore(input.incomeLevel),
            incomeStructure: this.getIncomeStructureScore(input.professionalStatus),
            savingsRate: this.getSavingsRateScore(input.monthlySurplus, input.incomeLevel),
            assetStrength: this.getAssetStrengthScore(input.liquidAssets, input.incomeLevel)
        };

        const wealthScore = breakdown.incomeCapacity + breakdown.incomeStructure + breakdown.savingsRate + breakdown.assetStrength;
        const stage = this.getStage(wealthScore);
        const urgencyScore = this.getUrgencyScore(input.timeframe);
        const leadTier = this.getLeadTier(urgencyScore, wealthScore);
        const bottleneck = this.getBottleneck(breakdown);
        const percentage = Math.round((wealthScore / 50) * 100);

        return {
            // User info
            firstName: input.firstName,
            lastName: input.lastName,
            fullName: `${input.firstName} ${input.lastName}`,
            email: input.email,
            phone: input.phone,
            country: input.country,
            currency: input.currency,

            // Financial inputs
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
            bottleneckMax: bottleneck.max
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
// ============================================

async function generateAINarratives(truth, template) {
    const systemPrompt = `You are a wealth psychology expert writing personalized analysis for someone who just completed a wealth assessment. 

Your job is to write 4 short narrative sections that feel personal and insightful. The person's name is ${truth.firstName}.

CRITICAL RULES:
- Write in second person ("you")
- Be direct and specific to their situation
- No generic advice - reference their actual numbers and situation
- Each section should be 2-3 sentences max
- Sound like a wise mentor, not a corporate report
- No bullet points or lists - flowing prose only

CONTEXT (use this data but don't repeat it verbatim):
- Name: ${truth.firstName}
- Stage: ${truth.stage}
- Score: ${truth.wealthScore}/50 (${truth.percentage}%)
- Primary Bottleneck: ${truth.primaryBottleneck}
- Monthly Surplus: ${truth.currency}${truth.monthlySurplus?.toLocaleString()}
- Liquid Assets: ${truth.currency}${truth.liquidAssets?.toLocaleString()}
- Income Level: ${truth.incomeLevel}
- Professional Status: ${truth.professionalStatus}
- Primary Concern: ${truth.primaryConcern}
- Timeframe: ${truth.timeframe}
- Pillar Scores: Income Capacity ${truth.incomeCapacityScore}/10, Income Structure ${truth.incomeStructureScore}/10, Savings Rate ${truth.savingsRateScore}/15, Asset Strength ${truth.assetStrengthScore}/15`;

    const userPrompt = `Generate exactly 4 narrative sections in JSON format:

1. whyThisIsHappening: Explain why they're in ${truth.stage}. Reference their specific situation (${truth.professionalStatus}, concern about ${truth.primaryConcern}). Make it feel like you truly understand their situation.

2. hiddenPattern: Reveal an insight about their wealth psychology they probably haven't noticed. Something specific to their pillar scores - their weakest area is ${truth.primaryBottleneck}. Make this feel like an "aha moment".

3. ifNothingChanges: Paint a vivid but brief picture of their financial future if they stay on their current path. Be specific to their stage (${truth.stage}) and their ${truth.currency}${truth.monthlySurplus?.toLocaleString()} monthly surplus.

4. transitionToSolution: Bridge from their current situation to the opportunity. Reference their timeframe (${truth.timeframe}) and create urgency appropriate to their Lead Tier (${truth.leadTier}).

Respond with ONLY valid JSON, no markdown:
{
  "whyThisIsHappening": "...",
  "hiddenPattern": "...",
  "ifNothingChanges": "...",
  "transitionToSolution": "..."
}`;

    try {
        const response = await anthropic.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 1000,
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
        
        // Fallback narratives if AI fails
        return {
            whyThisIsHappening: `${truth.firstName}, you're in ${truth.stage} because your financial structure hasn't caught up with your earning potential. Your ${truth.primaryBottleneck.toLowerCase()} is creating a ceiling on your wealth growth.`,
            hiddenPattern: `Here's what most people miss: your ${truth.primaryBottleneck.toLowerCase()} isn't just a number problem. It's a pattern that's been quietly shaping every financial decision you make without you realizing it.`,
            ifNothingChanges: `If you stay on this path with your current ${truth.currency}${truth.monthlySurplus?.toLocaleString()} monthly surplus, you'll reach retirement still trading time for money. The gap between where you are and where you could be will only widen.`,
            transitionToSolution: `The good news? You've already taken the first step by getting clarity on where you stand. Your ${truth.timeframe.toLowerCase()} timeline means now is the perfect moment to implement the right strategies.`
        };
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

        // Validate required fields
        const required = ['firstName', 'email', 'incomeLevel', 'monthlySurplus', 'liquidAssets', 'professionalStatus', 'timeframe'];
        const missing = required.filter(field => !input[field] && input[field] !== 0);
        
        if (missing.length > 0) {
            return res.status(400).json({ 
                error: 'Missing required fields', 
                missing 
            });
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
