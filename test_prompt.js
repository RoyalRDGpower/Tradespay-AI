const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

async function test() {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    const systemPrompt = `You are a professional accountant.
    Extract pricing perfectly from the transcript.
    CRITICAL RULE: "k" means thousands (e.g., 500k = 500000).
    CRITICAL RULE: "m" means millions (e.g., 10m = 10000000).
    Return ONLY pure JSON. 
    Structure: { "clientName": "...", "jobDescription": "...", "lineItems": [ { "description": "...", "amount": number } ] }`;

    const transcript = "bill bjohn 500k for plumbinjob";
    const prompt = systemPrompt + "\n\nTranscript: " + transcript;

    const result = await model.generateContent(prompt);
    console.log(result.response.text());
}

test();
