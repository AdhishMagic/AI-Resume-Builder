import type { CanonicalResume, ResumeProfile } from '../types';
import { createGenAI, getHumanGeminiErrorMessage, MissingGeminiApiKeyError } from './geminiClient';
import { canonicalToResumeProfile, createCanonicalResumeBase } from '../utils/canonicalResume';

const extractFirstMatch = (text: string, regex: RegExp) => {
  const match = text.match(regex);
  return match?.[1]?.trim() || '';
};

const uniq = (items: string[]) => Array.from(new Set(items)).filter(Boolean);

const guessHeadline = (text: string) => {
  const t = text.toLowerCase();
  if (t.includes('full stack')) return 'Full Stack Developer';
  if (t.includes('frontend') || t.includes('front-end')) return 'Frontend Developer';
  if (t.includes('backend') || t.includes('back-end')) return 'Backend Developer';
  if (t.includes('data scientist')) return 'Data Scientist';
  if (t.includes('data analyst')) return 'Data Analyst';
  if (t.includes('devops')) return 'DevOps Engineer';
  if (t.includes('mobile') || t.includes('android') || t.includes('ios')) return 'Mobile Developer';
  return 'Software Engineer';
};

const extractSkills = (text: string) => {
  const t = text.toLowerCase();

  const has = (re: RegExp) => re.test(t);

  const languages: string[] = [];
  if (has(/\btypescript\b/)) languages.push('TypeScript');
  if (has(/\bjavascript\b|\bjs\b/)) languages.push('JavaScript');
  if (has(/\bpython\b/)) languages.push('Python');
  if (has(/\bjava\b/)) languages.push('Java');
  if (has(/\bc\+\+\b|\bcpp\b/)) languages.push('C++');
  if (has(/\bc#\b|\bcsharp\b/)) languages.push('C#');
  if (has(/\bgolang\b|\bgo\b/)) languages.push('Go');
  if (has(/\brust\b/)) languages.push('Rust');
  if (has(/\bphp\b/)) languages.push('PHP');

  const frameworks: string[] = [];
  if (has(/\breact\b/)) frameworks.push('React');
  if (has(/\bnext\.js\b|\bnextjs\b/)) frameworks.push('Next.js');
  if (has(/\bvue\b/)) frameworks.push('Vue');
  if (has(/\bangular\b/)) frameworks.push('Angular');
  if (has(/\bnode\.js\b|\bnodejs\b/)) frameworks.push('Node.js');
  if (has(/\bexpress\b/)) frameworks.push('Express');
  if (has(/\bdjango\b/)) frameworks.push('Django');
  if (has(/\bflask\b/)) frameworks.push('Flask');
  if (has(/\bspring\b|\bspring boot\b/)) frameworks.push('Spring Boot');

  const tools: string[] = [];
  if (has(/\bgit\b/)) tools.push('Git');
  if (has(/\bdocker\b/)) tools.push('Docker');
  if (has(/\bkubernetes\b|\bk8s\b/)) tools.push('Kubernetes');
  if (has(/\baws\b|amazon web services/)) tools.push('AWS');
  if (has(/\bazure\b/)) tools.push('Azure');
  if (has(/\bgcp\b|google cloud/)) tools.push('GCP');
  if (has(/\bterraform\b/)) tools.push('Terraform');

  const databases: string[] = [];
  if (has(/\bpostgres\b|\bpostgresql\b/)) databases.push('PostgreSQL');
  if (has(/\bmysql\b/)) databases.push('MySQL');
  if (has(/\bmongodb\b/)) databases.push('MongoDB');
  if (has(/\bredis\b/)) databases.push('Redis');
  if (has(/\bsql\b/)) databases.push('SQL');

  const concepts: string[] = [];
  if (has(/\brest\b|\brestful\b/)) concepts.push('REST APIs');
  if (has(/\bgraphql\b/)) concepts.push('GraphQL');
  if (has(/\bci\/cd\b|\bcontinuous integration\b/)) concepts.push('CI/CD');
  if (has(/\bunit test\b|\btesting\b|\bjest\b/)) concepts.push('Testing');
  if (has(/\bperformance\b/)) concepts.push('Performance Optimization');

  return {
    programming_languages: uniq(languages),
    frameworks: uniq(frameworks),
    tools: uniq(tools),
    databases: uniq(databases),
    concepts: uniq(concepts),
  };
};

const buildLocalFallbackCanonical = (payload: { description?: string; jd?: string; pageCount?: number }): CanonicalResume => {
  const description = (payload.description || '').trim();
  const text = `${description}\n\n${payload.jd || ''}`.trim();

  const email = extractFirstMatch(text, /([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i);
  const phone = extractFirstMatch(text, /(\+?\d[\d\s().-]{8,}\d)/);
  const linkedin = extractFirstMatch(text, /(https?:\/\/(?:www\.)?linkedin\.com\/[^\s]+)/i);
  const github = extractFirstMatch(text, /(https?:\/\/(?:www\.)?github\.com\/[^\s]+)/i);
  const headline = guessHeadline(text);
  const skills = extractSkills(text);

  const canonical = createCanonicalResumeBase();
  canonical.basics.full_name = 'Your Name';
  canonical.basics.headline = headline;
  canonical.basics.email = email || '';
  canonical.basics.phone = phone || '';
  canonical.basics.linkedin = linkedin || '';
  canonical.basics.github = github || '';

  canonical.professional_summary.text = [
    'Resume generated locally (Gemini disabled).',
    'Add a valid Gemini key to enable AI generation.',
    description ? `Profile: ${headline}.` : '',
  ].filter(Boolean).join(' ');

  canonical.skills.programming_languages = skills.programming_languages;
  canonical.skills.frameworks_libraries = skills.frameworks;
  canonical.skills.tools_platforms = skills.tools;
  canonical.skills.databases = skills.databases;
  canonical.skills.core_concepts = skills.concepts;

  return canonical;
};

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

CORE JSON SCHEMA (MUST MATCH EXACTLY):
{
  "basics": {
    "full_name": "",
    "headline": "",
    "email": "",
    "phone": "",
    "location": "",
    "linkedin": "",
    "github": "",
    "portfolio": ""
  },
  "professional_summary": { "text": "" },
  "skills": {
    "programming_languages": [],
    "frameworks_libraries": [],
    "tools_platforms": [],
    "databases": [],
    "core_concepts": []
  },
  "experience": [
    {
      "company": "",
      "role": "",
      "employment_type": "",
      "location": "",
      "start_date": "",
      "end_date": "",
      "responsibilities": [""],
      "achievements": [""],
      "technologies_used": []
    }
  ],
  "projects": [
    {
      "project_name": "",
      "role": "",
      "description": "",
      "key_features": [""],
      "impact": "",
      "technologies_used": [],
      "links": { "github": "", "demo": "" }
    }
  ],
  "education": [
    {
      "degree": "",
      "field_of_study": "",
      "institution": "",
      "location": "",
      "start_year": "",
      "end_year": "",
      "cgpa": ""
    }
  ],
  "certifications": [ { "name": "", "issuer": "", "year": "" } ],
  "achievements": [""],
  "open_source_contributions": [ { "project_name": "", "contribution": "", "link": "" } ],
  "additional_information": {
    "languages": [],
    "availability": "",
    "work_authorization": ""
  }
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

    let model: ReturnType<ReturnType<typeof createGenAI>['getGenerativeModel']> | null = null;
    try {
      model = createGenAI().getGenerativeModel({ model: "gemini-flash-latest" });
    } catch (error) {
      if (error instanceof MissingGeminiApiKeyError) {
        const canonical = buildLocalFallbackCanonical({ description: payload.description, jd: payload.jd, pageCount: payload.pageCount });
        return canonicalToResumeProfile(canonical);
      }
      throw error;
    }

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

      const canonical = JSON.parse(jsonMatch[0]) as CanonicalResume;
      return canonicalToResumeProfile(canonical);

    } catch (error) {
      console.error("Gemini Generation Failed:", error);
      const friendly = getHumanGeminiErrorMessage(error);
      // Fallback to Mock if API fails
      return {
        personal: { name: "Error Generating", email: "check@api.key", phone: "500-ERROR", location: "Server", linkedin: "", github: "" },
        headline: "Generation Failed",
        summary: friendly,
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
