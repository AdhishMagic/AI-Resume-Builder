import { GoogleGenerativeAI } from '@google/generative-ai';
import type { ResumeProfile } from '../types';
import { getAiSettings, isAiConfigured } from '../utils/aiSettings';

export type AiProvider = 'gemini' | 'openai_compatible';
export type AiEditorMode = '1-page' | '2-page';

// Browser-side AI runtime (serverless)
// - Provider selection (Gemini or OpenAI-compatible)
// - Pacing + retry on 429
// - Resume edit contract enforcement

let aiQueue: Promise<unknown> = Promise.resolve();
let lastCallAtMs = 0;

const MIN_SPACING_MS = Number((import.meta as any).env?.VITE_AI_MIN_SPACING_MS || 1200);

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

async function enforceMinSpacing() {
  const now = Date.now();
  const elapsed = now - lastCallAtMs;
  const wait = MIN_SPACING_MS - elapsed;
  if (wait > 0) await sleep(wait);
}

function isRateLimitError(error: unknown): boolean {
  const anyErr = error as any;
  const status = anyErr?.status;
  const msg = anyErr?.message ? String(anyErr.message) : String(error);
  const m = msg.toLowerCase();
  return status === 429 || m.includes('429') || m.includes('too many') || m.includes('rate') || m.includes('quota');
}

function humanizeError(error: unknown): string {
  const anyErr = error as any;
  const status = anyErr?.status;
  const msg = anyErr?.message ? String(anyErr.message) : String(error);

  if (String(msg).toLowerCase().includes('reported as leaked') || String(msg).toLowerCase().includes('leaked')) {
    return 'API key was reported as leaked. Create a new key and try again.';
  }

  if (status === 429 || isRateLimitError(error)) {
    // Keep the string consistent with existing UI detection.
    return 'Rate limit hit. (HTTP 429)';
  }

  // Generic fallback
  return msg || 'AI request failed.';
}

export function extractFirstJsonObject(text: string): string {
  const s = String(text || '');

  const fenced = s.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced && fenced[1]) {
    const candidate = fenced[1].trim();
    if (candidate.startsWith('{') && candidate.endsWith('}')) return candidate;
  }

  const start = s.indexOf('{');
  if (start === -1) throw new Error('No JSON found in AI response');

  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];

    if (inString) {
      if (escape) {
        escape = false;
      } else if (ch === '\\') {
        escape = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }

    if (ch === '{') depth++;
    if (ch === '}') depth--;

    if (depth === 0) {
      const candidate = s.slice(start, i + 1);
      try {
        JSON.parse(candidate);
        return candidate;
      } catch {
        // keep scanning
      }
    }
  }

  const match = s.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('No JSON found in AI response');
  return match[0];
}

function buildEditorSystemPrompt(mode: AiEditorMode) {
  const isOne = mode === '1-page';
  return `You are a Resume Editing AI.

You MUST output ONLY valid JSON, no markdown.
You MUST NOT add new fields, remove fields, or rename fields in the resume JSON.
You MUST only edit existing text within the current schema.

STRICT LAYOUT CONTRACTS (do not violate):
- SUMMARY: single paragraph, max 4 lines, max 70pt; word limit ${isOne ? '40–55' : '45–65'}; never increase length beyond limit.
- EXPERIENCE: per role max bullets ${isOne ? '2' : '3'}; max 20 words per bullet; do not add new bullets; rewrite/shorten only.
- PROJECTS: max projects ${isOne ? '2' : '4'}; per project max 2 bullets; 18–22 words; single-line title.
- SKILLS: categorized only (max 4 categories); max 10 skills/category; max 4 lines total; each line <= 90 chars.
- EDUCATION: degrees only; no certificates; ${isOne ? 'only highest/latest degree' : 'up to 2 entries only if space allows'}.

EDITING RULES:
- Apply the user's command narrowly.
- If the command would break constraints, do the closest safe rewrite (shorten, compress). If still unsafe, make no change.

OUTPUT FORMAT (JSON ONLY):
{
  "updatedResume": <the full updated resume JSON with identical schema>,
  "explanation": "1-2 sentences describing what changed"
}
`;
}

