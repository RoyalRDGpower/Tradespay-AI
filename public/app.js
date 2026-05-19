const micBtn = document.getElementById('start-voice-btn');
const statusLog = document.getElementById('status-log');
const resultContainer = document.getElementById('result-container');
const jsonOutput = document.getElementById('json-output');

// Initialize Native Browser Speech Recognition
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

if (!SpeechRecognition) {
    statusLog.innerHTML = "⚠️ <strong>Error:</strong> Your browser does not support Voice AI. Please use Google Chrome or Edge.";
    micBtn.disabled = true;
    micBtn.style.opacity = "0.5";
} else {
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.lang = 'en-US';

    micBtn.addEventListener('click', () => {
        recognition.start();
        micBtn.innerText = "🛑 Listening...";
        micBtn.classList.add('listening');
        statusLog.innerHTML = "<span style='color: #fbbf24;'>🎙️ Microphone active. Speak naturally...</span>";
        resultContainer.style.display = "none";
    });

    recognition.onresult = async (event) => {
        // Stop UI animation
        micBtn.innerText = "🎙️ Tap to Speak";
        micBtn.classList.remove('listening');
        
        // Grab the text the browser heard
        const transcript = event.results[0][0].transcript;
        statusLog.innerHTML = `<strong>Heard:</strong> "${transcript}"<br><br><span style='color: #60a5fa;'>🧠 Routing to TradesPay AI Engine...</span>`;

        try {
            // POST text to our newly built backend server
            const response = await fetch('/api/ai/voice-to-invoice', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ transcript })
            });
            
            const data = await response.json();
            
            if(data.error) throw new Error(data.error);

            // Display Success & JSON
            statusLog.innerHTML = "<span style='color: #4ade80;'>✅ Invoice successfully generated via Groq/LLM!</span>";
            resultContainer.style.display = 'block';
            jsonOutput.innerText = JSON.stringify(data.invoice, null, 2);
            
        } catch (error) {
            console.error(error);
            statusLog.innerHTML = `<span style='color: #f87171;'>❌ AI Error: ${error.message}</span>`;
        }
    };

    recognition.onerror = (event) => {
        micBtn.innerText = "🎙️ Tap to Speak";
        micBtn.classList.remove('listening');
        statusLog.innerHTML = `<span style='color: #f87171;'>❌ Microphone Error: ${event.error}</span>`;
    };
}