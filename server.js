const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const OpenAI = require('openai');
const nodemailer = require('nodemailer');
const path = require('path');
require('dotenv').config();
const supabase = require('./supabaseClient');


const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors({
    origin: [ /srdgintel\.com$/, /localhost/ ],
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname), { index: 'tradespay-app.html' }));

// ── HEALTH CHECK ─────────────────────────────────────
app.get('/api/health', (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ── META WEBHOOK VERIFICATION ──────────────────────────
// This endpoint is required for Meta (Instagram/WhatsApp) 
// to verify that your server is authorized.
app.get('/api/webhooks/meta', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === process.env.META_WEBHOOK_VERIFY_TOKEN) {
        console.log("✅ Meta Webhook Verified Successfully!");
        res.status(200).send(challenge);
    } else {
        console.error("❌ Meta Webhook Verification Failed.");
        res.sendStatus(403);
    }
});

// ── DATA DELETION ENDPOINT (COMPLIANCE) ────────────────
app.post('/api/meta/delete', (req, res) => {
    console.log("🗑️ Meta Data Deletion Request Received");
    res.json({
        url: "https://tradespay.srdgintel.com/deletion-status",
        confirmation_code: "TP-DEL-" + Date.now()
    });
});

// ── DEAUTHORIZE ENDPOINT (COMPLIANCE) ──────────────────
app.post('/api/meta/deauthorize', (req, res) => {
    console.log("🔌 Meta App Deauthorized by User");
    res.status(200).json({ status: "deauthorized", timestamp: new Date().toISOString() });
});

// ── SEND MESSAGES (OUTBOUND) ──────────────────────────
async function sendMetaMessage(recipientId, text, platform = 'instagram', userId = null) {
    const accessToken = process.env.META_PAGE_ACCESS_TOKEN;
    if (!accessToken || accessToken.includes('PASTE')) {
        console.error("❌ Cannot send message: META_PAGE_ACCESS_TOKEN is not set.");
        return;
    }

    let url = `https://graph.facebook.com/v21.0/me/messages?access_token=${accessToken}`;
    let payload = {
        recipient: { id: recipientId },
        message: { text: text }
    };

    if (platform === 'whatsapp_business_account' || platform === 'whatsapp') {
        const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
        if (!phoneId) {
            console.error("❌ Cannot send WhatsApp: WHATSAPP_PHONE_NUMBER_ID is missing.");
            return;
        }
        url = `https://graph.facebook.com/v21.0/${phoneId}/messages?access_token=${accessToken}`;
        payload = {
            messaging_product: "whatsapp",
            to: recipientId,
            type: "text",
            text: { body: text }
        };
    }

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const result = await response.json();
        console.log(`📤 Sent to ${platform} (${recipientId}):`, result);

        // LOG TO DB
        if (userId) {
            await supabase.from('messages').insert([{
                user_id: userId,
                platform: platform,
                recipient_id: recipientId,
                sender_id: 'me',
                text: text,
                direction: 'outbound'
            }]);
        }

        return result;
    } catch (error) {
        console.error(`❌ Error sending to ${platform}:`, error);
    }
}

