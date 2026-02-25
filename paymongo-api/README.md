# PayMongo API for VeggieConnect

Serverless API functions for handling PayMongo payment processing, deployed on Vercel.

## Quick Deploy

### Via Vercel Dashboard (Easiest)
1. Go to https://vercel.com/dashboard
2. Select your `paymongo-api` project
3. Click "Deployments" → "Redeploy" on the latest deployment

### Via Vercel CLI
```bash
cd paymongo-api
vercel --prod
```

### Via Git Push (Auto-deploy)
Just commit and push your changes - Vercel will auto-deploy if connected.

## Required Environment Variables

Set these in Vercel Dashboard → Settings → Environment Variables:

- `PAYMONGO_SECRET` - Your PayMongo secret key
- `FIREBASE_PROJECT_ID` - Your Firebase project ID (e.g., `vegieconnect-6bd73`)
- `FIREBASE_CLIENT_EMAIL` - Firebase service account email
- `FIREBASE_PRIVATE_KEY` - Firebase service account private key (with `\n` as actual newlines)

## API Endpoints

- `POST /api/createCheckoutSession` - Create PayMongo checkout session
- `POST /api/paymongoWebhook` - Handle PayMongo webhooks
- `POST /api/completeOrder` - Complete order processing

## Testing

After deployment, test the endpoint:
```bash
curl -X POST https://paymongo-api-fawn.vercel.app/api/createCheckoutSession \
  -H "Content-Type: application/json" \
  -d '{"amount": 10000, "successUrl": "https://example.com/success", "cancelUrl": "https://example.com/cancel"}'
```

