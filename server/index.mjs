import express from "express";
import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

const PORT = Number(process.env.AI_EDITOR_PORT || 5174);

// Simple in-memory pacing to reduce external AI 429s during dev.
// - Serialize Gemini calls (single-flight)
// - Enforce minimum spacing between calls
let geminiQueue = Promise.resolve();
let lastGeminiCallAtMs = 0;
const MIN_GEMINI_SPACING_MS = Number(process.env.GEMINI_MIN_SPACING_MS || 1200);

const isEnabled = () => {
  const enabled = String(process.env.ENABLE_GEMINI ?? process.env.VITE_ENABLE_GEMINI ?? "")
    .trim()
    .toLowerCase();
  return enabled === "true";
};

const app = express();
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

// Generic text generation endpoint used by the frontend for provider-agnostic flows.
// Expects headers:
// - x-ai-provider: gemini | openai_compatible
// - x-ai-api-key: API key
// - x-ai-base-url (optional): OpenAI-compatible base URL
// - x-ai-model (required for openai_compatible): model id
app.post("/api/ai-generate", async (req, res) => {
  try {
    const body = req.body;
    if (!body || typeof body !== "object") {
      return res.status(400).json({ status: "error", message: "Invalid JSON body" });
    }

    const prompt = String(body.prompt || "");
    if (!prompt.trim()) {
      return res.status(400).json({ status: "error", message: "Missing prompt" });
    }

    const headerKey = String(req.get("x-ai-api-key") || req.get("x-gemini-api-key") || "").trim();
    const headerProvider = String(req.get("x-ai-provider") || "").trim().toLowerCase();
    const provider = headerProvider === "openai_compatible" ? "openai_compatible" : "gemini";
    const headerBaseUrl = String(req.get("x-ai-base-url") || "").trim();
    const headerModel = String(req.get("x-ai-model") || "").trim();

    if (!headerKey) {
      return res.status(401).json({ status: "error", message: "Missing API key. Paste your AI API key on the home screen." });
    }

    // Strict: only use user-provided key from request headers.
    const apiKey = headerKey;

    const system = "You are a helpful AI assistant. Follow the user's instructions exactly.";
    const text = await runProviderWithPacingAndRetry({
      provider,
      apiKey,
      baseUrl: headerBaseUrl,
      model: headerModel,
      system,
      userPrompt: prompt,
    });

    return res.json({ status: "success", text });
  } catch (err) {
    const message = getHumanErrorMessage(err);
    const status = getHttpStatusForErrorMessage(message);
    if (status === 429) res.set("Retry-After", "15");
    return res.status(status).json({ status: "error", message });
  }
});