function validateResumeShape(obj: any) {
  const required = [
    'personal',
    'headline',
    'summary',
    'skills',
    'experience',
    'projects',
    'education',
    'certifications',
    'achievements',
  ];

  for (const k of required) {
    if (!(k in obj)) throw new Error(`Resume missing required field: ${k}`);
  }

  if (!obj.personal || typeof obj.personal !== 'object') throw new Error('personal must be an object');
  for (const k of ['name', 'email', 'phone', 'location', 'linkedin', 'github']) {
    if (!(k in obj.personal)) throw new Error(`personal missing: ${k}`);
  }

  if (!obj.skills || typeof obj.skills !== 'object') throw new Error('skills must be an object');
  for (const k of ['programming_languages', 'frameworks', 'tools', 'databases', 'concepts']) {
    if (!Array.isArray(obj.skills[k])) throw new Error(`skills.${k} must be an array`);
  }

  if (!Array.isArray(obj.experience)) throw new Error('experience must be an array');
  if (!Array.isArray(obj.projects)) throw new Error('projects must be an array');
  if (!obj.education || typeof obj.education !== 'object') throw new Error('education must be an object');
  if (!Array.isArray(obj.certifications)) throw new Error('certifications must be an array');
  if (!Array.isArray(obj.achievements)) throw new Error('achievements must be an array');
}

function cleanBullet(text: string) {
  let t = String(text || '').replace(/\s+/g, ' ').trim();
  t = t.replace(/^\s*(key\s*features|features|highlights|tech\s*stack|stack|tools)\s*:\s*/i, '');
  return t;
}

function clampWords(text: string, maxWords: number) {
  const words = String(text || '')
    .trim()
    .split(/\s+/g)
    .filter(Boolean);
  if (words.length <= maxWords) return String(text || '').trim();
  return words.slice(0, maxWords).join(' ').replace(/[;,:-]?$/, '') + '.';
}

function enforceContracts(resume: ResumeProfile, mode: AiEditorMode): ResumeProfile {
  // structuredClone is supported in modern browsers; fall back to JSON clone if needed.
  const out: ResumeProfile = typeof structuredClone === 'function'
    ? structuredClone(resume)
    : (JSON.parse(JSON.stringify(resume)) as ResumeProfile);

  const isOne = mode === '1-page';

  out.summary = clampWords(out.summary, isOne ? 55 : 65);

  const maxRoleBullets = isOne ? 2 : 3;
  out.experience = (out.experience || []).map((r) => {
    const role: any = typeof structuredClone === 'function' ? structuredClone(r) : JSON.parse(JSON.stringify(r));
    const bullets = Array.isArray(role.achievements) ? role.achievements.map(String) : [];
    const trimmed = bullets
      .map((b: string) => clampWords(cleanBullet(b), 20))
      .filter(Boolean)
      .slice(0, maxRoleBullets);
    role.achievements = trimmed;
    role.role = String(role.role || '');
    role.company = String(role.company || '');
    role.duration = String(role.duration || '');
    role.location = String(role.location || '');
    return role;
  });

  const maxProjects = isOne ? 2 : 4;
  out.projects = (out.projects || [])
    .map((p) => {
      const proj: any = typeof structuredClone === 'function' ? structuredClone(p) : JSON.parse(JSON.stringify(p));
      proj.name = String(proj.name || '');
      proj.description = String(proj.description || '');
      proj.impact = String(proj.impact || '');
      proj.tech_stack = Array.isArray(proj.tech_stack) ? proj.tech_stack.map(String) : [];
      return proj;
    })
    .slice(0, maxProjects);

  if ((out as any).skills && typeof (out as any).skills === 'object') {
    const cap = isOne ? 8 : 10;
    for (const k of ['programming_languages', 'frameworks', 'tools', 'databases', 'concepts']) {
      (out as any).skills[k] = Array.isArray((out as any).skills[k])
        ? (out as any).skills[k].map(String).filter(Boolean).slice(0, cap)
        : [];
    }
  }

  out.education.degree = String(out.education.degree || '');
  out.education.institution = String(out.education.institution || '');
  out.education.year = String(out.education.year || '');
  out.education.cgpa = String(out.education.cgpa || '');

  return out;
}

