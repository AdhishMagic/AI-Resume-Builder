
import fs from 'fs';

const API_KEY = "AIzaSyAZjm3NlL7eFRkGMw7Fo8gL-PhAESyqx60";

async function listModels() {
    try {
        console.log("Fetching models...");
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
            console.log("SUCCESS: Wrote models to models_clean.txt");
        } else {
            console.error("No models found. Response:", JSON.stringify(data, null, 2));
        }

    } catch (error) {
        console.error("Error listing models:", error);
    }
}

listModels();
