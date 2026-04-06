export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
  const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
  const AIRTABLE_TABLE_NAME = process.env.AIRTABLE_TABLE_NAME;

  if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID || !AIRTABLE_TABLE_NAME) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  try {
    const data = req.body;

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
        'Wealth Score': Number(data['Wealth Score']) || 0
      }
    };

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
      return res.status(response.status).json({ error: 'Airtable error', details: errorData });
    }

    const result = await response.json();
    return res.status(200).json({ success: true, id: result.id });

  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
}
