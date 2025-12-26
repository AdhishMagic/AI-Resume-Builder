import type { ResumeProfile } from '../types';
import { GoogleGenerativeAI } from "@google/generative-ai";

// Initialize Gemini
const API_KEY = import.meta.env.VITE_GOOGLE_API_KEY;
const genAI = new GoogleGenerativeAI(API_KEY);

export class ResumeEditAgent {
  private static SYSTEM_PROMPT = `
You are ResumeEditAgent.

ROLE:
You EDIT existing resume DATA only.
You do NOT generate a new resume from scratch.
You do NOT change the resume structure.
You do NOT touch UI, styling, JSX, or code.

You operate ONLY on an existing Resume JSON.

ABSOLUTE RULES (NON-NEGOTIABLE):
1. Output ONLY valid JSON.
2. Do NOT include explanations, markdown, or text outside JSON.
3. Do NOT add new fields.
4. Do NOT remove existing fields.
5. Do NOT rename fields.
6. Modify ONLY the fields relevant to the user instruction.
7. Preserve all unchanged fields EXACTLY as they are.
8. Do NOT hallucinate experience, metrics, or tools.
9. Do NOT exaggerate impact or achievements.
10. If unsure, make NO change to that field.
11. Your output is parsed directly by a React app — invalid output will crash it.
12. If rules cannot be followed perfectly, return ONLY: {}

INPUT FORMAT:
You will receive:
1. The current Resume JSON (already following the locked schema)
2. A user instruction describing what to change

LOCKED RESUME JSON SCHEMA (DO NOT MODIFY):
(Schema implied from input context)

EDITING GUIDELINES:
- Apply the user instruction narrowly and conservatively.
- Prefer rewriting text over adding new content.
- Do NOT invent new skills, companies, roles, or projects.
- If instruction conflicts with existing data, keep original data.
- For wording changes, keep sentences concise and IT-professional.
- Do NOT exceed fresher / intern scope.

OUTPUT FORMAT:
Return ONLY the updated Resume JSON.
No explanations.
No comments.
No markdown.

FAILSAFE:
If the instruction cannot be applied safely, return ONLY: {}
`;

  public static getSystemPrompt(): string {
    return this.SYSTEM_PROMPT;
  }

  public static async edit(currentResume: ResumeProfile, instruction: string): Promise<ResumeProfile> {
    console.log("Editing resume with instruction:", instruction);
    const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

    const generateWithRetry = async (prompt: string, retries = 3, delay = 2000): Promise<string> => {
      for (let i = 0; i < retries; i++) {
        try {
          const result = await model.generateContent(prompt);
          const response = await result.response;
          return response.text();
        } catch (error: any) {
          const isQuotaError = error.message?.includes('429') || error.status === 429;
          if (isQuotaError && i < retries - 1) {
            console.warn(`Quota hit (429). Retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            delay *= 2;
            continue;
          }
          throw error;
        }
      }
      throw new Error("Max retries exceeded");
    };

    try {
      const prompt = `
${ResumeEditAgent.SYSTEM_PROMPT}

CURRENT RESUME JSON:
${JSON.stringify(currentResume, null, 2)}

USER INSTRUCTION:
"${instruction}"

Recall: Output ONLY the updated JSON.
`;

      const text = await generateWithRetry(prompt);
      console.log("Gemini Edit Response:", text);

      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON found in response");
      }

      const parsedProfile = JSON.parse(jsonMatch[0]) as ResumeProfile;

      // VALIDATION: Check if the AI returned an empty object (failsafe)
      // or if it's missing critical fields (like 'personal')
      if (!parsedProfile || Object.keys(parsedProfile).length === 0 || !parsedProfile.personal) {
        console.warn("Gemini returned invalid or empty JSON. Reverting to original.");
        return currentResume;
      }

      return parsedProfile;

    } catch (error) {
      console.error("Gemini Edit Failed:", error);
      // Return original if editing fails
      return currentResume;
    }
  }
}
