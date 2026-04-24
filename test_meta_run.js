require('dotenv').config({ path: 'c:/Users/srdgintel/Desktop/Tradespay-Ai/.env' });

async function testMetaConnection() {
    console.log("🔍 Testing Meta API Connection...");
    const token = process.env.META_PAGE_ACCESS_TOKEN;
    
    if (!token || token.includes('YOUR_')) {
        console.error("❌ ERROR: META_PAGE_ACCESS_TOKEN is not set correctly in .env");
        return;
    }

    try {
        const response = await fetch(`https://graph.facebook.com/v21.0/me?access_token=${token}`);
        const data = await response.json();
        
        if (data.id) {
            console.log(`✅ SUCCESS: Connected to Meta Page!`);
            console.log(`📍 Page ID: ${data.id}`);
            console.log(`📍 Page Name: ${data.name}`);
        } else {
            console.error("❌ ERROR: Meta API returned an error:");
            console.error(JSON.stringify(data, null, 2));
        }
    } catch (error) {
        console.error("❌ ERROR: Failed to connect to Meta API:", error.message);
    }
}

async function testAIEngine(engine) {
    console.log(`\n🤖 Testing AI Engine: ${engine}...`);
    try {
        // Mocking the prompt logic from server.js
        const { OpenAI } = require('openai');
        let client;
        let model;

        if (engine === 'groq') {
            client = new OpenAI({ apiKey: process.env.GROQ_API_KEY, baseURL: 'https://api.groq.com/openai/v1' });
            model = "llama-3.3-70b-versatile";
        } else if (engine === 'qwen') {
            client = new OpenAI({ apiKey: process.env.QWEN_API_KEY, baseURL: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1' });
            model = process.env.QWEN_MODEL || "qwen-max";
        }

        const response = await client.chat.completions.create({
            model: model,
            messages: [{ role: "user", content: "Say 'Engine is Online'" }]
        });

        console.log(`✅ ${engine} Response: "${response.choices[0].message.content}"`);
    } catch (error) {
        console.error(`❌ ${engine} ERROR:`, error.message);
    }
}

async function runAllTests() {
    await testMetaConnection();
    await testAIEngine('groq');
    await testAIEngine('qwen');
}

runAllTests();
