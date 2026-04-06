// api/airtable.js
// Vercel Serverless Function - Secure Airtable Proxy

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // CORS headers (adjust origin for production)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Environment variables (set in Vercel dashboard)
  const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
  const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
  const AIRTABLE_TABLE_NAME = process.env.AIRTABLE_TABLE_NAME;

  if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID || !AIRTABLE_TABLE_NAME) {
    console.error('Missing environment variables');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  try {
    const data = req.body;

    // Validate required fields
    if (!data['First Name'] || !data['Email']) {
      return res.status(400).json({ error: 'Name and email are required' });
    }

    // Build Airtable request
    const airtableUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_TABLE_NAME)}`;

    const airtableRecord = {
      fields: {
        'First Name': data['First Name'],
        'Email': data['Email'],
        'Phone': data['Phone'] || '',
        'Country': data['Country'] || '',
        'Currency': data['Currency'] || '',
        'Income Level': data['Income Level'] || '',
        'Monthly Surplus': Number(data['Monthly Surplus']) || 0,
        'Liquid Assets': Number(data['Liquid Assets']) || 0,
        'Professional Status': data['Professional Status'] || '',
        'Primary Concern': data['Primary Concern'] || '',
        'Timeline': data['Timeline'] || '',
        'Wealth Score': Number(data['Wealth Score']) || 0,
        'Created At': data['Created At'] || new Date().toISOString()
      }
    };

    // Send to Airtable
    const response = await fetch(airtableUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(airtableRecord)
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Airtable error:', errorData);
      return res.status(response.status).json({ error: 'Failed to save to Airtable', details: errorData });
    }

    const result = await response.json();
    return res.status(200).json({ success: true, id: result.id });

  } catch (error) {
    console.error('Server error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
