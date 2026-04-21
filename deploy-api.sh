#!/bin/bash
# 🚀 Tradespay AI API Deployment Script
# This script automates the backend update on your AWS/Linux server.

APP_DIR="/home/ubuntu/tradespay-backend" # Based on your server 'ls'
PM2_NAME="tradespay-api"

echo "------ Starting Deployment ------"

# 1. Pull latest changes (if using Git)
# git pull origin main

# 2. Install dependencies
echo "📦 Installing dependencies..."
npm install --production

# 3. Apply Environment Variables
if [ -f .env ]; then
    echo "✅ .env found"
else
    echo "⚠️ .env not found! Creating from example..."
    cp .env.example .env
fi

# 4. Restart the process with PM2
echo "🔄 Restarting API with PM2..."
if pm2 list | grep -q "$PM2_NAME"; then
    pm2 restart $PM2_NAME
else
    pm2 start server.js --name "$PM2_NAME"
fi

# 5. Save PM2 state
pm2 save

echo "------ Deployment Complete! ------"
echo "Health Check: curl http://localhost:3000/api/health"