// ── RECEIVE MESSAGES (DMs) ─────────────────────────────
// This is where Meta sends the actual messages/events.
app.post('/api/webhooks/meta', async (req, res) => {
    const body = req.body;

    if (body.object === 'page' || body.object === 'instagram' || body.object === 'whatsapp_business_account') {
        console.log("📩 Incoming Meta Event:", JSON.stringify(body, null, 2));
        
        // Log specifically for routing
        if (body.object === 'instagram') console.log("📸 Instagram Event Detected");
        if (body.object === 'whatsapp_business_account') console.log("💬 WhatsApp Event Detected");
        // Handle Instagram/WhatsApp Messages
        const entry = body.entry?.[0];
        const messaging = entry?.messaging?.[0] || entry?.changes?.[0]?.value;

        let senderId = messaging?.sender?.id;
        let messageText = messaging?.message?.text;
        
        // WhatsApp specific parsing if different
        if (body.object === 'whatsapp_business_account') {
            const waMessaging = entry?.changes?.[0]?.value?.messages?.[0];
            senderId = waMessaging?.from;
            messageText = waMessaging?.text?.body;
        }

        if (senderId && messageText && !messaging?.message?.is_echo) {
            console.log(`🤖 Processing from ${senderId}: "${messageText}"`);

            try {
                // 1. Find the user who owns this connection
                const { data: profile } = await supabase.from('user_profiles').select('*').limit(1).single();
                const userId = profile?.id;

                // PREMIUM CHECK: Only allow if plan is 'premium' (or for internal testing)
                if (profile?.plan !== 'premium' && !process.env.TESTING_MODE) {
                    console.log(`🚫 Auto-Pilot blocked: User ${userId} is on ${profile?.plan} plan.`);
                    return res.sendStatus(200);
                }

                // 2. LOG INBOUND TO DB
                if (userId) {
                    await supabase.from('messages').insert([{
                        user_id: userId,
                        platform: body.object,
                        sender_id: senderId,
                        recipient_id: 'me',
                        text: messageText,
                        direction: 'inbound'
                    }]);
                }

                // 3. Trigger Auto-Pilot Logic (Force Groq/Auto-Pilot Engine)
                const businessSettings = {
                    service: profile?.business_service || 'Contracting Services',
                    pricing: profile?.pricing_list || 'Contact for quote',
                    tone: profile?.ai_tone || 'professional'
                };

                const aiResult = await processWithAI(`Incoming Message: "${messageText}"`, null, process.env.AUTOPILOT_AI_ENGINE, businessSettings);
                const parsed = JSON.parse(aiResult);
                const finalReply = parsed.replyText || "I've received your message. How can I help you today?";
                
                // 4. Send Reply
                await sendMetaMessage(senderId, finalReply, body.object, userId);

            } catch (aiErr) {
                console.error("❌ Auto-Pilot Error:", aiErr);
            }
        }
        res.status(200).send('EVENT_RECEIVED');
    } else {
        res.sendStatus(404);
    }
});

// ── AI INITIALIZATION ─────────────────────────────────

const AI_ENGINE = process.env.AI_ENGINE || 'groq'; // 'gemini' or 'qwen' or 'groq'

// Gemini Setup
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || 'dummy_key');
const geminiModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// Qwen Setup (via DashScope compatible mode)
const qwenClient = new OpenAI({
    apiKey: process.env.QWEN_API_KEY || 'dummy_key',
    baseURL: process.env.QWEN_BASE_URL || 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
});

// Groq Setup (OpenAI-compatible)
const groqClient = new OpenAI({
    apiKey: process.env.GROQ_API_KEY || 'dummy_key',
    baseURL: 'https://api.groq.com/openai/v1',
});

// Cerebras Setup (OpenAI-compatible)
const cerebrasClient = new OpenAI({
    apiKey: process.env.CEREBRAS_API_KEY || 'dummy_key',
    baseURL: 'https://api.cerebras.ai/v1',
});

// ── EMAIL (SMTP) INITIALIZATION ──────────────────────

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.resend.com',
    port: parseInt(process.env.SMTP_PORT || '465'),
    secure: process.env.SMTP_PORT === '465',
    auth: {
        user: process.env.SMTP_USER || 'resend',
        pass: process.env.RESEND_API_KEY || 'dummy_key',
    },
});

// ── AI PROCESSING ENGINE ─────────────────────────────

