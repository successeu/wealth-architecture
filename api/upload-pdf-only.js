// Vercel Serverless Function: /api/upload-pdf-only
// Simple PDF upload to Vercel Blob - no Airtable integration
// The PDF URL will be sent to Zapier, which handles Airtable

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
    const { pdfBase64, fileName } = req.body;

    if (!pdfBase64 || !fileName) {
      return res.status(400).json({ error: 'Missing required fields: pdfBase64, fileName' });
    }

    // Convert base64 to buffer
    const pdfBuffer = Buffer.from(pdfBase64, 'base64');

    // Upload to Vercel Blob
    console.log('📤 Uploading PDF to Vercel Blob...');
    
    const blob = await put(fileName, pdfBuffer, {
      access: 'public',
      contentType: 'application/pdf',
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    console.log('✅ PDF uploaded to Vercel Blob:', blob.url);

    return res.status(200).json({
      success: true,
      pdfUrl: blob.url,
      message: 'PDF uploaded successfully'
    });

  } catch (error) {
    console.error('❌ Server error:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}
