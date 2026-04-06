import { put } from '@vercel/blob';

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const { fileName, pdfBase64, contentType = 'application/pdf' } = req.body || {};

    if (!fileName || !pdfBase64) {
      return res.status(400).json({ error: 'Missing fileName or pdfBase64' });
    }

    // pdfBase64 can be pure base64 or data URL
    const base64 = pdfBase64.includes(',')
      ? pdfBase64.split(',')[1]
      : pdfBase64;

    const buffer = Buffer.from(base64, 'base64');

    const blob = await put(fileName, buffer, {
      access: 'public',
      contentType,
      token: process.env.BLOB_READ_WRITE_TOKEN
    });

    return res.status(200).json({
      ok: true,
      url: blob.url,
      pathname: blob.pathname
    });
  } catch (error) {
    console.error('upload-report error:', error);
    return res.status(500).json({ error: 'Failed to upload PDF' });
  }
}
