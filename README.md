# Wealth Architecture Analyzer

A lead capture form with AI-powered wealth analysis, PDF report generation, and automatic Airtable integration.

## 🔐 Security Features

- All API tokens stored securely in Vercel Environment Variables
- No sensitive credentials exposed in client-side code
- Serverless API route handles all third-party integrations

## 📁 Project Structure

```
wealth-analyzer/
├── index.html          # Main form & report UI
├── api/
│   └── upload-pdf.js   # Serverless function for PDF upload & Airtable
├── package.json        # Dependencies
├── vercel.json         # Vercel configuration
└── .env.example        # Example environment variables
```

## 🚀 Setup Instructions

### Step 1: Deploy to Vercel

1. Push this folder to your GitHub repository
2. Import the project in Vercel Dashboard
3. Deploy

### Step 2: Set Environment Variables

Go to **Vercel Dashboard** → **Your Project** → **Settings** → **Environment Variables**

Add these variables:

| Variable | Description | How to Get |
|----------|-------------|------------|
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob storage token | Vercel Dashboard → Storage → Create Blob Store |
| `AIRTABLE_API_TOKEN` | Airtable Personal Access Token | [airtable.com/create/tokens](https://airtable.com/create/tokens) |
| `AIRTABLE_BASE_ID` | Your Airtable Base ID | From base URL: `airtable.com/appXXXXX/...` |
| `AIRTABLE_TABLE_ID` | Your Airtable Table ID | From table URL: `airtable.com/appXXX/tblYYYYY/...` |

### Step 3: Create Airtable Fields

Your Airtable table should have these fields:

| Field Name | Type |
|------------|------|
| First Name | Single line text |
| Last Name | Single line text |
| Email | Email |
| Phone | Single line text |
| Country | Single line text |
| Currency | Single line text |
| Income Level | Single line text |
| Monthly Surplus | Number |
| Liquid Assets | Number |
| Professional Status | Single line text |
| Primary Concern | Long text |
| Timeline | Single line text |
| Wealth Score | Number |
| Score Label | Single line text |
| PDF Report | Attachment |
| Created At | Date |

### Step 4: Redeploy

After adding environment variables, trigger a new deployment for changes to take effect.

## 🔄 How It Works

```
User submits form
       ↓
Zapier webhook → Creates Airtable record
       ↓
User clicks "Download PDF"
       ↓
PDF generates in browser
       ↓
/api/upload-pdf serverless function:
  1. Uploads PDF to Vercel Blob
  2. Finds Airtable record by email
  3. Attaches PDF URL to record
       ↓
User downloads PDF locally
```

## 📝 Zapier Webhook Data

The form sends these fields to Zapier:

- First Name, Last Name, Email, Phone
- Country, Currency, Income Level
- Monthly Surplus, Liquid Assets
- Professional Status, Primary Concern
- Timeline, Wealth Score, Score Label
- Created At

## 🛡️ Security Notes

- Never commit `.env` files with real tokens
- Rotate API tokens if accidentally exposed
- Use Vercel's environment variable encryption
- The serverless function runs on Vercel's secure infrastructure

## 📞 Support

For questions, contact June Yoon at Success Resources.
