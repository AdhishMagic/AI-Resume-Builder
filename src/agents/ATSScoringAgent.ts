import type { ResumeProfile, JDAnalysis, ATSAnalysis } from '../types';

export class ATSScoringAgent {
    private static SYSTEM_PROMPT = `
You are ATSScoringAgent.

ROLE:
You SIMULATE an Applicant Tracking System (ATS).
You ONLY ANALYZE and SCORE.
You do NOT modify resume data.
You do NOT modify job description data.
You do NOT touch UI, styling, JSX, or code.

You operate ONLY in PHASE-4 and above.

ABSOLUTE RULES (NON-NEGOTIABLE):
1. Output ONLY valid JSON.
2. Do NOT include explanations, markdown, or text outside JSON.
3. Do NOT modify or return the resume JSON.
4. Do NOT modify or return the JD analysis JSON.
5. Do NOT invent skills, experience, or requirements.
6. Base scoring ONLY on overlap and structure.
7. Keep all values deterministic and reasonable.
8. If analysis cannot be performed safely, return ONLY: {}

INPUT FORMAT:
You will receive:
1. Resume JSON (locked schema)
2. Job Description Analysis JSON

OUTPUT FORMAT:
Return ONLY a JSON object following the schema below.

LOCKED OUTPUT SCHEMA (DO NOT MODIFY):

{
  "ats_score": 0,
  "skill_match_percentage": 0,
  "missing_required_skills": [],
  "missing_preferred_skills": [],
  "matched_keywords": [],
  "unmatched_keywords": [],
  "section_wise_feedback": {
    "summary": "",
    "skills": "",
    "experience": "",
    "projects": ""
  },
  "overall_feedback": ""
}

SCORING GUIDELINES:
- ATS score range: 0–100
- Skill match percentage: 0–100
- Required skills have higher weight than preferred skills
- Penalize missing required skills
- Reward clear skill categorization
- Do NOT penalize for lack of seniority
- Fresher/intern resumes should not be harshly scored

FEEDBACK GUIDELINES:
- Feedback must be factual and actionable
- Do NOT suggest adding skills not present in JD
- Do NOT suggest lying or exaggeration
- Keep feedback concise and professional

FORBIDDEN ACTIONS:
- Resume rewriting
- JD rewriting
- ATS optimization suggestions
- Any data mutation
- Any UI or formatting advice

FAILSAFE:
If inputs are empty, invalid, or rules cannot be followed exactly, return ONLY: {}
`;

    public static getSystemPrompt(): string {
        return this.SYSTEM_PROMPT;
    }