async function runWithQueueAndRetry<T>(fn: () => Promise<T>): Promise<T> {
  const run = async () => {
    await enforceMinSpacing();

    const delays = [0, 1000, 2000, 4000];
    let lastErr: unknown;
    for (let i = 0; i < delays.length; i++) {
      if (delays[i] > 0) await sleep(delays[i]);
      try {
        const result = await fn();
        lastCallAtMs = Date.now();
        return result;
      } catch (e) {
        lastErr = e;
        if (!isRateLimitError(e)) break;
      }
    }

    throw lastErr;
  };

  aiQueue = aiQueue.then(run, run);
  return aiQueue as Promise<T>;
}

async function generateWithGemini({ apiKey, system, userPrompt }: { apiKey: string; system: string; userPrompt: string }) {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
  const prompt = `${system}\n\n${userPrompt}`;

  const text = await runWithQueueAndRetry(async () => {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  });

  return String(text || '');
}

async function generateWithOpenAICompatible({
  apiKey,
  baseUrl,
  model,
  system,
  userPrompt,
}: {
  apiKey: string;
  baseUrl?: string;
  model?: string;
  system: string;
  userPrompt: string;
}) {
  const urlBase = String(baseUrl || 'https://api.openai.com/v1').replace(/\/+$/, '');
  const url = `${urlBase}/chat/completions`;
  const m = String(model || '').trim();
  if (!m) throw new Error('Missing model for OpenAI-compatible provider. Provide ai_model.');

  return runWithQueueAndRetry(async () => {
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: m,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.2,
      }),
    });

    const raw = await resp.text().catch(() => '');
    let data: any = null;
    try {
      data = raw ? JSON.parse(raw) : null;
    } catch {
      data = null;
    }

    if (!resp.ok) {
      const msg = data?.error?.message || raw || `OpenAI-compatible request failed (HTTP ${resp.status})`;
      const e: any = new Error(msg);
      e.status = resp.status;
      throw e;
    }

    const content = data?.choices?.[0]?.message?.content;
    if (!content) throw new Error('OpenAI-compatible response missing choices[0].message.content');
    return String(content);
  });
}

export async function aiGenerateText(input: { prompt: string }): Promise<string> {
  const settings = getAiSettings();
  if (!isAiConfigured(settings)) {
    throw new Error('AI API key is required. Paste your key on the home screen.');
  }

  const system = "You are a helpful AI assistant. Follow the user's instructions exactly.";

  try {
    if (settings.provider === 'openai_compatible') {
      return await generateWithOpenAICompatible({
        apiKey: settings.apiKey,
        baseUrl: settings.baseUrl,
        model: settings.model,
        system,
        userPrompt: input.prompt,
      });
    }

    return await generateWithGemini({ apiKey: settings.apiKey, system, userPrompt: input.prompt });
  } catch (e) {
    throw new Error(humanizeError(e));
  }
}

export async function aiEditResume(input: { command: string; resume: ResumeProfile; mode: AiEditorMode }): Promise<{ updatedResume: ResumeProfile; explanation: string }> {
  const settings = getAiSettings();
  if (!isAiConfigured(settings)) {
    throw new Error('AI API key is required. Go back to home and paste your API key to continue.');
  }

  validateResumeShape(input.resume);

  const system = buildEditorSystemPrompt(input.mode);
  const userPrompt = `CURRENT_RESUME_JSON:\n${JSON.stringify(input.resume, null, 2)}\n\nUSER_COMMAND:\n${JSON.stringify(
    input.command
  )}\n\nOUTPUT_JSON_ONLY.`;

  try {
    const text = settings.provider === 'openai_compatible'
      ? await generateWithOpenAICompatible({
        apiKey: settings.apiKey,
        baseUrl: settings.baseUrl,
        model: settings.model,
        system,
        userPrompt,
      })
      : await generateWithGemini({ apiKey: settings.apiKey, system, userPrompt });

    const jsonText = extractFirstJsonObject(text);
    const parsed = JSON.parse(jsonText);

    const updatedResume = parsed?.updatedResume;
    const explanation = typeof parsed?.explanation === 'string' ? parsed.explanation : 'Updated resume.';

    if (!updatedResume || typeof updatedResume !== 'object') {
      throw new Error('AI response missing updatedResume');
    }

    validateResumeShape(updatedResume);

    const enforced = enforceContracts(updatedResume as ResumeProfile, input.mode);
    validateResumeShape(enforced);

    return { updatedResume: enforced, explanation };
  } catch (e) {
    throw new Error(humanizeError(e));
  }
}
