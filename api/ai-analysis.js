// Vercel Serverless Function: /api/ai-analysis
// Proxies requests to Anthropic API to bypass CORS
// Uses Claude to generate personalized wealth analysis

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
      timeline 
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

    // Build the prompt for Claude
    const prompt = `You are June Yoon, a Wealth Architecture Strategist at Success Resources. Write a personalized wealth analysis letter for a client who just completed the Wealth Analyzer assessment.

CLIENT PROFILE:
- Name: ${name}
- Wealth Position Score: ${wealthScore}/100 (${scoreLabel})
- Monthly Surplus: ${currency} ${surplus?.toLocaleString() || 0}
- Liquid Assets: ${currency} ${liquid?.toLocaleString() || 0}
- Annual Savings Capacity: ${currency} ${((surplus || 0) * 12).toLocaleString()}
- Income Level: ${income}
- Professional Status: ${status}
- Primary Wealth Concerns: ${concern}
- Timeline to Wealth Goals: ${timeline}

WRITING GUIDELINES:
1. Address them by first name (extract from full name)
2. Be warm, encouraging, and professional
3. Reference specific numbers from their profile
4. Include 1-2 relevant T. Harv Eker "Secrets of the Millionaire Mind" principles that apply to their situation
5. Give 2-3 specific, actionable recommendations based on their concerns and timeline
6. Keep it concise but impactful (250-350 words)
7. End with an invitation to book a strategy call

MILLIONAIRE MIND PRINCIPLES TO DRAW FROM:
- "Rich people believe 'I create my life.' Poor people believe 'Life happens to me.'"
- "Rich people play the money game to win. Poor people play the money game to not lose."
- "Rich people are committed to being rich. Poor people want to be rich."
- "Rich people think big. Poor people think small."
- "Rich people focus on opportunities. Poor people focus on obstacles."
- "Rich people admire other rich and successful people. Poor people resent rich and successful people."
- "Rich people associate with positive, successful people. Poor people associate with negative or unsuccessful people."
- "Rich people are willing to promote themselves and their value. Poor people think negatively about selling and promotion."
- "Rich people are bigger than their problems. Poor people are smaller than their problems."
- "Rich people are excellent receivers. Poor people are poor receivers."
- "Rich people choose to get paid based on results. Poor people choose to get paid based on time."
- "Rich people think 'both.' Poor people think 'either/or.'"
- "Rich people focus on their net worth. Poor people focus on their working income."
- "Rich people manage their money well. Poor people mismanage their money well."
- "Rich people have their money work hard for them. Poor people work hard for their money."
- "Rich people act in spite of fear. Poor people let fear stop them."
- "Rich people constantly learn and grow. Poor people think they already know."

Write the analysis now. Do not include a subject line or greeting header - start directly with "Dear [First Name]," and end with your signature "June Yoon | Wealth Architecture Strategist | Success Resources"`;

    console.log('🤖 Calling Claude API for personalized analysis...');

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
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('❌ Anthropic API error:', errorData);
      return res.status(response.status).json({ 
        error: 'AI analysis failed', 
        details: errorData 
      });
    }

    const data = await response.json();
    const analysis = data.content[0]?.text || '';

    console.log('✅ AI analysis generated successfully');

    return res.status(200).json({
      success: true,
      analysis: analysis
    });

  } catch (error) {
    console.error('❌ Server error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
