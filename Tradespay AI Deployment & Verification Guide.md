# Tradespay AI Deployment & Verification Guide

Follow these steps to deploy the updated configuration and UI to your AWS server and verify that the system is running correctly.

## 1. Upload Updated Files to AWS

Run these commands from your local machine (where the files are saved) to upload them to your AWS server. Replace `your-user` and `your-server-ip` with your actual AWS credentials.

```bash
# Upload the corrected .env file
scp tradespay.env your-user@your-server-ip:/home/ubuntu/tradespay-backend/.env

# Upload the updated UI file
scp autopilot_code.html your-user@your-server-ip:/home/ubuntu/tradespay-backend/auto_pilot_settings/code.html
```

## 2. Deploy and Restart the Server

Once the files are uploaded, SSH into your AWS server and run the deployment script.

```bash
# SSH into your server
ssh your-user@your-server-ip

# Navigate to the backend directory
cd /home/ubuntu/tradespay-backend

# Run the deployment script
./deploy-api.sh
```

The `deploy-api.sh` script will:
1. Install any new dependencies.
2. Apply the new `.env` settings.
3. Restart the API process using PM2.

## 3. Verify the Status

After restarting, verify that the server is healthy and the autopilot is active.

### Health Check
Run this command on the server to check the API status:
```bash
curl http://localhost:3000/api/health
```
You should receive a JSON response: `{"status": "ok", ...}`.

### PM2 Status
Check the status of the running process:
```bash
pm2 status tradespay-api
```
The status should be **online**.

### Webhook Verification
Verify that your Meta Webhook is responding correctly:
```bash
curl "http://localhost:3000/api/webhooks/meta?hub.mode=subscribe&hub.verify_token=tradespay_ai_secure_token_2026_xyz&hub.challenge=test_challenge"
```
The response should be `test_challenge`.

## 4. Test the UI

Open your browser and navigate to the autopilot configuration page (e.g., `https://tradespay.srdgintel.com/auto_pilot_settings/code.html`). 

*   **Welcome Message:** A new window should automatically open with the message: "Welcome to TradespayAI Autopilot! Never lose a DM or miss sales."
*   **Autopilot Functionality:** Ensure the "Instagram DM" toggle is active and the "AI Sample Output" is visible.

---

**Note:** Ensure you have replaced `YOUR_LONG_LIVED_META_PAGE_ACCESS_TOKEN_HERE` in the `.env` file with a valid token from the Meta App Dashboard before uploading.
