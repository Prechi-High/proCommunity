# Image Recognition Setup Guide

Photo scan uses the **Supabase Edge Function** `product-vision` (Gemini / OpenRouter / NVIDIA).  
It does **not** use Open Beauty Facts for identification.

## Required: Edge secrets (not Expo `.env` alone)

Keys must be set as **Supabase Edge Function secrets** for project `aqdptcuwpneuyzjavjak`.

1. Get a key:
   - Gemini (recommended): https://aistudio.google.com/apikey
   - or OpenRouter: https://openrouter.ai/keys

2. Set the secret (pick one):

```bash
npx supabase secrets set GEMINI_API_KEY=your-key --project-ref aqdptcuwpneuyzjavjak
# or
npx supabase secrets set OPENROUTER_API_KEY=your-key --project-ref aqdptcuwpneuyzjavjak
```

You need `SUPABASE_ACCESS_TOKEN` in `.env.local` (from https://supabase.com/dashboard/account/tokens).

3. Redeploy the function after changing secrets or code:

```bash
node scripts/deploy-product-vision.mjs
```

## Optional local copies

Putting `GEMINI_API_KEY` / `OPENROUTER_API_KEY` in `.env.local` does **not** power the phone app by itself.  
The app calls `https://…supabase.co/functions/v1/product-vision`, which only reads Edge secrets.

## How the flow works

1. Take / upload photo → app base64-encodes it  
2. POST to Supabase `product-vision` (vision LLM)  
3. Results screen shows the **Identified Product** card  
4. Open Beauty Facts catalog search is **skipped** for photo IDs  

Typed name search can still use the catalog (including OBF) — that is separate from photo detection.

## Troubleshooting

- Alert **Vision not configured** → Edge secret missing; run `supabase secrets set` above.  
- Alert **Could not identify it** → try a clearer, closer label photo.  
- Check Metro logs for `[ProductIntelligence]` and `[DEBUG]`.
