// api/airtable.js
// Vercel Serverless Function - Secure Airtable Proxy
// FIXED: Values now match HTML form exactly

export default async function handler(req, res) {
  // CORS headers - allow all origins (simpler for debugging)
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
    console.error('Missing environment variables');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  try {
    const data = req.body;

    // Validate required fields
    if (!data['First Name'] || !data['Email']) {
      return res.status(400).json({ error: 'Name and email are required' });
    }

    // Build Airtable API URL
    const airtableUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_TABLE_NAME)}`;

    // Build the record - ONLY include fields that have values
    const fields = {
      'First Name': String(data['First Name']).trim(),
      'Email': String(data['Email']).trim().toLowerCase()
    };

    // Optional text fields
    if (data['Phone']) {
      fields['Phone'] = String(data['Phone']).trim();
    }
    if (data['Country']) {
      fields['Country'] = String(data['Country']).trim();
    }
    if (data['Currency']) {
      fields['Currency'] = String(data['Currency']).trim();
    }

    // Number fields
    if (data['Monthly Surplus']) {
      const num = Number(data['Monthly Surplus']);
      if (!isNaN(num) && num > 0) {
        fields['Monthly Surplus'] = num;
      }
    }
    if (data['Liquid Assets']) {
      const num = Number(data['Liquid Assets']);
      if (!isNaN(num) && num > 0) {
        fields['Liquid Assets'] = num;
      }
    }
    if (data['Wealth Score']) {
      const num = Number(data['Wealth Score']);
      if (!isNaN(num) && num >= 0) {
        fields['Wealth Score'] = num;
      }
    }

    // Single Select fields - send whatever value comes from form
    // Airtable will auto-create the option if it doesn't exist
    if (data['Income Level']) {
      fields['Income Level'] = String(data['Income Level']).trim();
    }
    if (data['Professional Status']) {
      fields['Professional Status'] = String(data['Professional Status']).trim();
    }
    if (data['Primary Concern']) {
      fields['Primary Concern'] = String(data['Primary Concern']).trim();
    }
    if (data['Timeline']) {
      fields['Timeline'] = String(data['Timeline']).trim();
    }

    // Note: Skipping 'Created At' - Airtable will use Created time field or you can add it manually

    const airtableRecord = { fields };

    console.log('Sending to Airtable:', JSON.stringify(fields, null, 2));

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
      console.error('Airtable error:', response.status, JSON.stringify(errorData));
      return res.status(response.status).json({
        error: 'Failed to save to Airtable',
        details: errorData
      });
    }

    const result = await response.json();
    console.log('Success! Record ID:', result.id);
    return res.status(200).json({ success: true, id: result.id });

  } catch (error) {
    console.error('Server error:', error.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