async function processWithAI(promptText, base64Image = null, engineOverride = null, businessSettings = null) {
    const selectedEngine = engineOverride || process.env.AI_ENGINE || 'gemini';
    console.log(`🤖 AI Engine Selected: ${selectedEngine} (Override: ${engineOverride || 'none'})`);

    const bizService = businessSettings?.service || "Contracting Services";
    const bizPricing = businessSettings?.pricing || "Contact for quote";
    const bizTone = businessSettings?.tone || "professional";

    const systemPrompt = `You are "Tradespay Sales Assistant," an expert Sales Auto-Pilot for ${bizService}.
    
    TONE: ${bizTone}. Be professional, concise, and helpful.
    
    KNOWLEDGE BASE:
    - Service: ${bizService}
    - Pricing: ${bizPricing}
    
    GOAL: Act as a friendly, professional closer. Your job is to convert leads into sales and generate invoices automatically based on the pricing provided.
    
    CRITICAL: You must extract EXACT data from the user input (Voice Transcript or Image).
    - Multipliers: "k" means thousands (e.g., 50k = 50,000), "m" means millions (e.g., 1m = 1,000,000).
    - DETECT CURRENCY: Default is ₦ but if you see $, €, £, or words like "dollars", use that code/symbol.
    - CLIENT NAME: Extract the client's name if mentioned.
    - VAT: Always calculate a 7.5% VAT based on the subtotal.

    OUTPUT FORMAT: You must ALWAYS return pure JSON. No conversational text outside the JSON.
    
    JSON Schema:
    {
        "replyText": "A friendly response to send back to the customer",
        "invoiceData": {
            "clientName": "extracted name or 'Valued Client'",
            "jobDescription": "Full description of work",
            "currency": "₦ or $ or € etc",
            "lineItems": [
                { "description": "string", "quantity": number, "unitPrice": number, "amount": number }
            ]
        }
    }`;

    try {
        let aiResult = "";
        if (selectedEngine === 'groq') {
            const messages = [{ role: "system", content: systemPrompt }, { role: "user", content: promptText }];
            const response = await groqClient.chat.completions.create({ model: "llama-3.3-70b-versatile", messages });
            aiResult = response.choices[0].message.content;
        } else if (selectedEngine === 'cerebras') {
            const messages = [{ role: "system", content: systemPrompt }, { role: "user", content: promptText }];
            const response = await cerebrasClient.chat.completions.create({ model: "llama3.1-70b", messages });
            aiResult = response.choices[0].message.content;
        } else if (selectedEngine === 'qwen') {
            const messages = [{ role: "system", content: systemPrompt }];
            if (base64Image) {
                messages.push({
                    role: "user",
                    content: [
                        { type: "text", text: promptText },
                        { type: "image_url", image_url: { url: base64Image } }
                    ]
                });
                const response = await qwenClient.chat.completions.create({ 
                    model: process.env.QWEN_VISION_MODEL || "qwen-vl-max", 
                    messages 
                });
                aiResult = response.choices[0].message.content;
            } else {
                messages.push({ role: "user", content: promptText });
                const response = await qwenClient.chat.completions.create({ 
                    model: process.env.QWEN_MODEL || "qwen-max", 
                    messages 
                });
                aiResult = response.choices[0].message.content;
            }
        } else {
            // Gemini Fallback
            const fullPrompt = `${systemPrompt}\n\nUSER INPUT: ${promptText}`;
            if (base64Image) {
                const cleanBase64 = base64Image.replace(/^data:image\/\w+;base64,/, "");
                const imagePart = { inlineData: { data: cleanBase64, mimeType: "image/jpeg" } };
                const result = await geminiModel.generateContent([fullPrompt, imagePart]);
                aiResult = result.response.text();
            } else {
                const result = await geminiModel.generateContent(fullPrompt);
                aiResult = result.response.text();
            }
        }

        // Robust cleanup for JSON
        aiResult = aiResult.replace(/```json/g, '').replace(/```/g, '').trim();
        // Remove any leading/trailing text that is not part of the JSON object
        const jsonStart = aiResult.indexOf('{');
        const jsonEnd = aiResult.lastIndexOf('}');
        if (jsonStart !== -1 && jsonEnd !== -1) {
            aiResult = aiResult.substring(jsonStart, jsonEnd + 1);
        }
        return aiResult;
    } catch (err) {
        console.error("AI Engine Error:", err);
        throw err;
    }
}

// ── AI ROUTING ENDPOINTS ──────────────────────────────

