// Vercel Serverless Function: /api/ai-analysis
// Proxies requests to Anthropic API to bypass CORS
// Uses Claude to generate personalized wealth analysis AND asset allocation

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '1mb',
    },
  },
};

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { 
      name, 
      wealthScore, 
      scoreLabel,
      surplus, 
      liquid, 
      income, 
      currency,
      status, 
      concern, 
      timeline,
      country
    } = req.body;

    // Validate required fields
    if (!name || wealthScore === undefined) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
    
    if (!anthropicApiKey) {
      console.error('❌ ANTHROPIC_API_KEY not configured');
      return res.status(500).json({ error: 'API key not configured' });
    }

    // Build the prompt for Claude - now requesting BOTH analysis AND allocation
    const prompt = `You are June Yoon, a Wealth Architecture Strategist at Success Resources. Generate a personalized wealth analysis AND asset allocation strategy for a client.

CLIENT PROFILE:
- Name: ${name}
- Country: ${country || 'Not specified'}
- Wealth Position Score: ${wealthScore}/100 (${scoreLabel})
- Monthly Surplus: ${currency} ${surplus?.toLocaleString() || 0}
- Liquid Assets: ${currency} ${liquid?.toLocaleString() || 0}
- Annual Savings Capacity: ${currency} ${((surplus || 0) * 12).toLocaleString()}
- Income Level: ${income}
- Professional Status: ${status}
- Primary Wealth Concerns: ${concern}
- Timeline to Wealth Goals: ${timeline}

You must respond with ONLY a valid JSON object (no markdown, no backticks, no explanation) in this exact format:

{
  "analysis": "Your personalized letter here (250-350 words). Address them by first name. Be warm, encouraging, professional. Reference specific numbers. Include 1-2 T. Harv Eker principles. Give 2-3 actionable recommendations. End with invitation to book a 45-minute strategy call. Sign as June Yoon | Wealth Architecture Strategist | Success Resources",
  "allocation": {
    "Asset Category 1": percentage,
    "Asset Category 2": percentage,
    "Asset Category 3": percentage,
    "Asset Category 4": percentage,
    "Asset Category 5": percentage
  },
  "allocationRationale": "A brief 2-3 sentence explanation of why this allocation is recommended for their specific situation."
}

ASSET ALLOCATION GUIDELINES - Consider these factors:

1. COUNTRY-SPECIFIC TAX OPTIMIZATION:
   - Singapore: No capital gains tax - favor growth stocks & REITs
   - USA: Maximize 401k, IRA, HSA before taxable accounts
   - UK: Utilize ISA allowances, consider SIPPs
   - Australia: Focus on franked dividends, superannuation
   - Hong Kong: No capital gains - aggressive growth possible
   - Europe: Consider tax-efficient ETFs domiciled appropriately

2. INCOME LEVEL CONSIDERATIONS:
   - Under $100K: Focus on index funds, emergency fund first
   - $100K-$250K: Add real estate, start alternative investments
   - $250K-$500K: Diversify into private equity, angel investing
   - $500K+: Consider hedge funds, direct investments, tax optimization

3. TIMELINE CONSIDERATIONS:
   - 1-2 years: 70%+ in liquid, low-risk assets
   - 3-5 years: Balanced 50/50 growth vs stability
   - 5-10 years: Can be more aggressive, 60-70% growth
   - 10+ years: Maximum growth allocation, 70-80% equities

4. CONCERN-BASED ADJUSTMENTS:
   - Tax Optimization: Prioritize tax-advantaged vehicles
   - Capital Preservation: Higher bonds/fixed income allocation
   - Legacy Planning: Include estate-friendly structures
   - Retirement: Age-appropriate de-risking
   - Debt Management: Allocate to high-interest debt payoff first

5. ALLOCATION CATEGORIES TO USE (pick 5-6 that fit their profile):
   - Index Funds / ETFs
   - Growth Stocks
   - Dividend Stocks
   - Real Estate / REITs
   - Bonds & Fixed Income
   - Tax-Advantaged Accounts (401k/IRA/ISA/Super)
   - Alternative Investments
   - Private Equity
   - Cash & Emergency Fund
   - Cryptocurrency (small allocation if appropriate)
   - Business Investments
   - International Equities

Ensure percentages add up to exactly 100%.

MILLIONAIRE MIND PRINCIPLES FOR THE ANALYSIS:
- "Rich people believe 'I create my life.' Poor people believe 'Life happens to me.'"
- "Rich people play the money game to win. Poor people play the money game to not lose."
- "Rich people are committed to being rich. Poor people want to be rich."
- "Rich people focus on opportunities. Poor people focus on obstacles."
- "Rich people manage their money well. Poor people mismanage their money well."
- "Rich people have their money work hard for them. Poor people work hard for their money."
- "Rich people constantly learn and grow. Poor people think they already know."

Respond with ONLY the JSON object, nothing else.`;

    console.log('🤖 Calling Claude API for personalized analysis + allocation...');

    // Call Anthropic API
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicApiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2048,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Anthropic API error status:', response.status);
      console.error('❌ Anthropic API error body:', errorText);
      
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { message: errorText };
      }
      
      return res.status(response.status).json({ 
        error: 'AI analysis failed', 
        details: errorData 
      });
    }

    const data = await response.json();
    const rawResponse = data.content[0]?.text || '';

    console.log('✅ AI response received, parsing JSON...');

    // Parse the JSON response
    let parsedResponse;
    try {
      // Clean up any potential markdown formatting
      const cleanJson = rawResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      parsedResponse = JSON.parse(cleanJson);
    } catch (parseError) {
      console.error('❌ JSON parse error:', parseError);
      // Fallback: return raw response as analysis only
      return res.status(200).json({
        success: true,
        analysis: rawResponse,
        allocation: null,
        allocationRationale: null
      });
    }

    console.log('✅ AI analysis + allocation generated successfully');

    return res.status(200).json({
      success: true,
      analysis: parsedResponse.analysis || rawResponse,
      allocation: parsedResponse.allocation || null,
      allocationRationale: parsedResponse.allocationRationale || null
    });

  } catch (error) {
    console.error('❌ Server error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
