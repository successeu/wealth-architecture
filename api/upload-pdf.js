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

// Helper function to search Airtable with retry
async function findAirtableRecord(email, airtableBaseId, airtableTableId, airtableToken, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    console.log(`🔍 Attempt ${attempt}: Finding Airtable record for: ${email}`);
    
    // Encode the email properly for the filter formula
    const encodedEmail = encodeURIComponent(email);
    const filterFormula = encodeURIComponent(`{Email}="${email}"`);
    const searchUrl = `https://api.airtable.com/v0/${airtableBaseId}/${airtableTableId}?filterByFormula=${filterFormula}&maxRecords=1`;
    
    console.log(`🔗 Search URL: ${searchUrl}`);

    const searchResponse = await fetch(searchUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${airtableToken}`,
        'Content-Type': 'application/json',
      },
    });

    const searchData = await searchResponse.json();
    console.log(`📋 Airtable search response:`, JSON.stringify(searchData));

    if (searchData.records && searchData.records.length > 0) {
      return searchData.records[0];
    }

    if (searchData.error) {
      console.error(`❌ Airtable API error:`, searchData.error);
    }

    // Wait before retry (2 seconds, 4 seconds, 6 seconds)
    if (attempt < retries) {
      console.log(`⏳ Record not found, waiting ${attempt * 2} seconds before retry...`);
      await new Promise(resolve => setTimeout(resolve, attempt * 2000));
    }
  }
  
  return null;
}

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

    // Step 3: Find Airtable record by email (with retry)
    const airtableBaseId = process.env.AIRTABLE_BASE_ID;
    const airtableTableId = process.env.AIRTABLE_TABLE_ID;
    const airtableToken = process.env.AIRTABLE_API_TOKEN || process.env.AIRTABLE_API_KEY;
    
    // Debug: Log environment variables (without exposing full token)
    console.log('🔑 Airtable config:', {
      baseId: airtableBaseId,
      tableId: airtableTableId,
      tokenExists: !!airtableToken,
      tokenPrefix: airtableToken ? airtableToken.substring(0, 10) + '...' : 'MISSING'
    });

    const record = await findAirtableRecord(email, airtableBaseId, airtableTableId, airtableToken);

    if (record) {
      const recordId = record.id;
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
            'PDF Report': blob.url,
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
      console.log('⚠️ No Airtable record found for email after retries:', email);
      return res.status(200).json({
        success: true,
        message: 'PDF uploaded but no Airtable record found for this email',
        pdfUrl: blob.url,
        note: 'The Zapier record may not have synced yet. You can manually attach the PDF using the URL above.',
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