app.post("/api/ai-editor", async (req, res) => {
  try {
    const body = req.body;
    if (!body || typeof body !== "object") {
      return res.status(400).json({ status: "error", message: "Invalid JSON body" });
    }

    const command = body.command;
    const resume = body.resume;
    const mode = body.mode;

    if (typeof command !== "string" || !command.trim()) {
      return res.status(400).json({ status: "error", message: "Missing command" });
    }

    if (!resume || typeof resume !== "object") {
      return res.status(400).json({ status: "error", message: "Missing resume JSON" });
    }

    if (mode !== "1-page" && mode !== "2-page") {
      return res.status(400).json({ status: "error", message: "mode must be '1-page' or '2-page'" });
    }

    const headerKey = String(req.get("x-ai-api-key") || req.get("x-gemini-api-key") || "").trim();
    const headerProvider = String(req.get("x-ai-provider") || "").trim().toLowerCase();
    const provider = headerProvider === "openai_compatible" ? "openai_compatible" : "gemini";
    const headerBaseUrl = String(req.get("x-ai-base-url") || "").trim();
    const headerModel = String(req.get("x-ai-model") || "").trim();

    if (!headerKey) {
      return res.status(401).json({
        status: "error",
        message: "Missing API key. Paste your AI API key on the home screen.",
      });
    }

    // If the user provided a key, treat this request as enabled.
    if (!isEnabled()) {
      return res.status(503).json({
        status: "error",
        message: "AI Editor is disabled. Set ENABLE_GEMINI=true then try again.",
      });
    }

    // Strict: only use user-provided key from request headers.
    const apiKey = headerKey;

    validateResumeShape(resume);

    const system = buildSystemPrompt(mode);

    const userPrompt = `CURRENT_RESUME_JSON:\n${JSON.stringify(resume, null, 2)}\n\nUSER_COMMAND:\n${JSON.stringify(command)}\n\nOUTPUT_JSON_ONLY.`;

    const text = await runProviderWithPacingAndRetry({
      provider,
      apiKey,
      baseUrl: headerBaseUrl,
      model: headerModel,
      system,
      userPrompt,
    });

    const jsonText = extractFirstJsonObject(text);
    const parsed = JSON.parse(jsonText);

    if (!parsed || typeof parsed !== "object") {
      throw new Error("AI returned invalid JSON");
    }

    const updatedResume = parsed.updatedResume;
    const explanation = typeof parsed.explanation === "string" ? parsed.explanation : "Updated resume.";

    if (!updatedResume || typeof updatedResume !== "object") {
      throw new Error("AI response missing updatedResume");
    }

    validateResumeShape(updatedResume);

    // Server-side contract enforcement (lightweight): clamp obvious violations deterministically.
    const enforced = enforceContracts(updatedResume, mode);
    validateResumeShape(enforced);

    return res.json({ status: "success", updatedResume: enforced, explanation });
  } catch (err) {
    const message = getHumanErrorMessage(err);
    const status = getHttpStatusForErrorMessage(message);
    if (status === 429) {
      // Provide a standard signal to clients/browsers.
      res.set("Retry-After", "15");
    }
    return res.status(status).json({ status: "error", message });
  }
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`AI Editor API listening on http://localhost:${PORT}`);
});

