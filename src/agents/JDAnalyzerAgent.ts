import { GoogleGenerativeAI } from "@google/generative-ai";
import type { ResumeProfile, ATSAnalysis } from '../types';

const API_KEY = import.meta.env.VITE_GOOGLE_API_KEY;
const genAI = new GoogleGenerativeAI(API_KEY);

export class JDAnalyzerAgent {
    private static SYSTEM_PROMPT = `
You are an expert ATS (Applicant Tracking System) Auditor and Tech Recruiter.
Your goal is to compare a CANDIDATE RESUME against a TARGET JOB DESCRIPTION (JD).

OUTPUT JSON ONLY. Strict Schema:
{
  "ats_score": number, // 0-100
  "skill_match_percentage": number, // 0-100
  "missing_required_skills": string[],
  "missing_preferred_skills": string[],
  "matched_keywords": string[], // Keywords found in both
  "unmatched_keywords": string[], // Important keywords from JD missing in Resume
  "section_wise_feedback": {
      "summary": string, // Actionable advice
      "skills": string,
      "experience": string,
      "projects": string
  },
  "overall_feedback": string // 2-3 sentences summary
}

SCORING CRITERIA:
- 90-100: Perfect match. Contains almost all keywords and requirements.
- 75-89: Good match. Minor gaps.
- 60-74: Decent. Needs optimization.
- <60: Poor match. Critical skills missing.

BE STRICT. If a mandatory skill (e.g. "React", "Python") is in JD but missing in Resume, penalize heavily.
`;

    static async analyze(resume: ResumeProfile, jdText: string): Promise<ATSAnalysis> {
        if (!jdText || jdText.trim().length < 50) {
            // Return dummy/neutral analysis if JD is too short
            return this.getEmptyAnalysis();
        }

        try {
            const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

            const prompt = `
            ${this.SYSTEM_PROMPT}

            TARGET JOB DESCRIPTION:
            """
            ${jdText}
            """

            CANDIDATE RESUME PROFILE (JSON):
            """
            ${JSON.stringify(resume)}
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

    private static parseResponse(text: string): ATSAnalysis {
        try {
            const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
            return JSON.parse(cleaned);
        } catch (e) {
            console.error("Failed to parse ATS JSON:", text);
            return this.getEmptyAnalysis();
        }
    }

    private static getEmptyAnalysis(): ATSAnalysis {
        return {
            ats_score: 0,
            skill_match_percentage: 0,
            missing_required_skills: [],
            missing_preferred_skills: [],
            matched_keywords: [],
            unmatched_keywords: [],
            section_wise_feedback: {
                summary: "No JD provided or analysis failed.",
                skills: "",
                experience: "",
                projects: ""
            },
            overall_feedback: "Pasting a Job Description allows me to score your resume."
        };
    }
}
