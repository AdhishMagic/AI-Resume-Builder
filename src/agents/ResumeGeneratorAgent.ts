import { GoogleGenerativeAI } from "@google/generative-ai";
import type { ResumeProfile } from '../types';

// Initialize Gemini
const API_KEY = import.meta.env.VITE_GOOGLE_API_KEY;
const genAI = new GoogleGenerativeAI(API_KEY);

export class ResumeGeneratorAgent {
  private static SYSTEM_PROMPT = `
You are the AI Personal Architect.
Your goal is to build a PREMIUM, ONE-PAGE IT RESUME based on the user's input.

INPUTS:
- You may receive a raw text description.
- You may receive file content (PDF/Text context).
- You may receive a Job Description (JD).

RULES:
1. OUTPUT JSON ONLY. No markdown, no "here is the JSON".
2. Follow the schema EXACTLY.
3. If data is missing (e.g. phone number), leave it empty or use a realistic placeholder ONLY if implied.
4. TONE: Professional, confident, "Silicon Valley" standard.
5. SKILLS: Group them logically (Languages, Frameworks, Tools).
6. EXPERIENCE: Use action verbs. Quantify impact if possible (but do not hallucinate specific numbers if not provided, just frame it professionally).
7. If the input is just a job title or very brief, GENERATE A REALISTIC "FRESHER/INTERN" PROFILE suitable for that role.
8. Do NOT use "Junior" in the title. Use "Software Engineer" or "Full Stack Developer".

JSON SCHEMA:
{
  "personal": {
    "name": "String",
    "email": "String",
    "phone": "String",
    "location": "String",
    "linkedin": "String",
    "github": "String"
  },
  "headline": "String",
  "summary": "String",
  "skills": {
    "programming_languages": ["String"],
    "frameworks": ["String"],
    "tools": ["String"],
    "databases": ["String"],
    "concepts": ["String"]
  },
  "experience": [
    {
      "company": "String",
      "role": "String",
      "duration": "String",
      "location": "String",
      "achievements": ["String"]
    }
  ],
  "projects": [
    {
      "name": "String",
      "tech_stack": ["String"],
      "description": "String",
      "impact": "String"
    }
  ],
  "education": {
    "degree": "String",
    "institution": "String",
    "year": "String",
    "cgpa": "String"
  },
  "certifications": ["String"],
  "achievements": ["String"]
}
`;

  private static async fileToGenerativePart(file: File): Promise<{ inlineData: { data: string; mimeType: string } }> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        // Remove the data URL prefix (e.g. "data:application/pdf;base64,")
        // Handle different potential formats
        const base64Data = base64String.split(',')[1];
        resolve({
          inlineData: {
            data: base64Data,
            mimeType: file.type
          }
        });
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  public static async generate(payload: { description?: string; file?: File | null; jd?: string; pageCount?: number }): Promise<ResumeProfile> {
    console.log("Generating with Gemini...", payload);
    // Using 'gemini-flash-latest' as confirmed robust by diagnostic scan
    const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

    const generateWithRetry = async (parts: any[], retries = 3, delay = 2000): Promise<string> => {
      for (let i = 0; i < retries; i++) {
        try {
          const result = await model.generateContent(parts);
          const response = await result.response;
          return response.text();
        } catch (error: any) {
          const isQuotaError = error.message?.includes('429') || error.status === 429;
          if (isQuotaError && i < retries - 1) {
            console.warn(`Quota hit (429). Retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            delay *= 2; // Exponential backoff
            continue;
          }
          throw error;
        }
      }
      throw new Error("Max retries exceeded");
    };

    try {
      let prompt = ResumeGeneratorAgent.SYSTEM_PROMPT + "\n\nUSER INPUT:\n";
      const parts: any[] = [];

      // 1. Prioritize File
      if (payload.file) {
        console.log("Processing File...");
        prompt += "Context: The user provided an existing resume file. Parse it and improve it.\n";
        const filePart = await this.fileToGenerativePart(payload.file);
        parts.push(filePart);
      }

      // 2. Add Text Description
      if (payload.description) {
        prompt += `Additional Context/Description: ${payload.description}\n`;
      }

      // 3. Add JD
      if (payload.jd) {
        prompt += `Target Job Description: ${payload.jd}\n(Align the resume keywords to this JD without lying.)\n`;
      }

      // 4. Page Count Constraint
      if (payload.pageCount) {
        prompt += `CONSTRAINT: The user specifically requested a ${payload.pageCount}-page resume. Adjust the depth/verbosity of content accordingly.`;
      }

      // 4. Default Fallback
      if (!payload.file && !payload.description) {
        prompt += "Context: No input provided. Generate a realistic 'Software Engineer (Fresher)' resume template.";
      }

      parts.push({ text: prompt });

      const text = await generateWithRetry(parts);
      console.log("Gemini Response:", text);

      // Extract JSON
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON found in response");
      }

      const profile = JSON.parse(jsonMatch[0]) as ResumeProfile;
      return profile;

    } catch (error) {
      console.error("Gemini Generation Failed:", error);
      // Fallback to Mock if API fails
      return {
        personal: { name: "Error Generating", email: "check@api.key", phone: "500-ERROR", location: "Server", linkedin: "", github: "" },
        headline: "Generation Failed",
        summary: "The AI is currently experiencing high high traffic (429). Please wait a moment and try again.",
        skills: { programming_languages: [], frameworks: [], tools: [], databases: [], concepts: [] },
        experience: [],
        projects: [],
        education: { degree: "", institution: "Error University", year: "2024", cgpa: "0.0" },
        certifications: [],
        achievements: []
      };
    }
  }
}
