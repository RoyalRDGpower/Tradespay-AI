const nodemailer = require('nodemailer');
require('dotenv').config({ path: 'c:/Users/srdgintel/Desktop/Tradespay-Ai/.env' });

async function testEmail() {
    console.log("📧 Testing Email Sending (SMTP/Resend)...");

    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.resend.com',
        port: parseInt(process.env.SMTP_PORT || '465'),
        secure: process.env.SMTP_PORT === '465',
        auth: {
            user: process.env.SMTP_USER || 'resend',
            pass: process.env.RESEND_API_KEY,
        },
    });

    const mailOptions = {
        from: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
        to: 'srdgintel@outlook.com',
        subject: "🚀 TradesPay AI - Email System Test",
        html: `
            <div style="font-family: sans-serif; background: #131313; color: white; padding: 40px; border-radius: 10px;">
                <h1 style="color: #ff5c1a;">TradesPay AI</h1>
                <p>Hello!</p>
                <p>This is a test email from your **TradesPay AI Auto-Pilot** system.</p>
                <p>If you received this, it means your SMTP configuration (Resend) is **LIVE** and working.</p>
                <br/>
                <div style="border-top: 1px solid #333; padding-top: 20px; font-size: 12px; color: #888;">
                    This test was triggered by Antigravity AI.
                </div>
            </div>
        `
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log("✅ SUCCESS: Email sent!");
        console.log("📍 Message ID:", info.messageId);
    } catch (error) {
        console.error("❌ ERROR: Failed to send email:");
        console.error(error.message);
    }
}

testEmail();