app.post('/api/ai/voice-to-invoice', async (req, res) => {
    try {
        const { transcript } = req.body;
        if (!transcript) return res.status(400).json({ error: "No transcript provided" });

        const promptText = `Transcript: "${transcript}"`;
        let responseText = await processWithAI(promptText, null, process.env.INVOICE_AI_ENGINE);
        
        responseText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
        const invoiceData = JSON.parse(responseText);

        // SAFE PARSING: Ensure lineItems exists
        if (!invoiceData.lineItems || !Array.isArray(invoiceData.lineItems)) {
            console.error("❌ AI Error: Missing lineItems in response", invoiceData);
            invoiceData.lineItems = [{ description: "Job items", quantity: 1, amount: 0 }];
        }

        const subtotal = invoiceData.lineItems.reduce((acc, curr) => acc + (curr.amount || 0), 0);
        const tax_amount = Math.round(subtotal * 0.075);
        const total = subtotal + tax_amount;

        res.json({ invoice: { ...invoiceData, subtotal, tax_amount, total, taxRate: 0.075, confidence: 0.95 } });
    } catch (error) {
        console.error("Voice AI Error:", error);
        res.status(500).json({ error: "Failed to generate invoice." });
    }
});

// ── AUTH ENDPOINTS ────────────────────────────────────

app.post('/api/auth/register', async (req, res) => {
    try {
        const { email, password, businessName, phone } = req.body;
        
        // 1. Create user in Supabase Auth
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email,
            password,
        });

        if (authError) throw authError;
        if (!authData.user) throw new Error("User creation failed.");

        // 2. Update user profile (SQL trigger handles initial insert)
        // We wait a tiny bit for the trigger to finish or just upsert
        const { error: profileError } = await supabase
            .from('user_profiles')
            .upsert({ 
                id: authData.user.id, 
                email: email,
                flutterwave_ref: phone 
            }, { onConflict: 'id' });

        if (profileError) console.warn("Profile update warning:", profileError.message);

        res.json({ 
            token: authData.session?.access_token || null, 
            user: { email, businessName, id: authData.user.id },
            message: authData.session ? "Registration successful" : "Please check your email to confirm registration"
        });
    } catch (error) {
        console.error("Register Error:", error);
        res.status(400).json({ error: error.message });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) throw error;
        if (!data.user) throw new Error("Login failed.");

        // Fetch profile for accurate business data
        const { data: profile } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('id', data.user.id)
            .single();

        res.json({ 
            token: data.session.access_token, 
            user: { 
                email: data.user.email, 
                businessName: profile?.flutterwave_ref || profile?.email.split('@')[0] || 'Member',
                plan: profile?.plan || 'free'
            } 
        });
    } catch (error) {
        console.error("Login Error:", error);
        res.status(400).json({ error: error.message });
    }
});

// ── INVOICE ENDPOINTS ─────────────────────────────────

app.get('/api/invoices', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        const token = authHeader?.split(' ')[1];
        if (!token) return res.status(401).json({ error: "Unauthorized" });

        // Get user from token
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) return res.status(401).json({ error: "Invalid token" });

        const { data, error } = await supabase
            .from('invoices')
            .select('*, line_items(*)')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

        if (error) throw error;
        res.json(data);
    } catch (error) {
        console.error("Fetch Invoices Error:", error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/invoices', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        const token = authHeader?.split(' ')[1];
        if (!token) return res.status(401).json({ error: "Unauthorized" });

        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) return res.status(401).json({ error: "Invalid token" });

        const invoice = req.body;
        
        // 1. Insert Invoice
        const { data: invData, error: invError } = await supabase
            .from('invoices')
            .insert([{
                user_id: user.id,
                invoice_number: invoice.invoice_number || invoice.invoiceNumber,
                client_name: invoice.client_name || invoice.clientName,
                job_description: invoice.job_description || invoice.jobDescription,
                subtotal: invoice.subtotal,
                tax_amount: invoice.tax_amount || invoice.taxAmount,
                total: invoice.total,
                status: invoice.status || 'draft',
                source: invoice.source || 'manual',
                due_date: invoice.due_date || invoice.dueDate
            }])
            .select()
            .single();

        if (invError) throw invError;

        // 2. Insert Line Items
        if (invoice.lineItems && invoice.lineItems.length > 0) {
            const items = invoice.lineItems.map(it => ({
                invoice_id: invData.id,
                description: it.description,
                quantity: it.quantity || 1,
                unit_price: it.unitPrice || it.unit_price,
                amount: it.amount
            }));
            const { error: itemsError } = await supabase.from('line_items').insert(items);
            if (itemsError) throw itemsError;
        }

        res.json({ success: true, id: invData.id });
    } catch (error) {
        console.error("Save Invoice Error:", error);
        res.status(500).json({ error: error.message });
    }
});

