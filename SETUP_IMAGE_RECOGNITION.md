# Image Recognition Setup Guide

## Problem
Image recognition is not working because no LLM API keys are configured.

## Solution

### Step 1: Get an API Key

**Option A: Google Gemini (Recommended - Free tier available)**
1. Go to: https://makersuite.google.com/app/apikey
2. Sign in with your Google account
3. Click "Create API Key"
4. Copy the generated key

**Option B: OpenRouter (Paid, but supports many models)**
1. Go to: https://openrouter.ai/keys
2. Sign up for an account
3. Create an API key
4. Copy the generated key

### Step 2: Add the Key to Your Project

**For Local Development:**

Open the file `.env.local` and add one of these lines (remove the `=` from the line first):

For Gemini:
```
GEMINI_API_KEY=your-actual-key-here
```

For OpenRouter:
```
OPENROUTER_API_KEY=your-actual-key-here
```

**For Vercel Deployment:**

1. Go to your Vercel project dashboard
2. Navigate to Settings → Environment Variables
3. Add the same variable (GEMINI_API_KEY or OPENROUTER_API_KEY) with your key
4. Select "Production", "Preview", and "Development" environments
5. Click "Save"
6. Redeploy your application

### Step 3: Restart Your Development Server

After adding the key:
1. Stop your development server (Ctrl+C in the terminal)
2. Start it again: `npm start` or `npx expo start`

### Step 4: Test Image Recognition

1. Open your app
2. Go to the home screen
3. Click "Upload photo" or "Take photo"
4. Select an image
5. The app should now correctly identify the product

## Troubleshooting

### Still not working?

Run this command to check if the keys are set:
```bash
node check-env.js
```

### Check the logs

When you upload an image, check the console/logs for:
- `[ProductIntelligence] Starting extraction for:...`
- `[ProductIntelligence] Response status:...`
- Look for any error messages

### Common Issues

1. **Key has spaces** - Make sure there are no spaces around the `=` sign
2. **Wrong file** - Make sure you're editing `.env.local` not `.env`
3. **Server not restarted** - Always restart the development server after changing environment variables
4. **Vercel not updated** - If deployed, make sure to add the key to Vercel environment variables AND redeploy

## What's Configured vs What's Missing

✅ Working:
- Image upload from camera/gallery
- Image to base64 conversion  
- API endpoint exists (`/api/universal-search`)

❌ Missing:
- LLM API key to process the image
- Without this, the API returns an error and no product is identified

## Summary

The code is working correctly - it's just missing the LLM API key configuration. Once you add either `GEMINI_API_KEY` or `OPENROUTER_API_KEY` to `.env.local` and restart your server, image recognition will work for ANY product type (cosmetics, electronics, food, etc.).
