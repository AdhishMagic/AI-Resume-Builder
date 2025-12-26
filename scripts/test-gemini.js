
const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require('fs');

const API_KEY = "AIzaSyAZjm3NlL7eFRkGMw7Fo8gL-PhAESyqx60";

async function listModels() {
    try {
        console.log("Fetching models with key ending in...", API_KEY.slice(-4));

        // Fetch via REST to inspect available models directly
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`);
        const data = await response.json();

        if (data.models) {
            let output = "AVAILABLE MODELS:\n";
            data.models.forEach(m => {
                if (m.supportedGenerationMethods && m.supportedGenerationMethods.includes("generateContent")) {
                    output += `- ${m.name} (Supported)\n`;
                } else {
                    output += `- ${m.name} (Not for generateContent)\n`;
                }
            });
            fs.writeFileSync('models_clean.txt', output, 'utf8');
            console.log("Wrote models to models_clean.txt");
        } else {
            console.error("No models found. Response:", JSON.stringify(data, null, 2));
        }

    } catch (error) {
        console.error("Error listing models:", error);
    }
}

listModels();