    public static async score(resume: ResumeProfile, jdAnalysis: JDAnalysis): Promise<ATSAnalysis> {
        const required = uniq(jdAnalysis.required_skills || []);
        const preferred = uniq(jdAnalysis.preferred_skills || []);
        const keywords = uniq(jdAnalysis.keywords || []);

        const resumeSkills = uniq([
            ...(resume.skills?.programming_languages || []),
            ...(resume.skills?.frameworks || []),
            ...(resume.skills?.tools || []),
            ...(resume.skills?.databases || []),
            ...(resume.skills?.concepts || []),
            ...(resume.projects || []).flatMap(p => [...(p.tech_stack || [])]),
        ]);

        const resumeText = normalize([
            resume.headline,
            resume.summary,
            ...(resumeSkills || []),
            ...(resume.experience || []).flatMap(e => [e.company, e.role, e.location, ...(e.achievements || [])]),
            ...(resume.projects || []).flatMap(p => [p.name, p.description, p.impact, ...(p.tech_stack || [])]),
        ].filter(Boolean).join("\n"));

        const matchedRequired = required.filter(s => matchToken(resumeSkills, resumeText, s));
        const matchedPreferred = preferred.filter(s => matchToken(resumeSkills, resumeText, s));

        const missingRequired = required.filter(s => !matchToken(resumeSkills, resumeText, s));
        const missingPreferred = preferred.filter(s => !matchToken(resumeSkills, resumeText, s));

        const matchedKeywords = keywords.filter(k => matchToken(resumeSkills, resumeText, k));
        const unmatchedKeywords = keywords.filter(k => !matchToken(resumeSkills, resumeText, k));

        const requiredWeight = required.length;
        const preferredWeight = preferred.length * 0.5;
        const denom = requiredWeight + preferredWeight;
        const skillMatch = denom > 0
            ? Math.round(((matchedRequired.length + matchedPreferred.length * 0.5) / denom) * 100)
            : 0;

        const keywordMatch = keywords.length > 0
            ? Math.round((matchedKeywords.length / keywords.length) * 100)
            : skillMatch;

        // Experience alignment: how many JD responsibilities have partial overlap with resume experience text.
        const resp = (jdAnalysis.responsibilities || []).slice(0, 12);
        const respHits = resp.filter(r => normalize(r).length >= 8 && resumeText.includes(normalize(r).slice(0, 16))).length;
        const respPct = resp.length ? Math.round((respHits / resp.length) * 100) : 0;
        const experienceAlignment = respPct >= 60 ? "High" : respPct >= 30 ? "Medium" : resp.length ? "Low" : "N/A";

        // ATS score: emphasize required skills, then keywords, then experience alignment.
        const atsScore = clampInt(Math.round(skillMatch * 0.65 + keywordMatch * 0.2 + respPct * 0.15), 0, 100);

        const summaryFeedback = resume.summary?.trim()
            ? "Summary present; keep it keyword-aligned and concise."
            : "Add a concise, keyword-aligned summary.";

        const skillsFeedback = required.length === 0
            ? "Add a JD to enable skill matching."
            : missingRequired.length === 0
                ? "All required skills found in your resume."
                : `Missing ${missingRequired.length} required skill(s); consider adding only if you truly have them.`;

        const experienceFeedback = `Experience alignment: ${experienceAlignment}.`;

        const projectsFeedback = (resume.projects || []).length
            ? "Projects detected; ensure they reflect the JD focus areas."
            : "Add 1–2 projects that map to JD responsibilities (if applicable).";

        const overall = required.length === 0 && keywords.length === 0
            ? "Waiting for JD to score ATS."
            : atsScore >= 85
                ? "Strong match. Minor keyword alignment may improve score."
                : atsScore >= 70
                    ? "Good match. Address missing required skills and keyword coverage."
                    : "Needs improvement. Focus on missing required skills and clearer alignment.";

        return {
            ats_score: atsScore,
            skill_match_percentage: clampInt(skillMatch, 0, 100),
            missing_required_skills: missingRequired.slice(0, 20),
            missing_preferred_skills: missingPreferred.slice(0, 20),
            matched_keywords: matchedKeywords.slice(0, 30),
            unmatched_keywords: unmatchedKeywords.slice(0, 30),
            section_wise_feedback: {
                summary: summaryFeedback,
                skills: skillsFeedback,
                experience: experienceFeedback,
                projects: projectsFeedback,
            },
            overall_feedback: overall,
        };
    }
}

function normalize(s: string): string {
    return String(s || "").toLowerCase().replace(/\s+/g, " ").trim();
}

function uniq(items: string[]): string[] {
    const out: string[] = [];
    const seen = new Set<string>();
    for (const it of items || []) {
        const n = normalize(it);
        if (!n) continue;
        if (seen.has(n)) continue;
        seen.add(n);
        out.push(String(it).trim());
    }
    return out;
}

function matchToken(resumeSkills: string[], resumeText: string, token: string): boolean {
    const t = normalize(token);
    if (!t) return false;
    // Exact skill list match
    if (resumeSkills.some(s => normalize(s) === t)) return true;
    // Substring match in the full resume text (word-boundary-ish)
    return (` ${resumeText} `).includes(` ${t} `) || resumeText.includes(t);
}

function clampInt(n: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, Number.isFinite(n) ? Math.trunc(n) : min));
}
