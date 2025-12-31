import type { JDAnalysis } from "../types";

const TECH_TERMS = [
  // Languages
  "python",
  "javascript",
  "typescript",
  "java",
  "c#",
  "c++",
  "go",
  "golang",
  "rust",
  "php",
  "ruby",
  "kotlin",
  "swift",
  // Web
  "react",
  "next.js",
  "nextjs",
  "vue",
  "angular",
  "svelte",
  "node",
  "node.js",
  "express",
  "vite",
  "webpack",
  "tailwind",
  "tailwindcss",
  "html",
  "css",
  "rest",
  "rest api",
  "graphql",
  // Backend/Frameworks
  "django",
  "django rest",
  "fastapi",
  "flask",
  "spring",
  "spring boot",
  "laravel",
  ".net",
  "asp.net",
  // Data/ML
  "sql",
  "postgres",
  "postgresql",
  "mysql",
  "sqlite",
  "mongodb",
  "redis",
  "pandas",
  "numpy",
  "scikit-learn",
  "sklearn",
  "tensorflow",
  "pytorch",
  "ml",
  "machine learning",
  "nlp",
  "rag",
  "langchain",
  "faiss",
  // Cloud/DevOps
  "aws",
  "azure",
  "gcp",
  "docker",
  "kubernetes",
  "terraform",
  "linux",
  "git",
  "github",
  "ci/cd",
  "cicd",
  // Testing/Quality
  "jest",
  "vitest",
  "cypress",
  "playwright",
  "testing",
  "unit testing",
  // Product/Process
  "agile",
  "scrum",
  "communication",
];

const SECTION_REQUIRED = /(requirements|must\s*have|qualifications|required)/i;
const SECTION_PREFERRED = /(preferred|nice\s*to\s*have|bonus|plus)/i;
const SECTION_RESP = /(responsibilities|what\s+you['’]?ll\s+do|role\s+overview)/i;

function normalize(s: string): string {
  return (s || "").toLowerCase().replace(/\s+/g, " ").trim();
}

function uniq(items: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const it of items) {
    const n = normalize(it);
    if (!n) continue;
    if (seen.has(n)) continue;
    seen.add(n);
    out.push(it.trim());
  }
  return out;
}

function splitLines(text: string): string[] {
  return String(text || "")
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*[-*•\u2022\u25CF\u25AA]+\s*/, "").trim())
    .filter(Boolean);
}

function extractExperienceLevel(text: string): string {
  const t = normalize(text);
  const years = t.match(/(\d{1,2})\s*\+?\s*years?/);
  if (years?.[1]) return `${years[1]}+ years`;
  if (/intern/.test(t)) return "Intern";
  if (/(junior|entry\s*level|fresher|new\s*grad)/.test(t)) return "Entry";
  if (/(senior|staff|principal|lead)/.test(t)) return "Senior";
  if (/(mid|intermediate)/.test(t)) return "Mid";
  return "";
}

function extractRoleTitle(text: string): string {
  const lines = splitLines(text);
  for (const l of lines.slice(0, 12)) {
    const m = l.match(/(?:role|position|title)\s*[:\-]\s*(.+)$/i);
    if (m?.[1]) return m[1].trim();
  }
  // Fallback: try first non-empty line if it looks like a title
  const first = lines[0] || "";
  if (first.length <= 70 && !first.includes(".") && /[A-Za-z]/.test(first)) return first;
  return "";
}

function containsTerm(haystack: string, term: string): boolean {
  const h = ` ${normalize(haystack)} `;
  const t = ` ${normalize(term)} `;
  return h.includes(t);
}

function extractTechTerms(text: string): string[] {
  const found: string[] = [];
  for (const term of TECH_TERMS) {
    if (containsTerm(text, term)) {
      // Keep original-ish casing for common acronyms
      const pretty = term
        .replace(/nextjs/i, "Next.js")
        .replace(/node\.js/i, "Node.js")
        .replace(/cicd/i, "CI/CD")
        .toUpperCase() === term.toUpperCase() && term.length <= 5
        ? term.toUpperCase()
        : term;
      found.push(pretty);
    }
  }
  return uniq(found.map((s) => s.replace(/\bml\b/i, "ML").trim()));
}

export function analyzeJdLocal(jdText: string): JDAnalysis {
  const raw = String(jdText || "").trim();
  if (raw.length < 20) {
    return {
      role_title: "",
      required_skills: [],
      preferred_skills: [],
      tools_and_technologies: [],
      responsibilities: [],
      keywords: [],
      experience_level: "",
    };
  }

  const lines = splitLines(raw);

  let mode: "required" | "preferred" | "responsibilities" | "other" = "other";
  const required: string[] = [];
  const preferred: string[] = [];
  const responsibilities: string[] = [];

  for (const l of lines) {
    if (SECTION_REQUIRED.test(l)) {
      mode = "required";
      continue;
    }
    if (SECTION_PREFERRED.test(l)) {
      mode = "preferred";
      continue;
    }
    if (SECTION_RESP.test(l)) {
      mode = "responsibilities";
      continue;
    }

    // Heuristic: lines that look like headings reset mode.
    if (/^[A-Z0-9][A-Z0-9\s/&()\-]{6,}$/.test(l)) {
      mode = "other";
      continue;
    }

    if (mode === "responsibilities") {
      responsibilities.push(l);
      continue;
    }

    // Extract tech terms from this line.
    const terms = extractTechTerms(l);
    if (terms.length) {
      if (mode === "required") required.push(...terms);
      else if (mode === "preferred") preferred.push(...terms);
    }
  }

  // Global extraction as a fallback.
  const globalTerms = extractTechTerms(raw);

  const requiredSkills = uniq([...(required.length ? required : []), ...globalTerms].slice(0, 25));
  const preferredSkills = uniq(preferred).filter((s) => !requiredSkills.some((r) => normalize(r) === normalize(s))).slice(0, 25);

  const toolsAndTech = uniq(globalTerms).slice(0, 30);

  const keywords = uniq([
    ...requiredSkills,
    ...preferredSkills,
    ...toolsAndTech,
  ]).slice(0, 50);

  return {
    role_title: extractRoleTitle(raw),
    required_skills: requiredSkills,
    preferred_skills: preferredSkills,
    tools_and_technologies: toolsAndTech,
    responsibilities: responsibilities.slice(0, 25),
    keywords,
    experience_level: extractExperienceLevel(raw),
  };
}
