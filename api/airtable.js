// api/airtable.js
// Vercel Serverless Function - Secure Airtable Proxy

export default async function handler(req, res) {
  
  // ┌─────────────────────────────────────────────────────────────┐
  // │  CORS CONFIGURATION - MUST BE FIRST                        │
  // │  Add your allowed origins here                             │
  // └─────────────────────────────────────────────────────────────┘
  
  const allowedOrigins = [
    'https://wealth-architecture.vercel.app',
    'https://wealth-architecture-qnpg6fbe3-sreu.vercel.app'
  ];

  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // ┌─────────────────────────────────────────────────────────────┐
  // │  REST OF YOUR CODE GOES BELOW                              │
  // └─────────────────────────────────────────────────────────────┘

  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // ... rest of the function continues here
}

export default async function handler(req, res) {
  // CORS headers - restricted to allowed origins
 const allowedOrigins = [
  // Production domain (when you have a custom domain)
  'https://wealth-architecture.vercel.app',
  
  // Vercel preview deployments (the URL you shared earlier)
  'https://wealth-architecture-qnpg6fbe3-sreu.vercel.app',
  
  // Local development (remove in production)
  'http://localhost:3000'
];
  
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Get environment variables
  const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
  const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
  const AIRTABLE_TABLE_NAME = process.env.AIRTABLE_TABLE_NAME;

  // Check if env vars are set
  if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID || !AIRTABLE_TABLE_NAME) {
    console.error('Missing environment variables:', {
      hasApiKey: !!AIRTABLE_API_KEY,
      hasBaseId: !!AIRTABLE_BASE_ID,
      hasTableName: !!AIRTABLE_TABLE_NAME
    });
    return res.status(500).json({ error: 'Server configuration error' });
  }

  // Valid options for Single Select fields (must match Airtable exactly)
  const VALID_OPTIONS = {
    incomeLevel: ['50K-100K', '100K-150K', '150K-250K', '250K-500K', '500K+'],
    professionalStatus: ['Business Owner', 'Executive/C-Suite', 'Senior Professional', 'Investor', 'Other'],
    primaryConcern: ['Tax Optimization', 'Capital Deployment', 'Wealth Protection', 'Income Growth', 'Retirement Planning'],
    timeline: ['1 year', '3 years', '5+ years']
  };

  try {
    // Get data from request body
    const data = req.body;

    // Validate required fields
    if (!data['First Name'] || !data['First Name'].trim()) {
      return res.status(400).json({ error: 'First Name is required' });
    }

    if (!data['Email'] || !data['Email'].trim()) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data['Email'].trim())) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Build Airtable API URL
    const airtableUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_TABLE_NAME)}`;

    // Build the record with required fields
    const airtableRecord = {
      fields: {
        'First Name': data['First Name'].trim(),
        'Email': data['Email'].trim().toLowerCase(),
        'Created At': new Date().toISOString().split('T')[0] // Format: YYYY-MM-DD
      }
    };

    // Add optional text fields (only if provided and not empty)
    if (data['Phone'] && data['Phone'].trim()) {
      airtableRecord.fields['Phone'] = data['Phone'].trim();
    }

    if (data['Country'] && data['Country'].trim()) {
      airtableRecord.fields['Country'] = data['Country'].trim();
    }

    if (data['Currency'] && data['Currency'].trim()) {
      airtableRecord.fields['Currency'] = data['Currency'].trim().toUpperCase();
    }

    // Add number fields (only if valid positive numbers)
    const monthlySurplus = parseInt(data['Monthly Surplus'], 10);
    if (!isNaN(monthlySurplus) && monthlySurplus > 0) {
      airtableRecord.fields['Monthly Surplus'] = monthlySurplus;
    }

    const liquidAssets = parseInt(data['Liquid Assets'], 10);
    if (!isNaN(liquidAssets) && liquidAssets > 0) {
      airtableRecord.fields['Liquid Assets'] = liquidAssets;
    }

    const wealthScore = parseInt(data['Wealth Score'], 10);
    if (!isNaN(wealthScore) && wealthScore >= 0 && wealthScore <= 100) {
      airtableRecord.fields['Wealth Score'] = wealthScore;
    }

    // Add Single Select fields (only if valid option)
    if (data['Income Level'] && VALID_OPTIONS.incomeLevel.includes(data['Income Level'])) {
      airtableRecord.fields['Income Level'] = data['Income Level'];
    }

    if (data['Professional Status'] && VALID_OPTIONS.professionalStatus.includes(data['Professional Status'])) {
      airtableRecord.fields['Professional Status'] = data['Professional Status'];
    }

    if (data['Primary Concern'] && VALID_OPTIONS.primaryConcern.includes(data['Primary Concern'])) {
      airtableRecord.fields['Primary Concern'] = data['Primary Concern'];
    }

    if (data['Timeline'] && VALID_OPTIONS.timeline.includes(data['Timeline'])) {
      airtableRecord.fields['Timeline'] = data['Timeline'];
    }

    // Log without sensitive data
    console.log('Creating record for:', data['Email'].substring(0, 3) + '***');

    // Send to Airtable
    const response = await fetch(airtableUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(airtableRecord)
    });

    // Check response
    if (!response.ok) {
      const errorData = await response.json();
      console.error('Airtable API error:', {
        status: response.status,
        type: errorData.error?.type,
        message: errorData.error?.message
      });
      
      // Return user-friendly error messages
      if (response.status === 422) {
        return res.status(400).json({ 
          error: 'Invalid data format. Please check your inputs.' 
        });
      }
      if (response.status === 401 || response.status === 403) {
        return res.status(500).json({ error: 'Server authentication error' });
      }
      
      return res.status(response.status).json({
        error: 'Failed to save data. Please try again.'
      });
    }

    // Success
    const result = await response.json();
    console.log('Successfully created record:', result.id);
    
    return res.status(200).json({ 
      success: true, 
      message: 'Data saved successfully'
    });

  } catch (error) {
    console.error('Server error:', error.message);
    return res.status(500).json({ 
      error: 'An unexpected error occurred. Please try again.' 
    });
  }
}
