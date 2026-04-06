// api/airtable.js
// Vercel Serverless Function - Secure Airtable Proxy

export default async function handler(req, res) {
  // CORS headers - must be set first
  res.setHeader('Access-Control-Allow-Origin', '*');
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
    return res.status(500).json({ error: 'Server configuration error - missing environment variables' });
  }

  try {
    // Get data from request body
    const data = req.body;

    // Validate required fields
    if (!data['First Name'] || !data['Email']) {
      return res.status(400).json({ error: 'Name and email are required' });
    }

    // Build Airtable API URL
    const airtableUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_TABLE_NAME)}`;

    // Build the record to send to Airtable
    const airtableRecord = {
      fields: {
        'First Name': data['First Name'] || '',
        'Email': data['Email'] || '',
        'Phone': data['Phone'] || '',
        'Country': data['Country'] || '',
        'Currency': data['Currency'] || '',
        'Income Level': data['Income Level'] || '',
        'Monthly Surplus': Number(data['Monthly Surplus']) || 0,
        'Liquid Assets': Number(data['Liquid Assets']) || 0,
        'Professional Status': data['Professional Status'] || '',
        'Primary Concern': data['Primary Concern'] || '',
        'Timeline': data['Timeline'] || '',
        'Wealth Score': Number(data['Wealth Score']) || 0
      }
    };

    console.log('Sending to Airtable:', JSON.stringify(airtableRecord));

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
        error: errorData
      });
      return res.status(response.status).json({
        error: 'Failed to save to Airtable',
        status: response.status,
        details: errorData
      });
    }

    // Success
    const result = await response.json();
    console.log('Successfully saved to Airtable:', result.id);
    return res.status(200).json({ success: true, id: result.id });

  } catch (error) {
    console.error('Server error:', error.message);
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}
