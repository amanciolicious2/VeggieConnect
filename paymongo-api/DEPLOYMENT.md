# PayMongo API Deployment Guide

## Prerequisites
- Vercel account connected to your GitHub repository
- Node.js 22.x installed locally (for testing)
- Vercel CLI installed (optional, for local deployment)

## Environment Variables Required in Vercel

Make sure these environment variables are set in your Vercel project settings:

1. **PAYMONGO_SECRET** - Your PayMongo secret key
2. **GOOGLE_APPLICATION_CREDENTIALS** - Firebase service account JSON (or use Vercel's environment variables)
3. **FIREBASE_PROJECT_ID** - Your Firebase project ID
4. **FIREBASE_CLIENT_EMAIL** - Firebase service account email
5. **FIREBASE_PRIVATE_KEY** - Firebase service account private key

## Deployment Steps

### Option 1: Deploy via Vercel Dashboard (Recommended)
1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your `paymongo-api` project
3. Go to Settings → Environment Variables
4. Add all required environment variables
5. Go to Deployments tab
6. Click "Redeploy" on the latest deployment, or push changes to trigger auto-deployment

### Option 2: Deploy via Vercel CLI
```bash
# Navigate to the paymongo-api directory
cd paymongo-api

# Install Vercel CLI if not already installed
npm i -g vercel

# Login to Vercel
vercel login

# Deploy to production
vercel --prod
```

### Option 3: Auto-deploy via Git Push
If your repository is connected to Vercel:
1. Commit and push your changes
2. Vercel will automatically deploy

## API Endpoints

After deployment, your API will be available at:
- `https://paymongo-api-fawn.vercel.app/api/createCheckoutSession` (POST)
- `https://paymongo-api-fawn.vercel.app/api/paymongoWebhook` (POST)
- `https://paymongo-api-fawn.vercel.app/api/completeOrder` (POST)

## Testing the Deployment

### Test createCheckoutSession endpoint:
```bash
curl -X POST https://paymongo-api-fawn.vercel.app/api/createCheckoutSession \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 10000,
    "description": "Test order",
    "successUrl": "https://amanciolicious.github.io/veggieconnect.github.io/order-success.html?orderId=test123&status=success",
    "cancelUrl": "https://amanciolicious.github.io/veggieconnect.github.io/payment-cancel.html?orderId=test123&status=cancelled"
  }'
```

## Troubleshooting

### 404 Error
- Ensure `vercel.json` is in the root of the `paymongo-api` directory
- Check that all API files are in the `api/` directory
- Verify the deployment completed successfully in Vercel dashboard

### Firebase Admin SDK Errors
- Ensure all Firebase environment variables are set in Vercel
- Check that the service account has proper permissions
- Verify the Firebase project ID matches your actual project

### CORS Errors
- The API endpoints already have CORS headers configured
- If issues persist, check browser console for specific error messages