function buildSystemPrompt(mode) {
  const isOne = mode === "1-page";

  return `You are a Resume Editing AI.

You MUST output ONLY valid JSON, no markdown.
You MUST NOT add new fields, remove fields, or rename fields in the resume JSON.
You MUST only edit existing text within the current schema.

STRICT LAYOUT CONTRACTS (do not violate):
- SUMMARY: single paragraph, max 4 lines, max 70pt; word limit ${isOne ? "40–55" : "45–65"}; never increase length beyond limit.
- EXPERIENCE: per role max bullets ${isOne ? "2" : "3"}; max 20 words per bullet; do not add new bullets; rewrite/shorten only.
- PROJECTS: max projects ${isOne ? "2" : "4"}; per project max 2 bullets; 18–22 words; single-line title.
- SKILLS: categorized only (max 4 categories); max 10 skills/category; max 4 lines total; each line <= 90 chars.
- EDUCATION: degrees only; no certificates; ${isOne ? "only highest/latest degree" : "up to 2 entries only if space allows"}.

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

function extractFirstJsonObject(text) {
  const s = String(text || "");

  // Prefer fenced JSON blocks if present.
  const fenced = s.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced && fenced[1]) {
    const candidate = fenced[1].trim();
    if (candidate.startsWith("{") && candidate.endsWith("}")) return candidate;
  }

  // Scan for the first balanced JSON object and return the first parseable candidate.
  // This is more reliable than a greedy regex when the model emits extra braces.
  const start = s.indexOf("{");
  if (start === -1) throw new Error("No JSON found in AI response");

  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];

    if (inString) {
      if (escape) {
        escape = false;
      } else if (ch === "\\") {
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

    if (ch === "{") depth++;
    if (ch === "}") depth--;

    if (depth === 0) {
      const candidate = s.slice(start, i + 1);
      try {
        JSON.parse(candidate);
        return candidate;
      } catch {
        // keep scanning; there might be a later valid object
      }
    }
  }

  // Last resort: greedy match.
  const match = s.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("No JSON found in AI response");
  return match[0];
}

function validateResumeShape(obj) {
  // Minimal schema validation: required top-level keys
  const required = [
    "personal",
    "headline",
    "summary",
    "skills",
    "experience",
    "projects",
    "education",
    "certifications",
    "achievements",
  ];

  for (const k of required) {
    if (!(k in obj)) throw new Error(`Resume missing required field: ${k}`);
  }

  if (!obj.personal || typeof obj.personal !== "object") throw new Error("personal must be an object");
  for (const k of ["name", "email", "phone", "location", "linkedin", "github"]) {
    if (!(k in obj.personal)) throw new Error(`personal missing: ${k}`);
  }

  if (!obj.skills || typeof obj.skills !== "object") throw new Error("skills must be an object");
  for (const k of ["programming_languages", "frameworks", "tools", "databases", "concepts"]) {
    if (!Array.isArray(obj.skills[k])) throw new Error(`skills.${k} must be an array`);
  }

  if (!Array.isArray(obj.experience)) throw new Error("experience must be an array");
  if (!Array.isArray(obj.projects)) throw new Error("projects must be an array");
  if (!obj.education || typeof obj.education !== "object") throw new Error("education must be an object");
  if (!Array.isArray(obj.certifications)) throw new Error("certifications must be an array");
  if (!Array.isArray(obj.achievements)) throw new Error("achievements must be an array");
}

function enforceContracts(resume, mode) {
  const out = structuredClone(resume);
  const isOne = mode === "1-page";

  // SUMMARY: clamp word count
  out.summary = clampWords(out.summary, isOne ? 55 : 65);

  // EXPERIENCE: clamp bullets per role and words per bullet
  const maxRoleBullets = isOne ? 2 : 3;
  out.experience = (out.experience || []).map((r) => {
    const role = structuredClone(r);
    const bullets = Array.isArray(role.achievements) ? role.achievements.map(String) : [];
    const trimmed = bullets
      .map((b) => clampWords(cleanBullet(b), 20))
      .filter(Boolean)
      .slice(0, maxRoleBullets);
    role.achievements = trimmed;
    role.role = String(role.role || "");
    role.company = String(role.company || "");
    role.duration = String(role.duration || "");
    role.location = String(role.location || "");
    return role;
  });

  // PROJECTS: clamp count and bullets
  const maxProjects = isOne ? 2 : 4;
  out.projects = (out.projects || []).map((p) => {
    const proj = structuredClone(p);
    proj.name = String(proj.name || "");
    proj.description = String(proj.description || "");
    proj.impact = String(proj.impact || "");
    proj.tech_stack = Array.isArray(proj.tech_stack) ? proj.tech_stack.map(String) : [];
    return proj;
  }).slice(0, maxProjects);

  // SKILLS: max 10 per category (server-side enforcement for existing schema)
  if (out.skills && typeof out.skills === "object") {
    const cap = isOne ? 8 : 10;
    for (const k of ["programming_languages", "frameworks", "tools", "databases", "concepts"]) {
      out.skills[k] = Array.isArray(out.skills[k]) ? out.skills[k].map(String).filter(Boolean).slice(0, cap) : [];
    }
  }

  // EDUCATION: degrees only (server cannot add extra entries in this schema)
  out.education.degree = String(out.education.degree || "");
  out.education.institution = String(out.education.institution || "");
  out.education.year = String(out.education.year || "");
  out.education.cgpa = String(out.education.cgpa || "");

  return out;
}

function cleanBullet(text) {
  let t = String(text || "").replace(/\s+/g, " ").trim();
  t = t.replace(/^\s*(key\s*features|features|highlights|tech\s*stack|stack|tools)\s*:\s*/i, "");
  return t;
}

function clampWords(text, maxWords) {
  const words = String(text || "").trim().split(/\s+/g).filter(Boolean);
  if (words.length <= maxWords) return String(text || "").trim();
  return words.slice(0, maxWords).join(" ").replace(/[;,:-]?$/, "") + ".";
}

function getHumanErrorMessage(error) {
  const msg = (error && error.message) ? String(error.message) : String(error);
  if (msg.includes("reported as leaked") || msg.toLowerCase().includes("leaked")) {
    return "Gemini rejected the API key because it was reported as leaked. Create a new key and set GOOGLE_API_KEY (server), then restart the API server.";
  }
  if (msg.includes("429") || msg.toLowerCase().includes("quota")) {
    return "Gemini quota/rate limit hit. Wait a bit and try again.";
  }
  if (msg.includes("Missing server API key")) return msg;
  return msg || "AI Editor request failed.";
}

function getHttpStatusForErrorMessage(message) {
  const m = String(message || "").toLowerCase();
  if (m.includes("quota") || m.includes("rate limit") || m.includes("429")) return 429;
  if (m.includes("disabled") || m.includes("missing server api key") || m.includes("leaked")) return 503;
  if (
    m.includes("invalid json") ||
    m.includes("missing command") ||
    m.includes("missing resume") ||
    m.includes("mode must be") ||
    m.includes("resume missing required field") ||
    m.includes("must be an array") ||
    m.includes("must be an object") ||
    m.includes("no json found") ||
    m.includes("unexpected token")
  ) return 400;
  return 500;
}

async function runGeminiWithPacingAndRetry(fn) {
  // Ensure calls are serialized to avoid bursty dev traffic.
  const run = async () => {
    await enforceMinSpacing();

    // Exponential backoff on rate-limit.
    const delays = [0, 1000, 2000, 4000];
    let lastErr;
    for (let i = 0; i < delays.length; i++) {
      if (delays[i] > 0) await sleep(delays[i]);
      try {
        const result = await fn();
        lastGeminiCallAtMs = Date.now();
        return result;
      } catch (e) {
        lastErr = e;
        if (!isRateLimitError(e)) break;
      }
    }
    throw lastErr;
  };

  geminiQueue = geminiQueue.then(run, run);
  return geminiQueue;
}

async function runProviderWithPacingAndRetry({ provider, apiKey, baseUrl, model, system, userPrompt }) {
  if (provider === "openai_compatible") {
    return runOpenAICompatibleWithPacingAndRetry({ apiKey, baseUrl, model, system, userPrompt });
  }

  // Default: Gemini
  const genAI = new GoogleGenerativeAI(apiKey);
  const geminiModel = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
  const prompt = `${system}\n\n${userPrompt}`;
  const result = await runGeminiWithPacingAndRetry(() => geminiModel.generateContent(prompt));
  const response = await result.response;
  return response.text();
}

async function runOpenAICompatibleWithPacingAndRetry({ apiKey, baseUrl, model, system, userPrompt }) {
  await enforceMinSpacing();

  const urlBase = (baseUrl || "https://api.openai.com/v1").replace(/\/+$/, "");
  const url = `${urlBase}/chat/completions`;
  const m = String(model || "").trim();
  if (!m) {
    throw new Error("Missing model for OpenAI-compatible provider. Provide x-ai-model.");
  }

  const delays = [0, 1000, 2000, 4000];
  let lastErr;
  for (let i = 0; i < delays.length; i++) {
    if (delays[i] > 0) await sleep(delays[i]);
    try {
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: m,
          messages: [
            { role: "system", content: system },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.2,
        }),
      });

      const raw = await resp.text().catch(() => "");
      let data;
      try {
        data = raw ? JSON.parse(raw) : null;
      } catch {
        data = null;
      }

      if (!resp.ok) {
        const msg = data?.error?.message || raw || `OpenAI-compatible request failed (HTTP ${resp.status})`;
        const e = new Error(msg);
        e.status = resp.status;
        throw e;
      }

      const content = data?.choices?.[0]?.message?.content;
      if (!content) throw new Error("OpenAI-compatible response missing choices[0].message.content");
      lastGeminiCallAtMs = Date.now();
      return String(content);
    } catch (e) {
      lastErr = e;
      if (!isRateLimitError(e)) break;
    }
  }
  throw lastErr;
}

async function enforceMinSpacing() {
  const now = Date.now();
  const elapsed = now - lastGeminiCallAtMs;
  const wait = MIN_GEMINI_SPACING_MS - elapsed;
  if (wait > 0) await sleep(wait);
}

function isRateLimitError(error) {
  const msg = (error && error.message) ? String(error.message) : String(error);
  const m = msg.toLowerCase();
  return m.includes("429") || m.includes("too many") || m.includes("rate") || m.includes("quota");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
