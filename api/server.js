const express = require('express');
const cors = require('cors');
const path = require('path');
const { handleInboundWebhookTask } = require('./skills/metaAutopilot');
const { runAIEngine } = require('./skills/aiEngine');
const { dispatchPaymentReminder } = require('./skills/communication');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors({ origin: [ /srdgintel\.com$/, /localhost/ ], methods: ['GET', 'POST'] }));
app.use(express.json({ limit: '10mb' }));

// Rapid Health Diagnostics
app.get('/api/health', (req, res) => res.json({ status: "ok", timestamp: new Date().toISOString() }));

// Meta Endpoint Handlers
app.get('/api/webhooks/meta', (req, res) => {
    if (req.query['hub.mode'] === 'subscribe' && req.query['hub.verify_token'] === process.env.META_WEBHOOK_VERIFY_TOKEN) {
        console.log("✅ Meta Webhook Verified Successfully!");
        return res.status(200).send(req.query['hub.challenge']);
    }
    console.error("❌ Meta Webhook Verification Failed.");
    res.sendStatus(403);
});

app.post('/api/webhooks/meta', (req, res) => {
    // Acknowledge Meta immediately within 3 seconds to prevent loop storms
    res.status(200).send('EVENT_RECEIVED');
    
    // Hand over work payload processing to background context threads
    handleInboundWebhookTask(req.body);
});

// Front-End Application Target Invoicing Routers
app.post('/api/ai/voice-to-invoice', async (req, res) => {
    try {
        const { transcript } = req.body;
        if (!transcript) return res.status(400).json({ error: "Empty transcription payload provided" });

        const resultData = await runAIEngine({
            promptText: `Extract invoice datasets out of transcript: "${transcript}"`,
            engine: process.env.INVOICE_AI_ENGINE || 'groq'
        });

        const lineItems = resultData.invoiceData?.lineItems || [];
        const subtotal = lineItems.reduce((sum, item) => sum + (item.amount || (item.quantity * item.unitPrice || 0)), 0);
        const taxAmount = Math.round(subtotal * 0.075); // 7.5% Standard VAT Calculation

        res.json({
            invoice: { ...resultData.invoiceData, subtotal, taxAmount, total: subtotal + taxAmount }
        });
    } catch (err) {
        res.status(500).json({ error: "Voice structured execution sequence processing failure" });
    }
});

app.post('/api/ai/photo-to-invoice', async (req, res) => {
    try {
        const { imageBase64, description } = req.body;
        if (!imageBase64) return res.status(400).json({ error: "Missing required source image references" });

        const resultData = await runAIEngine({
            promptText: `Analyze target invoice imagery metrics layout context. Context details: ${description || 'None'}`,
            base64Image: imageBase64,
            engine: 'qwen'
        });

        res.json({ invoice: resultData.invoiceData });
    } catch (err) {
        res.status(500).json({ error: "Visual invoice entity extraction mapping runtime failure" });
    }
});

app.post('/api/email/remind', async (req, res) => {
    try {
        const mailResult = await dispatchPaymentReminder(req.body);
        res.json({ success: true, messageId: mailResult.messageId });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

if (require.main === module) {
    app.listen(port, () => console.log(`🚀 Dedicated Skills Engine Server functional on port: ${port}`));
}

module.exports = app;
app.use(cors({ origin: [ /srdgintel\.com$/, /localhost/ ], methods: ['GET', 'POST'] }));
app.use(express.json({ limit: '10mb' }));

// ADD THIS EXACT LINE TO SERVE YOUR UI:
app.use(express.static(path.join(__dirname, '../public')));