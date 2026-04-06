export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const {
      firstName,
      lastName,
      email,
      phone,
      country,
      currency,
      income,
      surplus,
      liquid,
      status,
      concern,
      timeline,
      wealthScore,
      createdAt,
      pdfUrl,
      pdfFileName
    } = req.body || {};

    if (!email || !pdfUrl) {
      return res.status(400).json({ error: 'Missing required fields: email, pdfUrl' });
    }

    const baseId = process.env.AIRTABLE_BASE_ID;
    const tableName = process.env.AIRTABLE_TABLE_NAME;
    const apiKey = process.env.AIRTABLE_API_KEY;

    if (!baseId || !tableName || !apiKey) {
      return res.status(500).json({ error: 'Missing Airtable env vars' });
    }

    const endpoint = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}`;

    const fields = {
      'First Name': firstName || '',
      'Last Name': lastName || '',
      'Email': email || '',
      'Phone': phone || '',
      'Country': country || '',
      'Currency': currency || '',
      'Income Level': income || '',
      'Monthly Surplus': Number(surplus || 0),
      'Liquid Assets': Number(liquid || 0),
      'Professional Status': status || '',
      'Primary Concern': concern || '',
      'Timeline': timeline || '',
      'Wealth Score': Number(wealthScore || 0),
      'Created At': createdAt || new Date().toISOString(),
      'Report PDF': [
        {
          url: pdfUrl,
          filename: pdfFileName || 'wealth-report.pdf'
        }
      ]
    };

    const airtableRes = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ fields })
    });

    const data = await airtableRes.json();

    if (!airtableRes.ok) {
      console.error('Airtable error:', data);
      return res.status(airtableRes.status).json({
        error: 'Failed to save to Airtable',
        details: data
      });
    }

    return res.status(200).json({ ok: true, recordId: data.id });
  } catch (error) {
    console.error('save-to-airtable error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
