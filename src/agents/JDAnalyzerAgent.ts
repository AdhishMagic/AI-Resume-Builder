import type { JDAnalysis } from '../types';
import { createGenAI, MissingGeminiApiKeyError } from './geminiClient';

export class JDAnalyzerAgent {
    private static SYSTEM_PROMPT = `
You are JDAnalyzerAgent.

ROLE:
Extract a structured, ATS-friendly analysis from a TARGET JOB DESCRIPTION (JD).
Do NOT score a resume.
Do NOT rewrite the JD.

OUTPUT JSON ONLY. Strict Schema:
{
  "role_title": string,
  "required_skills": string[],
  "preferred_skills": string[],
  "tools_and_technologies": string[],
  "responsibilities": string[],
  "keywords": string[],
  "experience_level": string
}

GUIDELINES:
- Keep items concise and deduplicated.
- Prefer exact terms from the JD.
- If the JD is ambiguous, infer conservatively.
- Always return valid JSON.
`;

    static async analyze(jdText: string): Promise<JDAnalysis> {
        if (!jdText || jdText.trim().length < 50) {
            // Return dummy/neutral analysis if JD is too short
            return this.getEmptyAnalysis();
        }

        try {
            let model: ReturnType<ReturnType<typeof createGenAI>['getGenerativeModel']> | null = null;
            try {
                model = createGenAI().getGenerativeModel({ model: "gemini-1.5-flash" });
            } catch (error) {
                if (error instanceof MissingGeminiApiKeyError) {
                    return this.getEmptyAnalysis();
                }
                throw error;
            }

            const prompt = `
            ${this.SYSTEM_PROMPT}

            TARGET JOB DESCRIPTION:
            """
            ${jdText}
            """
            `;

            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();

            return this.parseResponse(text);
        } catch (error) {
            console.error("JD Analysis Failed:", error);
            // Fallback to empty to prevent crash
            return this.getEmptyAnalysis();
        }
    }

    private static parseResponse(text: string): JDAnalysis {
        try {
            const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
            return JSON.parse(cleaned);
        } catch (e) {
            console.error("Failed to parse JDAnalysis JSON:", text);
            return this.getEmptyAnalysis();
        }
    }

    private static getEmptyAnalysis(): JDAnalysis {
        return {
            role_title: "",
            required_skills: [],
            preferred_skills: [],
            tools_and_technologies: [],
            responsibilities: [],
            keywords: [],
            experience_level: ""
        };
    }
}
