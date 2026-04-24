# Tradespay AI - Meta Autopilot Analysis

## Google Drive Connector Capabilities

The Google Workspace CLI (`gws`) is a powerful tool that allows seamless interaction with Google Drive, Docs, Sheets, and Slides directly from the command line. During this test, I successfully utilized the connector to:

1.  **Search and Filter:** I used complex queries to locate specific folders (e.g., `Tradespay-Ai`) and files within them using `gws drive files list`.
2.  **Retrieve Metadata:** I fetched file IDs, names, and MIME types to understand the structure of the project.
3.  **Download Content:** I downloaded various file types, including plain text (`META_RECOVERY.txt`), environment variables (`.env`), HTML (`code.html`), and JavaScript (`server.js`) using `gws drive files get`.

## Tradespay AI Folder Analysis

I located the `Tradespay-Ai` folder (ID: `1p16c17xopzPuX07MgVOtsal14giB_NFL`) and explored its contents. The project is a Node.js application utilizing Express, Supabase, and various AI engines (Gemini, Groq, Qwen) to automate responses for trades businesses.

Key directories and files include:
*   `server.js`: The main application logic and webhook handler.
*   `.env`: Configuration and API keys.
*   `auto_pilot_settings/`: Contains the UI for the autopilot feature (`code.html`).
*   `META_RECOVERY.txt`: Contains recovery codes for the Meta Business Suite.

## Meta Autopilot Configuration Issues

Based on the analysis of the `.env` and `server.js` files, the Meta Autopilot configuration is currently failing due to a critical missing component: **The Meta Page Access Token**.

### 1. Missing Long-Lived Page Access Token

In the `.env` file, the `META_PAGE_ACCESS_TOKEN` is currently set to a placeholder or an invalid token:

```env
# 🔑 Meta Access Tokens (Required for Automation)
# Note: The tokens provided (App ID | Client Token) are App Tokens. 
# You will need a Long-Lived Page Access Token for Instagram/WhatsApp automation.
INSTAGRAM_AUTH_LINK=https://www.instagram.com/oauth/authorize?...
META_PAGE_ACCESS_TOKEN=EAAgoXn1HIxQBRMZAt8WUmobnrM1rM5hlhGfJSSB6hCTRYiYavIVtvmrpZA73fFWsbXcqQBdg21HRw6AYAOlfj9HcWcVMvnlkiOIuHbs4eFppxjJ88r1w1Cd3N6j8KFkgndZAg3DU5rMSg84GfinKPnePjNxdpvreXH5Qw4k35a08wbGegOgwqghzf5gYrX2UO8yW7lJmB5slCeEvgFOhAZDZD
```

The comment explicitly states that a Long-Lived Page Access Token is required. The current token appears to be either expired or incorrect.

In `server.js`, the `sendMetaMessage` function checks for this token:

```javascript
async function sendMetaMessage(recipientId, text, platform = 'instagram', userId = null) {
    const accessToken = process.env.META_PAGE_ACCESS_TOKEN;
    if (!accessToken || accessToken.includes('PASTE')) {
        console.error("❌ Cannot send message: META_PAGE_ACCESS_TOKEN is not set.");
        return;
    }
    // ...
}
```

If the token is invalid, Meta's Graph API will reject the POST request to send the automated reply.

### 2. Webhook Verification and Routing

The webhook verification endpoint (`/api/webhooks/meta`) appears to be correctly configured to use `META_WEBHOOK_VERIFY_TOKEN` (`tradespay_ai_secure_token_2026_xyz`).

However, the incoming message handler (`app.post('/api/webhooks/meta')`) relies on the `AUTOPILOT_AI_ENGINE` (set to `groq` in `.env`) to process the message:

```javascript
// 3. Trigger Auto-Pilot Logic (Force Groq/Auto-Pilot Engine)
const aiResult = await processWithAI(`Incoming Message: "${messageText}"`, null, process.env.AUTOPILOT_AI_ENGINE);
```

If the Groq API key (`GROQ_API_KEY`) is invalid or rate-limited, the `processWithAI` function will fail, preventing the autopilot from generating a response.

### 3. WhatsApp Configuration

If the autopilot is intended for WhatsApp, the `.env` file contains the necessary IDs:

```env
WHATSAPP_PHONE_NUMBER_ID=1104942666026766
WHATSAPP_BUSINESS_ACCOUNT_ID=2521259948315978
```

However, sending WhatsApp messages also requires the `META_PAGE_ACCESS_TOKEN` to be valid and to have the appropriate permissions (`whatsapp_business_messaging`).

## Recommendations to Fix the Autopilot

1.  **Generate a New Page Access Token:**
    *   Go to the Meta App Dashboard.
    *   Navigate to the API Setup section for Messenger/Instagram or WhatsApp.
    *   Generate a new Long-Lived Page Access Token.
    *   Update the `META_PAGE_ACCESS_TOKEN` in the `.env` file with the new token.
2.  **Verify AI Engine Keys:** Ensure that the `GROQ_API_KEY` is active and has sufficient quota, as it is the designated engine for the autopilot feature.
3.  **Check Webhook Subscriptions:** Ensure that the Meta App is subscribed to the correct webhook fields (`messages`, `messaging_postbacks` for Messenger/Instagram; `messages` for WhatsApp) in the Meta App Dashboard.
4.  **Restart the Server:** After updating the `.env` file, restart the Node.js server (e.g., using `pm2 restart tradespay-api` as seen in `deploy-api.sh`) to apply the changes.
