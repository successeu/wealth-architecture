// Vercel Serverless Function: /api/upload-pdf
// This handles PDF upload to Vercel Blob and attaches to Airtable
// Tokens are stored securely in Vercel Environment Variables

import { put } from '@vercel/blob';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
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
    const { pdfBase64, fileName, email } = req.body;

    if (!pdfBase64 || !fileName || !email) {
      return res.status(400).json({ error: 'Missing required fields: pdfBase64, fileName, email' });
    }

    // Step 1: Convert base64 to buffer
    const pdfBuffer = Buffer.from(pdfBase64, 'base64');

    // Step 2: Upload to Vercel Blob
    console.log('📤 Uploading PDF to Vercel Blob...');
    
    const blob = await put(fileName, pdfBuffer, {
      access: 'public',
      contentType: 'application/pdf',
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    console.log('✅ PDF uploaded to Vercel Blob:', blob.url);

    // Step 3: Find Airtable record by email
    console.log('🔍 Finding Airtable record for:', email);
    
    const airtableBaseId = process.env.AIRTABLE_BASE_ID;
    const airtableTableId = process.env.AIRTABLE_TABLE_ID;
    const airtableToken = process.env.AIRTABLE_API_TOKEN;

    const searchUrl = `https://api.airtable.com/v0/${airtableBaseId}/${airtableTableId}?filterByFormula={Email}="${email}"&maxRecords=1`;

    const searchResponse = await fetch(searchUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${airtableToken}`,
        'Content-Type': 'application/json',
      },
    });

    const searchData = await searchResponse.json();

    if (searchData.records && searchData.records.length > 0) {
      const recordId = searchData.records[0].id;
      console.log('✅ Found Airtable record:', recordId);

      // Step 4: Update Airtable record with PDF attachment
      const updateUrl = `https://api.airtable.com/v0/${airtableBaseId}/${airtableTableId}/${recordId}`;

      const updateResponse = await fetch(updateUrl, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${airtableToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fields: {
            'PDF Report': [
              {
                url: blob.url,
                filename: fileName,
              },
            ],
          },
        }),
      });

      if (updateResponse.ok) {
        console.log('✅ PDF attached to Airtable record successfully!');
        return res.status(200).json({
          success: true,
          message: 'PDF uploaded and attached to Airtable',
          pdfUrl: blob.url,
          recordId: recordId,
        });
      } else {
        const errorData = await updateResponse.json();
        console.error('❌ Airtable update error:', errorData);
        return res.status(200).json({
          success: true,
          message: 'PDF uploaded but could not attach to Airtable',
          pdfUrl: blob.url,
          airtableError: errorData,
        });
      }
    } else {
      console.log('⚠️ No Airtable record found for email:', email);
      return res.status(200).json({
        success: true,
        message: 'PDF uploaded but no Airtable record found for this email',
        pdfUrl: blob.url,
        note: 'The Zapier record may not have synced yet',
      });
    }
  } catch (error) {
    console.error('❌ Server error:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}