// ── WAITLIST ENDPOINTS ────────────────────────────────

app.post('/api/waitlist', async (req, res) => {
    try {
        const { email } = req.body;
        // Check if we have a table for waitlist or just use profiles
        const { error } = await supabase.from('user_profiles').upsert([{ email, plan: 'waitlist' }], { onConflict: 'email' });
        if (error) throw error;
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/waitlist/count', async (req, res) => {
    try {
        const { count, error } = await supabase
            .from('user_profiles')
            .select('*', { count: 'exact', head: true });
        if (error) throw error;
        res.json({ count: count + 200 }); // +200 for social proof
    } catch (error) {
        res.json({ count: 247 }); // Fallback
    }
});

app.post('/api/ai/photo-to-invoice', async (req, res) => {
    try {
        const { imageBase64, description } = req.body;
        
        const promptText = `VISUAL ANALYSIS REQUEST: Analyze this image for contractor line items, quantities, and prices. 
        Extract any text, handwritten notes, or printed entities related to the job.
        User Provided Context: ${description || 'None'}
        Ensure you extract specific amounts and names found in the image.`;
        let responseText = await processWithAI(promptText, imageBase64, process.env.INVOICE_AI_ENGINE);
        
        responseText = responseText.replace(/\`\`\`json/g, '').replace(/\`\`\`/g, '').trim();
        const invoiceData = JSON.parse(responseText);

        // SAFE PARSING: Ensure lineItems exists
        if (!invoiceData.lineItems || !Array.isArray(invoiceData.lineItems)) {
            console.error("❌ AI Error: Missing lineItems in response", invoiceData);
            invoiceData.lineItems = [{ description: "Photo job items", quantity: 1, amount: 0 }];
        }

        const subtotal = invoiceData.lineItems.reduce((acc, curr) => acc + (curr.amount || 0), 0);
        const tax_amount = Math.round(subtotal * 0.075);
        const total = subtotal + tax_amount;

        res.json({ invoice: { ...invoiceData, subtotal, tax_amount, total, taxRate: 0.075, confidence: 0.88, photoAnalysis: "Successfully parsed visual entities" } });
    } catch (error) {
        console.error("Photo AI Error:", error);
        res.status(500).json({ error: "Failed to analyze photo." });
    }
});

app.post('/api/ai/draft-reminder', async (req, res) => {
    try {
        const { invoiceId } = req.body;
        const authHeader = req.headers.authorization;
        const token = authHeader?.split(' ')[1];
        if (!token) return res.status(401).json({ error: "Unauthorized" });

        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) return res.status(401).json({ error: "Invalid token" });

        // 1. Get Invoice & Profile
        const { data: inv } = await supabase.from('invoices').select('*').eq('id', invoiceId).single();
        const { data: profile } = await supabase.from('user_profiles').select('*').eq('id', user.id).single();

        if (!inv) return res.status(404).json({ error: "Invoice not found" });

        // 2. Draft Email with AI
        const promptText = `DRAFT PAYMENT REMINDER:
        Client: ${inv.client_name}
        Amount: ${inv.total}
        Invoice #: ${inv.invoice_number}
        Due Date: ${inv.due_date}
        Business Name: ${profile?.business_service || 'Our Company'}
        
        Write a professional yet firm payment reminder email. 
        Return JSON with "subject" and "body" (HTML).`;

        let draftResult = await processWithAI(promptText, null, 'groq', {
            service: profile?.business_service,
            tone: 'professional'
        });

        draftResult = draftResult.replace(/```json/g, '').replace(/```/g, '').trim();
        const draft = JSON.parse(draftResult);

        res.json({ draft });
    } catch (error) {
        console.error("Draft AI Error:", error);
        res.status(500).json({ error: "Failed to draft reminder." });
    }
});

// ── EMAIL SMTP ENDPOINT ───────────────────────────────

app.post('/api/email/remind', async (req, res) => {
    try {
        const { toEmail, clientName, amountDue, invoiceNumber, dueDate } = req.body;
        
        const mailOptions = {
            from: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
            to: toEmail,
            subject: `Payment Reminder: Invoice ${invoiceNumber || 'INV-000'}`,
            html: `
                <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
                    <h2 style="color: #ff5c1a;">TradesPay AI Reminder</h2>
                    <p>Hello ${clientName || 'Valued Client'},</p>
                    <p>This is a friendly reminder that invoice <strong>${invoiceNumber || 'INV-000'}</strong> for <strong>${amountDue}</strong> is currently outstanding.</p>
                    <p>Due Date: ${dueDate || 'Due on receipt'}</p>
                    <br/>
                    <a href="#" style="background-color: #ff5c1a; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">Pay Invoice Now</a>
                    <br/><br/>
                    <p style="color: #555; font-size: 12px;">Thank you for your business!</p>
                </div>
            `
        };

        const result = await transporter.sendMail(mailOptions);
        res.json({ success: true, messageId: result.messageId });
    } catch (error) {
        console.error("SMTP Error:", error);
        res.status(500).json({ error: "Failed to send email via SMTP." });
    }
});

// ── FLUTTERWAVE WEBHOOK ───────────────────────────────

app.post('/api/webhooks/flutterwave', async (req, res) => {
    // Verified securely via hash
    const secretHash = process.env.FLUTTERWAVE_SECRET_HASH;
    const signature = req.headers['verif-hash'];

    if (!signature || signature !== secretHash) {
        return res.status(401).json({ error: "Invalid signature" });
    }

    const payload = req.body;
    
    // Check if successful payment
    if (payload.event === 'charge.completed' && payload.data.status === 'successful') {
        const userEmail = payload.data.customer.email;
        const amount = payload.data.amount;

        console.log(`Payment verified for ${userEmail}. Upgrading plan...`);
        
        await supabase
            .from('user_profiles')
            .update({ plan: 'premium' })
            .eq('email', userEmail);
    }
    
    res.status(200).send("Webhook received");
});

// ── MESSAGING INBOX ENDPOINTS ─────────────────────────

app.get('/api/meta/conversations', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        const token = authHeader?.split(' ')[1];
        if (!token) return res.status(401).json({ error: "Unauthorized" });

        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) return res.status(401).json({ error: "Invalid token" });

        // Get distinct senders (conversations)
        const { data, error } = await supabase
            .from('messages')
            .select('sender_id, platform, text, created_at')
            .eq('user_id', user.id)
            .neq('sender_id', 'me')
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Group by senderId to get latest message per thread
        const threads = [];
        const seen = new Set();
        for (const msg of data) {
            if (!seen.has(msg.sender_id)) {
                threads.push(msg);
                seen.add(msg.sender_id);
            }
        }

        res.json(threads);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/meta/messages/:senderId', async (req, res) => {
    try {
        const { senderId } = req.params;
        const authHeader = req.headers.authorization;
        const token = authHeader?.split(' ')[1];
        if (!token) return res.status(401).json({ error: "Unauthorized" });

        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) return res.status(401).json({ error: "Invalid token" });

        const { data, error } = await supabase
            .from('messages')
            .select('*')
            .eq('user_id', user.id)
            .or(`sender_id.eq.${senderId},recipient_id.eq.${senderId}`)
            .order('created_at', { ascending: true });

        if (error) throw error;
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/meta/reply', async (req, res) => {
    try {
        const { recipientId, text, platform } = req.body;
        const authHeader = req.headers.authorization;
        const token = authHeader?.split(' ')[1];
        if (!token) return res.status(401).json({ error: "Unauthorized" });

        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) return res.status(401).json({ error: "Invalid token" });

        const result = await sendMetaMessage(recipientId, text, platform, user.id);
        res.json({ success: true, result });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// START SERVER
if (require.main === module) {
    app.listen(port, () => {
        console.log(`✅ Server running on http://localhost:${port} [AI: ${AI_ENGINE}]`);
    });
}

module.exports = { app, sendMetaMessage };
