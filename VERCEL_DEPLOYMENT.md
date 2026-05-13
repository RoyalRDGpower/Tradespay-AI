# Tradespay AI - Vercel Deployment Setup Guide

## Overview
This repo is now configured for **full-stack deployment on Vercel** with:
- ✅ Static frontend (HTML/JS/CSS)
- ✅ Node.js backend API functions
- ✅ Environment variable management
- ✅ CORS configured for frontend-backend communication

---

## 🚀 Deployment Steps

### 1. Push to GitHub
```bash
git add .
git commit -m "Setup: Configure Vercel for full-stack deployment"
git push origin main
```

### 2. Connect to Vercel
1. Go to [vercel.com](https://vercel.com)
2. Click **"Import Project"**
3. Select your GitHub repo `RoyalRDGpower/Tradespay-AI`
4. Click **"Deploy"**

### 3. Configure Environment Variables in Vercel Dashboard
After connecting, go to **Settings → Environment Variables** and add:

```
# Supabase
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key

# AI Engines
GROQ_API_KEY=your_groq_api_key
QWEN_API_KEY=your_qwen_api_key
GEMINI_API_KEY=your_gemini_api_key
CEREBRAS_API_KEY=your_cerebras_api_key

# Email
RESEND_API_KEY=your_resend_api_key
RESEND_FROM_EMAIL=your_email@resend.dev
SMTP_HOST=smtp.resend.com
SMTP_PORT=465
SMTP_USER=resend

# Meta (Instagram/WhatsApp)
META_PAGE_ACCESS_TOKEN=your_page_access_token
META_WEBHOOK_VERIFY_TOKEN=your_verify_token
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id

# Flutterwave
FLUTTERWAVE_SECRET_HASH=your_flutterwave_hash

# Optional
AI_ENGINE=groq
TESTING_MODE=false
```

### 4. Deploy
- Vercel auto-deploys on push to main
- Check deployment logs in Vercel dashboard
- Your app will be available at `https://tradespay-ai.vercel.app`

---

## 📁 Project Structure (Vercel-Ready)

```
root/
├── api/
│   ├── server.js           # Express app
│   └── supabaseClient.js   # Supabase config
├── index.html              # Frontend entry
├── vercel.json            # ← NEW: Vercel config
├── package.json           # ← UPDATED: with build script
└── .gitignore            # ← UPDATED: deployment files
```

---

## ❌ Unused Branches (To Clean Up)

Delete these feature branches via GitHub:

```bash
git branch -D feat/supabase-edge-functions-8865838223994337690
git branch -D fix/vercel-deployment-supabase-crash-9767385688766249762
git branch -D fix-domain-routing-17674663625638211395
git branch -D fix-vercel-frontend-routing-3520127321917871152
git branch -D security-vulnerability-fix-17182211996036233390
git branch -D testing-improvement-sendMetaMessage-18431760003515607403
```

Or delete via GitHub UI: Settings → Branches → Delete.

---

## 🧪 Local Testing

```bash
npm install
npm run dev
# API runs on http://localhost:3000
# Frontend auto-opens in browser
```

---

## ✅ What We Fixed

| Issue | Solution |
|-------|----------|
| 404 errors on Vercel | Configured `vercel.json` with proper rewrites |
| Backend not running | Set up Node.js function handlers |
| Static files not served | Added root-level rewrite to `/index.html` |
| CORS errors | Updated CORS config in server.js |
| Missing build step | Added `"build"` script to package.json |
| Unclear config | This guide explains everything |

---

## 🔗 Important URLs

- **Frontend**: https://tradespay-ai.vercel.app
- **API Health**: https://tradespay-ai.vercel.app/api/health
- **Vercel Dashboard**: https://vercel.com/dashboard
- **Supabase Console**: https://app.supabase.com

---

## 📞 Troubleshooting

### Still seeing 404?
1. Check Vercel deployment logs
2. Verify environment variables are set
3. Clear browser cache and hard refresh

### API endpoints returning errors?
1. Check that API functions are in `/api` folder
2. Verify all environment variables are present
3. Check Supabase connection

### Frontend not loading?
1. Verify `index.html` is in root
2. Check CORS settings in `api/server.js`
3. Review browser console for errors

---

**Next Steps**: Deploy & test! 🚀
