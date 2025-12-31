import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import type { ResumeProfile } from "../types";

// -----------------------------
// Global PDF + Layout Constants
// -----------------------------

// A4 in points (as specified)
const A4_WIDTH_PT = 595;
const A4_HEIGHT_PT = 842;

// Margins (absolute, as specified)
const MARGIN_PT = 57; // 20mm ~ 57pt
const MIN_MARGIN_PT = 43; // 15mm ~ 42.5pt, rounded

const CONTENT_WIDTH_PT = A4_WIDTH_PT - MARGIN_PT * 2; // 481pt
const CONTENT_HEIGHT_PT = A4_HEIGHT_PT - MARGIN_PT * 2; // 728pt

const FONT_SIZE_NAME = 18;
const FONT_SIZE_HEADING = 12;
const FONT_SIZE_BODY = 11;
const FONT_SIZE_META = 10;

// Line heights
const LH_BODY = 1.15;
const LH_BULLET = 1.1;
const LH_HEADING = 1.2;

// Spacing (pt)
const GAP_HEADING_TO_CONTENT = 9;
const GAP_BETWEEN_BULLETS = 3;
const GAP_BETWEEN_SECTIONS = 14;

// -----------------------------
// SUMMARY + EXPERIENCE contracts (strict)
// -----------------------------

const SUMMARY_MAX_HEIGHT_PT = 70;
const SUMMARY_MAX_LINES = 4;

const ROLE_HEADER_HEIGHT_PT = 32; // fixed 30–34pt
const ROLE_GAP_AFTER_HEADER_PT = 2;

const ROLE_MAX_HEIGHT_ONE_PAGE_PT = 100;
const ROLE_MAX_HEIGHT_TWO_PAGE_PT = 120;

const ROLE_BULLETS_MIN = 2;
const ROLE_BULLETS_MAX_ONE_PAGE = 2;
const ROLE_BULLETS_MAX_TWO_PAGE = 3;

const BULLET_WORDS_MIN = 16;
const BULLET_WORDS_MAX = 20;

// -----------------------------
// PROJECTS contract (strict)
// -----------------------------

const PROJECTS_MAX_ONE_PAGE = 2;
const PROJECTS_MAX_TWO_PAGE = 4; // contract allows 3–4

const PROJECTS_GAP_AFTER_HEADER_PT = 6;
const PROJECT_TITLE_FONT_SIZE = 12; // 11.5–12
const PROJECT_TITLE_LINE_HEIGHT = 13.2;
const PROJECT_TITLE_TO_BULLETS_GAP_PT = 2;

const PROJECT_BULLETS_MAX = 2;
const PROJECT_BULLET_WORDS_MIN = 18;
const PROJECT_BULLET_WORDS_MAX = 22;

const PROJECT_MAX_HEIGHT_ONE_PAGE_PT = 65;
const PROJECT_MAX_HEIGHT_TWO_PAGE_PT = 75;

// -----------------------------
// SKILLS + EDUCATION contracts (strict)
// -----------------------------

const SKILLS_MAX_CATEGORIES = 4;
const SKILLS_MAX_LINES = 4;
const SKILLS_MAX_CHARS_PER_LINE = 90;
const SKILLS_MAX_HEIGHT_ONE_PAGE_PT = 55;
const SKILLS_MAX_HEIGHT_TWO_PAGE_PT = 70;
const SKILLS_MAX_PER_CATEGORY_ONE_PAGE = 8;
const SKILLS_MAX_PER_CATEGORY_TWO_PAGE = 10;

const EDUCATION_ENTRY_HEIGHT_PT = 32; // 30–35pt
const EDUCATION_TWO_ENTRIES_MAX_HEIGHT_PT = 65;
const EDUCATION_MAX_ENTRIES_ONE_PAGE = 1;
const EDUCATION_MAX_ENTRIES_TWO_PAGE = 2;

// (Legacy header gap constants removed; strict header uses fixed budgets.)

type RequestedMode = "one-page" | "two-page" | "multi-page";

export interface ExportAtsPdfOptions {
  requestedPageCount?: number; // 1 -> strict one-page attempt, 2 -> strict two-page, else multi-page
  filename?: string;
}

export interface GeneratedAtsPdf {
  bytes: Uint8Array;
  blob: Blob;
  objectUrl: string;
  pages: number;
  modeUsed: RequestedMode;
}

export type LayoutIssueCode =
  | "PAGE_OVERFLOW"
  | "MODE_OVERFLOW"
  | "SUMMARY_CONTRACT"
  | "EXPERIENCE_CONTRACT"
  | "PROJECTS_CONTRACT"
  | "SKILLS_CONTRACT"
  | "EDUCATION_CONTRACT";

export type LayoutIssue = {
  code: LayoutIssueCode;
  message: string;
};

export type LayoutAssessment = {
  ok: boolean;
  requestedMode: RequestedMode;
  modeUsed: RequestedMode;
  pages: number;
  issues: LayoutIssue[];
};

type TextStyle = {
  font: PDFFont;
  size: number;
  lineHeight: number; // absolute pt
  color?: ReturnType<typeof rgb>;
};

type LayoutBlock =
  | { kind: "header"; height: number; data: PdfHeaderLayout }
  | { kind: "section"; title: string; height: number; items: PdfSectionItem[] };

type PdfHeader = {
  name: string;
  title: string;
  contact: {
    email?: string;
    phone?: string;
    location?: string;
    linkedin?: string;
    github?: string;
    portfolio?: string;
  };
};

type PdfHeaderLayout = {
  nameLine: string;
  titleLine: string;
  titleFontSize: number;
  contactLines: string[];
};

type PdfSectionItem =
  | { kind: "paragraph"; lines: string[]; style: "body" }
  | { kind: "skills"; lines: string[] }
  | { kind: "job"; job: PdfJob }
  | { kind: "educationEntry"; entry: PdfEducation }
  | { kind: "projects"; project: PdfProject }
  | { kind: "bullets"; bullets: PdfBullet[] };

type PdfBullet = { lines: string[] };

type PdfJob = {
  role: string;
  company: string;
  dates: string;
  location?: string;
  bullets: PdfBullet[];
};

type PdfEducation = {
  line1: string;
  line2: string;
};

type PdfProject = {
  title: string;
  bullets: PdfBullet[];
};

type PdfModel = {
  header: PdfHeader;
  sections: Array<{
    title: string;
    items: PdfSectionItem[];
  }>;
};

// -----------------------------
// Header constants (strict)
// -----------------------------

// Usable width per spec
const HEADER_MAX_WIDTH_PT = 482;
const HEADER_MAX_HEIGHT_PT = 55;

// Name: 16–18pt, bold (do not reduce)
const HEADER_NAME_FONT_SIZE = 18;
const HEADER_NAME_LINE_HEIGHT = 19; // within 18–22pt line budget

// Title: 11.5–12pt, regular; can reduce by max 0.5pt
const HEADER_TITLE_FONT_SIZE = 12;
const HEADER_TITLE_FONT_SIZE_MIN = 11.5;
const HEADER_TITLE_LINE_HEIGHT = 13; // within 12–14pt line budget

// Contact: 10–10.5pt, fixed
const HEADER_CONTACT_FONT_SIZE = 10;
const HEADER_CONTACT_LINE_HEIGHT = 10; // 2 lines => 20pt (within 20–22pt)

// Small deterministic gap between title and contacts (keeps structure while staying <=55pt)
const HEADER_GAP_TITLE_TO_CONTACT = 2;

// -----------------------------
// Public API
// -----------------------------

export async function generateAtsOptimizedPdf(resume: ResumeProfile, options: ExportAtsPdfOptions = {}): Promise<GeneratedAtsPdf> {
  const requestedPageCount = options.requestedPageCount ?? 1;
  const requestedMode: RequestedMode = requestedPageCount === 1 ? "one-page" : requestedPageCount === 2 ? "two-page" : "multi-page";

  const pdfDoc = await PDFDocument.create();
  // Optional: PDF/A-1 compliance is non-trivial in-browser; we keep output ATS-safe text-based.

  const fonts = await resolveFonts(pdfDoc);
  const styles = makeStyles(fonts.regular, fonts.bold);

  // 1) Build + adapt + paginate (shared with assessment)
  const { modeUsed, measuredPages } = layoutForPdf(resume, styles, requestedMode);

  // 4) Render
  render(pdfDoc, measuredPages, styles);

  const saved = await pdfDoc.save();
  const bytes = new Uint8Array(saved);
  const blob = new Blob([bytes.buffer], { type: "application/pdf" });
  const objectUrl = URL.createObjectURL(blob);

  return {
    bytes,
    blob,
    objectUrl,
    pages: measuredPages.length,
    modeUsed,
  };
}

export async function assessAtsLayout(resume: ResumeProfile, options: ExportAtsPdfOptions = {}): Promise<LayoutAssessment> {
  const requestedPageCount = options.requestedPageCount ?? 1;
  const requestedMode: RequestedMode = requestedPageCount === 1 ? "one-page" : requestedPageCount === 2 ? "two-page" : "multi-page";

  const pdfDoc = await PDFDocument.create();
  const fonts = await resolveFonts(pdfDoc);
  const styles = makeStyles(fonts.regular, fonts.bold);

  const { model, modeUsed, measuredPages } = layoutForPdf(resume, styles, requestedMode);
  const issues = collectLayoutIssues(model, styles, requestedMode, modeUsed, measuredPages);

  return {
    ok: issues.length === 0,
    requestedMode,
    modeUsed,
    pages: measuredPages.length,
    issues,
  };
}

function layoutForPdf(
  resume: ResumeProfile,
  styles: ReturnType<typeof makeStyles>,
  requestedMode: RequestedMode
): { model: PdfModel; modeUsed: RequestedMode; measuredPages: MeasuredPage[] } {
  const baseModel = buildPdfModel(resume);
  const { model, modeUsed } = adaptToFit(baseModel, styles, requestedMode);
  const measuredPages = modeUsed === "two-page" ? paginateTwoPages(model, styles) : paginate(model, styles);
  return { model, modeUsed, measuredPages };
}

function collectLayoutIssues(
  model: PdfModel,
  styles: ReturnType<typeof makeStyles>,
  requestedMode: RequestedMode,
  modeUsed: RequestedMode,
  pages: MeasuredPage[]
): LayoutIssue[] {
  const issues: LayoutIssue[] = [];

  // Mode/page-count enforcement: if user requested 1 or 2 pages, do not silently spill.
  if (requestedMode === "one-page" && (modeUsed !== "one-page" || pages.length > 1)) {
    issues.push({
      code: "MODE_OVERFLOW",
      message: "Edit would push the resume beyond strict 1-page mode. Shorten summary/bullets or switch to 2 pages.",
    });
  }
  if (requestedMode === "two-page" && (modeUsed !== "two-page" || pages.length > 2)) {
    issues.push({
      code: "MODE_OVERFLOW",
      message: "Edit would push the resume beyond strict 2-page mode. Shorten bullets/projects or allow multi-page.",
    });
  }

  // Page overflow detection (collision/overlap guard)
  for (const p of pages) {
    if (p.usedHeight > CONTENT_HEIGHT_PT + 0.5) {
      issues.push({
        code: "PAGE_OVERFLOW",
        message: `A page exceeded the content height budget (${Math.round(p.usedHeight)}pt > ${CONTENT_HEIGHT_PT}pt).`,
      });
      break;
    }
  }

  // Section contract checks based on measured items
  const mode = requestedMode === "two-page" ? "two-page" : "one-page";
  const maxRoleHeight = mode === "two-page" ? ROLE_MAX_HEIGHT_TWO_PAGE_PT : ROLE_MAX_HEIGHT_ONE_PAGE_PT;
  const maxProjectHeight = mode === "two-page" ? PROJECT_MAX_HEIGHT_TWO_PAGE_PT : PROJECT_MAX_HEIGHT_ONE_PAGE_PT;
  const maxSkillsHeight = mode === "two-page" ? SKILLS_MAX_HEIGHT_TWO_PAGE_PT : SKILLS_MAX_HEIGHT_ONE_PAGE_PT;
  const maxEducationEntries = mode === "two-page" ? EDUCATION_MAX_ENTRIES_TWO_PAGE : EDUCATION_MAX_ENTRIES_ONE_PAGE;

  for (const s of model.sections) {
    if (s.title === "SUMMARY") {
      const prepared = prepareSection(s.items, styles);
      const para = prepared.items.find(i => i.kind === "paragraph") as Extract<PdfSectionItem, { kind: "paragraph" }> | undefined;
      if (para) {
        const height = para.lines.length * styles.body.lineHeight;
        if (para.lines.length > SUMMARY_MAX_LINES || height > SUMMARY_MAX_HEIGHT_PT + 0.5) {
          issues.push({ code: "SUMMARY_CONTRACT", message: "Summary exceeded 4 lines or 70pt height." });
        }
      }
    }

    if (s.title === "EXPERIENCE") {
      const jobs = s.items.filter(i => i.kind === "job") as Array<Extract<PdfSectionItem, { kind: "job" }>>;
      for (const j of jobs) {
        const h = measureRoleHeight(j.job, styles);
        if (h > maxRoleHeight + 0.5) {
          issues.push({ code: "EXPERIENCE_CONTRACT", message: `An experience role exceeded its height budget (${Math.round(h)}pt).` });
          break;
        }
      }
    }

    if (s.title === "PROJECTS") {
      const ps = s.items.filter(i => i.kind === "projects") as Array<Extract<PdfSectionItem, { kind: "projects" }>>;
      for (const p of ps) {
        const h = measureProjectHeight(p.project, styles);
        if (h > maxProjectHeight + 0.5) {
          issues.push({ code: "PROJECTS_CONTRACT", message: `A project exceeded its height budget (${Math.round(h)}pt).` });
          break;
        }
        // Title must be single line: ensured by truncation, but double-check width.
        if (styles.projectTitle.font.widthOfTextAtSize(p.project.title, styles.projectTitle.size) > CONTENT_WIDTH_PT + 0.5) {
          issues.push({ code: "PROJECTS_CONTRACT", message: "A project title did not fit on a single line." });
          break;
        }
      }
    }

    if (s.title === "SKILLS") {
      const item = s.items.find(i => i.kind === "skills") as Extract<PdfSectionItem, { kind: "skills" }> | undefined;
      if (item) {
        if (item.lines.length > SKILLS_MAX_LINES) {
          issues.push({ code: "SKILLS_CONTRACT", message: "Skills exceeded 4 lines." });
        }
        for (const line of item.lines) {
          if (line.length > SKILLS_MAX_CHARS_PER_LINE) {
            issues.push({ code: "SKILLS_CONTRACT", message: "A skills line exceeded 90 characters." });
            break;
          }
        }
        const h = item.lines.length * styles.body.lineHeight;
        if (h > maxSkillsHeight + 0.5) {
          issues.push({ code: "SKILLS_CONTRACT", message: "Skills exceeded height budget." });
        }
      }
    }

    if (s.title === "EDUCATION") {
      const entries = s.items.filter(i => i.kind === "educationEntry") as Array<Extract<PdfSectionItem, { kind: "educationEntry" }>>;
      if (entries.length > maxEducationEntries) {
        issues.push({ code: "EDUCATION_CONTRACT", message: "Education has too many entries for the selected mode." });
      }
      if (entries.length === 2) {
        const height = entries.length * EDUCATION_ENTRY_HEIGHT_PT + 6;
        if (height > EDUCATION_TWO_ENTRIES_MAX_HEIGHT_PT + 0.5) {
          issues.push({ code: "EDUCATION_CONTRACT", message: "Education exceeded 2-entry height budget." });
        }
      }
    }
  }

  return issues;
}

export async function exportAtsOptimizedPdf(resume: ResumeProfile, options: ExportAtsPdfOptions = {}): Promise<void> {
  const generated = await generateAtsOptimizedPdf(resume, options);
  const filename = options.filename || `${safeFilename(resume.personal?.name || "Resume")}_${generated.modeUsed}.pdf`;
  downloadBlob(generated.blob, filename);
  // Let caller own URL lifecycle in preview use-cases.
  setTimeout(() => URL.revokeObjectURL(generated.objectUrl), 1500);
}

// -----------------------------
// Font loading (deterministic, optional embedding)
// -----------------------------

type ResolvedFonts = { regular: PDFFont; bold: PDFFont };

const fontCache = new Map<string, Promise<Uint8Array | null>>();

async function fetchFontBytes(path: string): Promise<Uint8Array | null> {
  if (!fontCache.has(path)) {
    fontCache.set(
      path,
      (async () => {
        try {
          const res = await fetch(path);
          if (!res.ok) return null;
          const buf = await res.arrayBuffer();
          return new Uint8Array(buf);
        } catch {
          return null;
        }
      })()
    );
  }
  return fontCache.get(path)!;
}

async function resolveFonts(pdfDoc: PDFDocument): Promise<ResolvedFonts> {
  // We cannot ship Calibri/Arial in-repo (licensed). If the user provides them under /public/fonts,
  // we will embed them; otherwise we fall back to standard Helvetica.
  const candidates: Array<{ regular: string; bold: string }> = [
    { regular: "/fonts/Calibri.ttf", bold: "/fonts/Calibri-Bold.ttf" },
    { regular: "/fonts/Arial.ttf", bold: "/fonts/Arial-Bold.ttf" },
  ];

  for (const c of candidates) {
    const reg = await fetchFontBytes(c.regular);
    const bold = await fetchFontBytes(c.bold);
    if (reg && bold) {
      try {
        const embeddedReg = await pdfDoc.embedFont(reg, { subset: true });
        const embeddedBold = await pdfDoc.embedFont(bold, { subset: true });
        return { regular: embeddedReg, bold: embeddedBold };
      } catch {
        // continue
      }
    }
  }

  const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  return { regular, bold };
}

// -----------------------------
// Model building (sanitization + ATS formatting)
// -----------------------------

function buildPdfModel(resume: ResumeProfile): PdfModel {
  const name = sanitizeText(resume.personal?.name || "").trim() || "Your Name";

  const title = sanitizeText(resume.headline || "").trim();

  const portfolio = sanitizeText(resume.canonical?.basics?.portfolio || "").trim();

  const sections: PdfModel["sections"] = [];

  // Summary (max 3-4 lines; 40-60 words target)
  const summaryText = sanitizeText(resume.summary || "").trim();
  if (summaryText) {
    sections.push({
      title: "SUMMARY",
      items: [{ kind: "paragraph", lines: [summaryText], style: "body" }],
    });
  }

  // Experience (highest priority)
  if (resume.experience?.length) {
    const jobs: PdfSectionItem[] = resume.experience
      .filter(j => (j.role || j.company || "").trim())
      .map((j) => {
        const role = sanitizeText(j.role || "").trim();
        const company = sanitizeText(j.company || "").trim();
        const dates = sanitizeText(j.duration || "").trim();
        const location = sanitizeText(j.location || "").trim();
        const bulletsRaw = (j.achievements || []).map(a => sanitizeText(a || "").trim()).filter(Boolean);
        const bullets = bulletsRaw.map(b => ({ lines: [b] }));
        return { kind: "job", job: { role, company, dates, location: location || undefined, bullets } } as const;
      });

    if (jobs.length) {
      sections.push({ title: "EXPERIENCE", items: jobs });
    }
  }

  // Projects (optional)
  if (resume.projects?.length) {
    const projects: PdfSectionItem[] = resume.projects
      .filter(p => (p.name || "").trim())
      .map((p) => {
        const title = sanitizeText(p.name || "").trim();
        const b1 = sanitizeText(p.description || "").trim();
        const b2 = sanitizeText(p.impact || "").trim();
        const bullets = [b1, b2].filter(Boolean).map(t => ({ lines: [t] }));
        return { kind: "projects", project: { title, bullets } } as const;
      });

    if (projects.length) {
      sections.push({ title: "PROJECTS", items: projects });
    }
  }

  // Skills (categorized; strict contracts applied later once mode is known)
  const skillsLines = buildSkillsLines(resume, { maxCategories: SKILLS_MAX_CATEGORIES, maxLines: SKILLS_MAX_LINES });
  if (skillsLines.length) {
    sections.push({ title: "SKILLS", items: [{ kind: "skills", lines: skillsLines }] });
  }

  // Education (academic degrees only; strict selection applied later once mode/space is known)
  const educationEntries = buildEducationEntries(resume);
  if (educationEntries.length) {
    sections.push({
      title: "EDUCATION",
      items: educationEntries.map((e) => ({ kind: "educationEntry" as const, entry: e })),
    });
  }

  // Certifications (optional, keep ATS safe)
  if (resume.certifications?.length) {
    const certs = resume.certifications.map(c => sanitizeText(c || "").trim()).filter(Boolean);
    if (certs.length) {
      const bullets = certs.map(c => ({ lines: [c] }));
      sections.push({
        title: "CERTIFICATIONS",
        items: [{ kind: "bullets", bullets }],
      });
    }
  }

  return {
    header: {
      name,
      title,
      contact: {
        email: sanitizeText(resume.personal?.email || "").trim() || undefined,
        phone: sanitizeText(resume.personal?.phone || "").trim() || undefined,
        location: sanitizeText(resume.personal?.location || "").trim() || undefined,
        linkedin: sanitizeText(resume.personal?.linkedin || "").trim() || undefined,
        github: sanitizeText(resume.personal?.github || "").trim() || undefined,
        portfolio: portfolio || undefined,
      },
    },
    sections,
  };
}

type SkillCategory = { label: string; skills: string[]; coreCount: number };

function buildSkillsLines(resume: ResumeProfile, opts: { maxCategories: number; maxLines: number }): string[] {
  const raw = resume.skills;
  const categories: SkillCategory[] = [];

  const add = (label: string, skills: string[], coreCount: number) => {
    const clean = dedupeSkills(skills.map(s => sanitizeText(s || "").trim()).filter(Boolean));
    if (clean.length) categories.push({ label, skills: clean, coreCount });
  };

  add("Languages", raw?.programming_languages || [], 6);
  add("Frameworks", raw?.frameworks || [], 6);

  // AI / Data: prefer concepts; keep AI-ish tools if present
  add("AI / Data", raw?.concepts || [], 5);

  // Databases & Tools: combine databases + tools
  add("Databases & Tools", [...(raw?.databases || []), ...(raw?.tools || [])], 6);

  const picked = categories.slice(0, opts.maxCategories);
  return picked.slice(0, opts.maxLines).map(c => `${c.label}: ${c.skills.join(", ")}`);
}

function dedupeSkills(skills: string[]): string[] {
  const seen = new Map<string, string>();
  for (const s of skills) {
    const key = normalizeSkillKey(s);
    if (!seen.has(key)) seen.set(key, s);
  }
  return Array.from(seen.values());
}

function normalizeSkillKey(skill: string): string {
  return (skill || "").trim().toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/\.js$/g, "js")
    .replace(/\bc\+\+\b/g, "cpp")
    .replace(/\bc#\b/g, "csharp");
}

function buildEducationEntries(resume: ResumeProfile): PdfEducation[] {
  // Prefer canonical education array if available; otherwise fall back to ResumeProfile.education.
  const canonical = resume.canonical?.education || [];
  const entries: PdfEducation[] = [];

  for (const e of canonical) {
    const degree = sanitizeText([e.degree, e.field_of_study].filter(Boolean).join(" - ")).trim();
    const institution = sanitizeText(e.institution || "").trim();
    const year = sanitizeText(e.end_year || e.start_year || "").trim();
    const cgpa = sanitizeText(e.cgpa || "").trim();

    if (!degree && !institution) continue;
    const line1 = [degree, institution].filter(Boolean).join(" — ");
    const line2 = [year, cgpa ? `CGPA: ${cgpa}` : ""].filter(Boolean).join(" | ");
    entries.push({ line1, line2 });
  }

  // If canonical missing, use ResumeProfile.education
  if (!entries.length) {
    const edu = resume.education;
    if (edu?.institution || edu?.degree) {
      const degree = sanitizeText(edu.degree || "").trim();
      const institution = sanitizeText(edu.institution || "").trim();
      const year = sanitizeText(edu.year || "").trim();
      const cgpa = sanitizeText(edu.cgpa || "").trim();
      const line1 = [degree, institution].filter(Boolean).join(" — ");
      const line2 = [year, cgpa ? `CGPA: ${cgpa}` : ""].filter(Boolean).join(" | ");
      entries.push({ line1, line2 });
    }
  }

  // Sort newest first by year string (best-effort, deterministic)
  const parseYear = (t: string) => {
    const m = (t || "").match(/(19|20)\d{2}/);
    return m ? Number(m[0]) : -1;
  };
  return entries
    .slice()
    .sort((a, b) => parseYear(b.line2) - parseYear(a.line2));
}

// -----------------------------
// Adaptation Logic (one-page compression)
// -----------------------------

function adaptToFit(base: PdfModel, styles: ReturnType<typeof makeStyles>, requestedMode: RequestedMode): { model: PdfModel; modeUsed: RequestedMode } {
  if (requestedMode === "multi-page") return { model: enforceConstraints(base), modeUsed: "multi-page" };

  if (requestedMode === "two-page") {
    // Start with conservative constraints (no data loss, only compression/merging)
    let model = enforceConstraints(base);
    model = enforceSectionContracts(model, styles, "two-page");

    // If it already fits in 2 pages with deterministic allocation, keep it.
    if (paginateTwoPages(model, styles).length <= 2) {
      return { model, modeUsed: "two-page" };
    }

    // Progressive compression until it fits within 2 pages.
    const steps: Array<(m: PdfModel) => PdfModel> = [
      (m) => compressExperienceBullets(m, 3),
      (m) => shortenAllBullets(m, { target: 18, max: 20 }),
      (m) => enforceSkillsContracts(m, styles, "two-page"),
      (m) => clampSummaryStrict(m, styles, { mode: "two-page" }),
      // last resort: make roles fit their strict height by further bullet compression
      (m) => enforceExperienceContracts(m, styles, "two-page"),
    ];

    for (const step of steps) {
      model = step(model);
      model = enforceSectionContracts(model, styles, "two-page");
      if (paginateTwoPages(model, styles).length <= 2) {
        return { model, modeUsed: "two-page" };
      }
    }

    // If still overflowing, fall back to multi-page (keeps all content). Requested strict 2 pages
    // may be infeasible for extremely long resumes.
    return { model, modeUsed: "multi-page" };
  }

  // 1) Enforce base constraints (bullets 3-5, etc.)
  let model = enforceConstraints(base);
  model = enforceSectionContracts(model, styles, "one-page");

  // 2) Apply one-page compression steps in order
  const steps: Array<(m: PdfModel) => PdfModel> = [
    // Ensure strict per-role contracts (one-page: 2 bullets, 100pt max role)
    (m) => enforceExperienceContracts(m, styles, "one-page"),
    // Condense bullet text toward 16–20 words
    (m) => shortenAllBullets(m, { target: 18, max: 20 }),
    // Enforce strict skills contract
    (m) => enforceSkillsContracts(m, styles, "one-page"),
    // Clamp summary word count / lines
    (m) => clampSummaryStrict(m, styles, { mode: "one-page" }),
    // Reduce section gaps by 2pt if needed (handled at measurement time via tight flag)
  ];

  for (const step of steps) {
    model = step(model);
    model = enforceSectionContracts(model, styles, "one-page");
    const pages = paginate(model, styles, { tight: false });
    if (pages.length === 1) {
      const height = pages[0].usedHeight;
      if (height <= CONTENT_HEIGHT_PT) {
        return { model, modeUsed: "one-page" };
      }
    }
  }

  // Try tighter spacing before giving up
  model = enforceConstraints(model);
  model = enforceSectionContracts(model, styles, "one-page");
  const pagesTight = paginate(model, styles, { tight: true });
  if (pagesTight.length === 1 && pagesTight[0].usedHeight <= CONTENT_HEIGHT_PT) {
    return { model, modeUsed: "one-page" };
  }

  // Still overflow → switch to multi-page, keeping compressed content (no data loss)
  return { model, modeUsed: "multi-page" };
}

function enforceConstraints(model: PdfModel): PdfModel {
  // Clamp bullets per job to 3 (strict contract)
  const sections = model.sections.map((s) => {
    if (s.title !== "EXPERIENCE") return s;
    return {
      ...s,
      items: s.items.map((it) => {
        if (it.kind !== "job") return it;
        const merged = mergeBulletsToCount(it.job.bullets, ROLE_BULLETS_MAX_TWO_PAGE);
        return { ...it, job: { ...it.job, bullets: merged } };
      }),
    };
  });

  // Clamp projects to 4 by merging extra projects into last project bullets
  const sections2 = sections.map((s) => {
    if (s.title !== "PROJECTS") return s;
    const projects = s.items.filter(i => i.kind === "projects") as Array<Extract<PdfSectionItem, { kind: "projects" }>>;
    if (projects.length <= 4) return s;

    const kept = projects.slice(0, 4);
    const extras = projects.slice(4);
    if (extras.length) {
      const last = kept[kept.length - 1];
      const extraTexts = extras.flatMap(p => p.project.bullets.flatMap(b => b.lines)).filter(Boolean);
      const appended = last.project.bullets.concat(extraTexts.map(t => ({ lines: [t] })));
      kept[kept.length - 1] = { ...last, project: { ...last.project, bullets: mergeBulletsToCount(appended, 2) } };
    }

    return { ...s, items: kept };
  });

  return { ...model, sections: sections2 };
}

function compressExperienceBullets(model: PdfModel, targetBulletsPerJob: number): PdfModel {
  const sections = model.sections.map((s) => {
    if (s.title !== "EXPERIENCE") return s;
    return {
      ...s,
      items: s.items.map((it) => {
        if (it.kind !== "job") return it;
        return { ...it, job: { ...it.job, bullets: mergeBulletsToCount(it.job.bullets, targetBulletsPerJob) } };
      }),
    };
  });
  return { ...model, sections };
}

function shortenAllBullets(model: PdfModel, opts: { target: number; max: number }): PdfModel {
  const sections = model.sections.map((s) => {
    return {
      ...s,
      items: s.items.map((it) => {
        if (it.kind === "job") {
          return {
            ...it,
            job: {
              ...it.job,
              bullets: it.job.bullets.map(b => ({ lines: [compressToWordBudget(b.lines.join(" "), opts)] })),
            },
          };
        }
        if (it.kind === "projects") {
          return {
            ...it,
            project: {
              ...it.project,
              bullets: it.project.bullets.map(b => ({ lines: [compressToWordBudget(b.lines.join(" "), opts)] })),
            },
          };
        }
        if (it.kind === "bullets") {
          return {
            ...it,
            bullets: it.bullets.map(b => ({ lines: [compressToWordBudget(b.lines.join(" "), opts)] })),
          };
        }
        return it;
      }),
    };
  });
  return { ...model, sections };
}

function enforceSkillsContracts(model: PdfModel, styles: ReturnType<typeof makeStyles>, mode: "one-page" | "two-page"): PdfModel {
  const maxHeight = mode === "one-page" ? SKILLS_MAX_HEIGHT_ONE_PAGE_PT : SKILLS_MAX_HEIGHT_TWO_PAGE_PT;
  const maxPerCategory = mode === "one-page" ? SKILLS_MAX_PER_CATEGORY_ONE_PAGE : SKILLS_MAX_PER_CATEGORY_TWO_PAGE;

  const sections = model.sections.map((s) => {
    if (s.title !== "SKILLS") return s;
    const item = s.items.find(i => i.kind === "skills") as Extract<PdfSectionItem, { kind: "skills" }> | undefined;
    if (!item) return s;

    // Rebuild categories from original resume fields if possible.
    // If we only have lines already, we still enforce line/char/height constraints deterministically.
    let lines = item.lines.map(l => sanitizeText(l).trim()).filter(Boolean).slice(0, SKILLS_MAX_LINES);
    if (!lines.length) return s;

    // Normalize each category line: "Label: a, b, c" and clamp skills per category without removing core.
    lines = lines.map((line) => {
      const m = line.match(/^([^:]{2,32}):\s*(.*)$/);
      if (!m) return line;
      const label = sanitizeText(m[1]).trim();
      const rest = sanitizeText(m[2]).trim();
      const skills = rest.split(/,\s*/g).map(x => sanitizeText(x).trim()).filter(Boolean);
      const deduped = dedupeSkills(skills);

      // Define core as first 5 (deterministic) and never remove those.
      const coreCount = Math.min(5, deduped.length);
      const core = deduped.slice(0, coreCount);
      const nonCore = deduped.slice(coreCount);

      const kept = core.concat(nonCore.slice(0, Math.max(0, maxPerCategory - core.length)));
      return `${label}: ${kept.join(", ")}`;
    });

    // Enforce <= 90 chars per line via: merge similar terms, tighten commas, then drop lowest-priority non-core tokens.
    lines = lines.map((line) => fitSkillsLineToCharBudget(line, SKILLS_MAX_CHARS_PER_LINE));

    // Enforce max 4 lines and height.
    lines = lines.slice(0, SKILLS_MAX_LINES);
    const height = lines.length * styles.body.lineHeight;
    if (height > maxHeight) {
      // Deterministic fallback: reduce to 3 lines if necessary (keep first categories)
      while (lines.length > 0 && lines.length * styles.body.lineHeight > maxHeight) {
        lines = lines.slice(0, Math.max(1, lines.length - 1));
      }
    }

    // Ensure width fits content width (final safety; does not wrap)
    lines = lines.map(l => truncateToWidth(styles.body.font, styles.body.size, l, CONTENT_WIDTH_PT));
    return { ...s, items: [{ kind: "skills" as const, lines }] };
  });

  return { ...model, sections };
}

function fitSkillsLineToCharBudget(line: string, maxChars: number): string {
  let t = sanitizeText(line).trim();
  if (t.length <= maxChars) return t;

  // Tighten comma spacing first.
  t = t.replace(/,\s+/g, ",");
  if (t.length <= maxChars) return t;

  // Merge/normalize common tools deterministically.
  t = t
    .replace(/\bpostgre\s*sql\b/gi, "PostgreSQL")
    .replace(/\bpostgres\b/gi, "PostgreSQL")
    .replace(/\bnode\.js\b/gi, "Node.js")
    .replace(/\breact\.js\b/gi, "React")
    .replace(/\bamazon web services\b/gi, "AWS")
    .replace(/\bgoogle cloud platform\b/gi, "GCP");
  if (t.length <= maxChars) return t;

  // Drop lowest-priority non-core skills: remove from the end after colon.
  const m = t.match(/^([^:]{2,32}):\s*(.*)$/);
  if (!m) return t.slice(0, maxChars);
  const label = m[1].trim();
  const skills = m[2].split(/,\s*/g).map(s => s.trim()).filter(Boolean);
  const coreCount = Math.min(5, skills.length);
  let core = skills.slice(0, coreCount);
  let rest = skills.slice(coreCount);

  while (rest.length && `${label}: ${core.concat(rest).join(",")}`.length > maxChars) {
    rest = rest.slice(0, -1);
  }

  // If still too long, keep core only (never remove core skills).
  let out = `${label}: ${core.concat(rest).join(",")}`;
  if (out.length > maxChars) {
    out = `${label}: ${core.join(",")}`;
  }

  return out.length <= maxChars ? out : out.slice(0, maxChars);
}

function enforceSectionContracts(model: PdfModel, styles: ReturnType<typeof makeStyles>, mode: "one-page" | "two-page"): PdfModel {
  let out = model;
  out = clampSummaryStrict(out, styles, { mode });
  out = enforceExperienceContracts(out, styles, mode);
  out = enforceProjectsContracts(out, styles, mode);
  out = enforceSkillsContracts(out, styles, mode);
  out = enforceEducationContracts(out, styles, mode);
  return out;
}

function enforceEducationContracts(model: PdfModel, styles: ReturnType<typeof makeStyles>, mode: "one-page" | "two-page"): PdfModel {
  const maxEntries = mode === "one-page" ? EDUCATION_MAX_ENTRIES_ONE_PAGE : EDUCATION_MAX_ENTRIES_TWO_PAGE;

  let out = model;
  out = {
    ...out,
    sections: out.sections.map((s) => {
      if (s.title !== "EDUCATION") return s;
      const entries = s.items.filter(i => i.kind === "educationEntry") as Array<Extract<PdfSectionItem, { kind: "educationEntry" }>>;
      if (!entries.length) return s;
      const clamped = entries.slice(0, maxEntries);
      return { ...s, items: clamped };
    }),
  };

  // 2-page: include up to 2 only if space allows on page 2; otherwise keep 1.
  if (mode === "two-page") {
    const eduSection = out.sections.find(s => s.title === "EDUCATION");
    if (eduSection) {
      const entries = eduSection.items.filter(i => i.kind === "educationEntry") as Array<Extract<PdfSectionItem, { kind: "educationEntry" }>>;
      if (entries.length >= 2) {
        // Try with 2; if it forces overflow or a spill, drop to 1.
        const canFitTwo = canEducationFitOnPage2(out, styles, 2);
        if (!canFitTwo) {
          out = {
            ...out,
            sections: out.sections.map((s) => {
              if (s.title !== "EDUCATION") return s;
              const e = s.items.filter(i => i.kind === "educationEntry") as Array<Extract<PdfSectionItem, { kind: "educationEntry" }>>;
              return { ...s, items: e.slice(0, 1) };
            }),
          };
        }
      }
    }
  }

  return out;
}

function canEducationFitOnPage2(model: PdfModel, styles: ReturnType<typeof makeStyles>, entriesCount: number): boolean {
  // Deterministic simulation of page2 packing order (matches paginateTwoPages):
  // remaining experience roles then PROJECTS, SKILLS, EDUCATION, CERTIFICATIONS.
  const gapSection = GAP_BETWEEN_SECTIONS;
  const gapHeadingToContentDefault = GAP_HEADING_TO_CONTENT;

  const sectionsByTitle = new Map(model.sections.map(s => [s.title, s] as const));
  const experience = sectionsByTitle.get("EXPERIENCE");

  const expItems = (experience?.items || []).filter(i => i.kind === "job") as Array<Extract<PdfSectionItem, { kind: "job" }>>;
  const preparedExp = prepareSection(expItems, styles);
  const expItemHeights = preparedExp.itemHeights;

  // In paginateTwoPages, 0–2 roles go to page1; assume worst-case for page2 availability by using the same rule.
  // We'll replicate the same placement decision based on CONTENT_HEIGHT_PT.
  const headerH = measureHeaderLayout(layoutHeader(model.header, styles));

  // Measure page1 used to determine how many jobs placed there.
  let used1 = headerH;
  const summary = sectionsByTitle.get("SUMMARY");
  if (summary) {
    const prepared = prepareSection(summary.items, styles);
    const gapHeadingToContent = gapHeadingToContentDefault;
    const chunks = chunkSectionItems(prepared.items, prepared.itemHeights, {
      title: "SUMMARY",
      headingHeight: prepared.headingHeight,
      gapHeadingToContent,
    });
    for (const c of chunks) {
      used1 += gapSection + c.height;
    }
  }

  let placedJobs = 0;
  for (let i = 0; i < expItems.length; i++) {
    if (placedJobs >= 2) break;
    const h = expItemHeights[i] ?? 0;
    const jobBlockH = preparedExp.headingHeight + gapHeadingToContentDefault + h;
    const needed = gapSection + jobBlockH;
    if (used1 + needed <= CONTENT_HEIGHT_PT || placedJobs === 0) {
      used1 += needed;
      placedJobs++;
    }
  }

  // Now compute page2 used up to (but not including) EDUCATION.
  let used2 = 0;

  // Remaining experience roles
  for (let i = placedJobs; i < expItems.length; i++) {
    const h = expItemHeights[i] ?? 0;
    const jobBlockH = preparedExp.headingHeight + gapHeadingToContentDefault + h;
    used2 += (used2 ? gapSection : 0) + jobBlockH;
  }

  const beforeEducationTitles = ["PROJECTS", "SKILLS"];
  for (const t of beforeEducationTitles) {
    const s = sectionsByTitle.get(t);
    if (!s) continue;
    const prepared = prepareSection(s.items, styles);
    const gapHeadingToContent = t === "PROJECTS" ? PROJECTS_GAP_AFTER_HEADER_PT : gapHeadingToContentDefault;
    const chunks = chunkSectionItems(prepared.items, prepared.itemHeights, {
      title: t,
      headingHeight: prepared.headingHeight,
      gapHeadingToContent,
    });
    for (const c of chunks) {
      used2 += (used2 ? gapSection : 0) + c.height;
    }
  }

  // Required height for EDUCATION with N entries
  const edu = sectionsByTitle.get("EDUCATION");
  if (!edu) return true;
  const eduItems = (edu.items.filter(i => i.kind === "educationEntry") as Array<Extract<PdfSectionItem, { kind: "educationEntry" }>>)
    .slice(0, entriesCount);
  if (!eduItems.length) return true;

  // Education section height = heading + gap + sum(entries) + intra gaps (6 between items)
  const headingH = styles.heading.lineHeight;
  const eduContentH = eduItems.length * EDUCATION_ENTRY_HEIGHT_PT + (eduItems.length > 1 ? 6 : 0);
  const required = headingH + gapHeadingToContentDefault + eduContentH;

  // Also enforce total contract cap for 2 entries
  if (eduItems.length === 2 && eduContentH > EDUCATION_TWO_ENTRIES_MAX_HEIGHT_PT) return false;

  const remaining = CONTENT_HEIGHT_PT - used2 - (used2 ? gapSection : 0);
  return required <= remaining;
}

function enforceProjectsContracts(model: PdfModel, styles: ReturnType<typeof makeStyles>, mode: "one-page" | "two-page"): PdfModel {
  const maxProjects = mode === "one-page" ? PROJECTS_MAX_ONE_PAGE : PROJECTS_MAX_TWO_PAGE;
  const maxHeight = mode === "one-page" ? PROJECT_MAX_HEIGHT_ONE_PAGE_PT : PROJECT_MAX_HEIGHT_TWO_PAGE_PT;

  const sections = model.sections.map((s) => {
    if (s.title !== "PROJECTS") return s;

    const projects = s.items.filter(i => i.kind === "projects") as Array<Extract<PdfSectionItem, { kind: "projects" }>>;
    if (!projects.length) return s;

    const clamped = projects.slice(0, maxProjects).map((p) => {
      let title = sanitizeText(p.project.title || "").trim();
      if (!title) title = "Project";
      title = shortenProjectTitle(styles, title);

      // Normalize bullets: max 2, no paragraph-style list headers.
      let bullets = p.project.bullets
        .map(b => sanitizeText(b.lines.join(" ")).trim())
        .filter(Boolean);

      bullets = bullets.map(stripProjectBulletDisallowedPatterns);

      // Auto-fix step 2: split “features + tech” across two bullets when possible.
      bullets = splitFeaturesAndTechAcrossBullets(bullets);

      // Enforce max bullets
      bullets = bullets.slice(0, PROJECT_BULLETS_MAX);
      if (!bullets.length) bullets = ["Delivered project outcomes and measurable impact using ATS-safe phrasing."];

      // Enforce word budgets 18–22
      bullets = bullets.map(t => compressProjectBulletToWordRange(t, { min: PROJECT_BULLET_WORDS_MIN, max: PROJECT_BULLET_WORDS_MAX }));

      let candidate: PdfProject = { title, bullets: bullets.map(t => ({ lines: [t] })) };

      // Height enforcement loop: compress bullets and shorten title; never reduce font size or add bullets.
      for (let attempt = 0; attempt < 6; attempt++) {
        const h = measureProjectHeight(candidate, styles);
        if (h <= maxHeight) break;

        // 1) compress bullet phrasing further
        candidate = {
          ...candidate,
          bullets: candidate.bullets.map(b => ({ lines: [compressProjectBulletToWordRange(b.lines.join(" "), { min: PROJECT_BULLET_WORDS_MIN, max: Math.max(PROJECT_BULLET_WORDS_MIN, PROJECT_BULLET_WORDS_MAX - 2) })] })),
        };

        // 3) remove filler adjectives (again)
        candidate = {
          ...candidate,
          bullets: candidate.bullets.map(b => ({ lines: [removeFillerAdjectives(b.lines.join(" "))] })),
        };

        // If still tall, shorten title more aggressively (single line only)
        candidate = { ...candidate, title: shortenProjectTitle(styles, candidate.title, { aggressive: true }) };
      }

      return { kind: "projects" as const, project: candidate };
    });

    return { ...s, items: clamped };
  });

  return { ...model, sections };
}

function shortenProjectTitle(styles: ReturnType<typeof makeStyles>, title: string, opts: { aggressive?: boolean } = {}): string {
  const t0 = sanitizeText(title).trim();
  if (!t0) return "Project";

  // Prefer removing trailing parenthetical/after separators before ellipsis.
  const font = styles.projectTitle.font;
  const size = styles.projectTitle.size;
  const maxW = CONTENT_WIDTH_PT;

  let t = t0;
  // Remove bracketed qualifiers deterministically
  t = t.replace(/\s*\([^)]*\)\s*/g, " ").replace(/\s{2,}/g, " ").trim();
  if (font.widthOfTextAtSize(t, size) <= maxW) return t;

  const separators = [" | ", " - ", " — ", ": ", " – "];
  for (const sep of separators) {
    const idx = t.indexOf(sep);
    if (idx > 0) {
      const left = t.slice(0, idx).trim();
      if (left && font.widthOfTextAtSize(left, size) <= maxW) return left;
      t = left || t;
      break;
    }
  }

  if (!opts.aggressive) {
    return truncateToWidth(font, size, t, maxW);
  }

  // Aggressive: shorten to first 6–8 words then apply width truncation.
  const words = t.split(/\s+/g).filter(Boolean);
  const head = words.slice(0, Math.min(8, words.length)).join(" ");
  return truncateToWidth(font, size, head, maxW);
}

function stripProjectBulletDisallowedPatterns(text: string): string {
  let t = sanitizeText(text);

  // Remove list headers like "Key features:" / "Features:" / "Highlights:" / "Tech stack:".
  t = t.replace(/^\s*(key\s*features|features|highlights|tech\s*stack|stack|tools)\s*:\s*/i, "");

  // Avoid paragraph-style inline lists after a colon by turning it into a sentence.
  // Example: "Built X: A, B, C" -> "Built X using A, B, C".
  t = t.replace(/:\s*/g, " using ");

  // Remove duplicate fillers
  t = removeFillerAdjectives(t);

  return t.replace(/\s{2,}/g, " ").trim();
}

function splitFeaturesAndTechAcrossBullets(bullets: string[]): string[] {
  const out = bullets.slice();
  if (!out.length) return out;
  if (out.length >= 2) return out;

  const one = out[0];
  // Pattern: "... using X, Y, Z" -> split into "..." and "Tech: X/Y/Z"
  const m = one.match(/^(.*?)(?:\s+using\s+)(.+)$/i);
  if (m) {
    const left = m[1].trim().replace(/[;,:-]?$/, ".");
    const right = m[2].trim();
    if (left && right) {
      const tech = compactInlineList(right);
      return [left, `Tech: ${tech}`];
    }
  }

  // Pattern: split on ";" into 2 bullets if it yields meaningful halves.
  const parts = one.split(/\s*;\s*/g).map(p => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    const a = parts[0];
    const b = parts.slice(1).join("; ");
    if (countWords(a) >= 10 && countWords(b) >= 10) return [a, b];
  }

  return out;
}

function compactInlineList(text: string): string {
  const t = sanitizeText(text);
  const parts = t.split(/,\s*/g).map(p => p.trim()).filter(Boolean);
  if (parts.length >= 3) return parts.join("/");
  return t;
}

function removeFillerAdjectives(text: string): string {
  let t = text;
  const fluff = [
    "highly",
    "very",
    "extremely",
    "innovative",
    "cutting-edge",
    "robust",
    "scalable",
    "seamless",
    "efficient",
    "powerful",
  ];
  for (const w of fluff) {
    const re = new RegExp(`\\b${escapeRegExp(w)}\\b`, "gi");
    t = t.replace(re, "");
  }
  return t.replace(/\s{2,}/g, " ").trim();
}

function compressProjectBulletToWordRange(text: string, range: { min: number; max: number }): string {
  let t = stripProjectBulletDisallowedPatterns(text);

  // Deterministic phrasing compression
  const replacements: Array<[RegExp, string]> = [
    [/\bin order to\b/gi, "to"],
    [/\bas well as\b/gi, "and"],
    [/\bin addition to\b/gi, "and"],
    [/\bresponsible for\b/gi, "led"],
    [/\bworked on\b/gi, "built"],
    [/\butilized\b/gi, "used"],
    [/\bleveraged\b/gi, "used"],
    [/\bimplemented\b/gi, "built"],
    [/\bthat resulted in\b/gi, "resulting in"],
  ];
  for (const [re, rep] of replacements) t = t.replace(re, rep);
  t = removeFillerAdjectives(t);
  t = t.replace(/\s{2,}/g, " ").trim();

  const wc = countWords(t);
  if (wc <= range.max) return t;
  return clampWords(t, range.max);
}

function measureProjectHeight(project: PdfProject, styles: ReturnType<typeof makeStyles>): number {
  const titleH = styles.projectTitle.lineHeight;
  const bullets = project.bullets.map(b => {
    const lines = wrapText(styles.bullet.font, styles.bullet.size, b.lines.join(" "), CONTENT_WIDTH_PT - bulletIndentPt(styles));
    return { lines };
  });
  const bulletsH = measureBullets(bullets, styles);
  return titleH + PROJECT_TITLE_TO_BULLETS_GAP_PT + bulletsH;
}

function clampSummaryStrict(model: PdfModel, styles: ReturnType<typeof makeStyles>, opts: { mode: "one-page" | "two-page" }): PdfModel {
  const budgets = opts.mode === "one-page" ? { minWords: 40, maxWords: 55 } : { minWords: 45, maxWords: 65 };

  const sections = model.sections.map((s) => {
    if (s.title !== "SUMMARY") return s;
    const item = s.items.find(i => i.kind === "paragraph") as Extract<PdfSectionItem, { kind: "paragraph" }> | undefined;
    if (!item) return s;

    // Single paragraph only
    let text = sanitizeText(item.lines.join(" ")).trim();
    if (!text) return s;

    // Keep within word budget (prefer compression over truncation)
    text = compressSummaryText(text);

    let wc = countWords(text);
    if (wc > budgets.maxWords) {
      // Last resort: trim to max word budget (minimizes meaning loss vs overflowing contract)
      text = clampWords(text, budgets.maxWords);
      wc = countWords(text);
    }

    // If far below minWords, keep as-is (do not invent content)
    if (wc < budgets.minWords) {
      // no-op
    }

    // Height/line enforcement: iteratively compress and then gently shorten (without font changes)
    let candidate = text;
    for (let attempt = 0; attempt < 8; attempt++) {
      const lines = wrapText(styles.body.font, styles.body.size, candidate, CONTENT_WIDTH_PT);
      const height = lines.length * styles.body.lineHeight;
      if (lines.length <= SUMMARY_MAX_LINES && height <= SUMMARY_MAX_HEIGHT_PT) break;

      // 1) compress adjectives (again)
      candidate = compressSummaryAdjectives(candidate);

      // 2) compact technology lists
      candidate = compactTechLists(candidate);

      // 3) replace phrases
      candidate = replaceSummaryPhrases(candidate);

      // If still too tall, reduce word count toward minWords (never below)
      const nextMax = Math.max(budgets.minWords, Math.min(budgets.maxWords, countWords(candidate) - 2));
      if (countWords(candidate) > nextMax) {
        candidate = clampWords(candidate, nextMax);
      }
    }

    return { ...s, items: [{ kind: "paragraph" as const, lines: [candidate], style: "body" as const }] };
  });

  return { ...model, sections };
}

function compressSummaryText(text: string): string {
  let t = sanitizeText(text);
  t = compressSummaryAdjectives(t);
  t = compactTechLists(t);
  t = replaceSummaryPhrases(t);
  return t;
}

function compressSummaryAdjectives(text: string): string {
  let t = text;
  // Remove common non-substantive adjectives/adverbs (ATS-safe, meaning-preserving)
  const fluff = [
    "highly",
    "very",
    "extremely",
    "results-driven",
    "result-driven",
    "detail-oriented",
    "detail oriented",
    "passionate",
    "dynamic",
    "motivated",
    "proven",
    "seasoned",
    "strong",
  ];
  for (const w of fluff) {
    const re = new RegExp(`\\b${escapeRegExp(w)}\\b`, "gi");
    t = t.replace(re, "");
  }
  t = t.replace(/\s{2,}/g, " ").replace(/\s+,/g, ",").trim();
  return t;
}

function compactTechLists(text: string): string {
  // Compact obvious comma-separated tech stacks: "A, B, C" -> "A/B/C" when within brackets or after a stack keyword.
  let t = text;

  // Inside parentheses: (A, B, C) -> (A/B/C)
  t = t.replace(/\(([^)]*)\)/g, (m, inside: string) => {
    const parts = inside.split(",").map(p => p.trim()).filter(Boolean);
    if (parts.length < 3) return m;
    if (parts.some(p => p.includes(" ") && !/^[A-Za-z0-9.+#\- ]+$/.test(p))) return m;
    return `(${parts.join("/")})`;
  });

  // After keywords like "Tech:" or "Stack:" or "Technologies:".
  t = t.replace(/\b(Tech|Stack|Technologies|Skills)\s*:\s*([^.;]+)/gi, (m, k: string, rest: string) => {
    const parts = rest.split(",").map(p => p.trim()).filter(Boolean);
    if (parts.length < 3) return m;
    return `${k}: ${parts.join("/")}`;
  });

  return t.replace(/\s{2,}/g, " ").trim();
}

function replaceSummaryPhrases(text: string): string {
  const replacements: Array<[RegExp, string]> = [
    [/\bin order to\b/gi, "to"],
    [/\bas well as\b/gi, "and"],
    [/\bin addition to\b/gi, "and"],
    [/\bresponsible for\b/gi, "led"],
    [/\bworked on\b/gi, "built"],
    [/\butilized\b/gi, "used"],
    [/\bleveraged\b/gi, "used"],
    [/\bwith a focus on\b/gi, "focused on"],
  ];
  let t = text;
  for (const [re, rep] of replacements) t = t.replace(re, rep);
  return t.replace(/\s{2,}/g, " ").trim();
}

function enforceExperienceContracts(model: PdfModel, styles: ReturnType<typeof makeStyles>, mode: "one-page" | "two-page"): PdfModel {
  const maxRoleHeight = mode === "one-page" ? ROLE_MAX_HEIGHT_ONE_PAGE_PT : ROLE_MAX_HEIGHT_TWO_PAGE_PT;
  const targetMaxBullets = mode === "one-page" ? ROLE_BULLETS_MAX_ONE_PAGE : ROLE_BULLETS_MAX_TWO_PAGE;

  const sections = model.sections.map((s) => {
    if (s.title !== "EXPERIENCE") return s;

    const nextItems = s.items.map((it) => {
      if (it.kind !== "job") return it;

      const job = it.job;
      let bullets = job.bullets.map(b => ({ lines: [sanitizeText(b.lines.join(" ")).trim()] })).filter(b => b.lines[0]);

      // Ensure 2–3 bullets if possible.
      if (bullets.length > targetMaxBullets) bullets = mergeBulletsToCount(bullets, targetMaxBullets);

      if (bullets.length < ROLE_BULLETS_MIN) {
        const expanded: PdfBullet[] = [];
        for (const b of bullets) {
          const split = splitBulletIntoTwo(b.lines.join(" "));
          expanded.push(...split.map(t => ({ lines: [t] })));
          if (expanded.length >= ROLE_BULLETS_MIN) break;
        }
        bullets = expanded.length ? expanded.slice(0, ROLE_BULLETS_MIN) : bullets;
      }

      // Enforce bullet word budgets (16–20) by compressing (never font size).
      bullets = bullets
        .slice(0, Math.max(1, targetMaxBullets))
        .map(b => ({ lines: [compressBulletToWordRange(b.lines.join(" "), { min: BULLET_WORDS_MIN, max: BULLET_WORDS_MAX })] }));

      // Height enforcement: iteratively reduce bullets then compress text (no font changes).
      let candidateJob: PdfJob = { ...job, bullets };
      for (let attempt = 0; attempt < 6; attempt++) {
        const h = measureRoleHeight(candidateJob, styles);
        if (h <= maxRoleHeight) break;

        // 1) Reduce bullets (merge to preserve meaning)
        if (candidateJob.bullets.length > ROLE_BULLETS_MIN) {
          candidateJob = { ...candidateJob, bullets: mergeBulletsToCount(candidateJob.bullets, ROLE_BULLETS_MIN) };
          continue;
        }

        // 2) Compress bullet text further within contract
        const nextBullets = candidateJob.bullets.map(b => ({ lines: [compressBulletToWordRange(b.lines.join(" "), { min: BULLET_WORDS_MIN, max: Math.max(BULLET_WORDS_MIN, BULLET_WORDS_MAX - 2) })] }));
        candidateJob = { ...candidateJob, bullets: nextBullets };
      }

      return { ...it, job: candidateJob };
    });

    return { ...s, items: nextItems };
  });

  return { ...model, sections };
}

function measureRoleHeight(job: PdfJob, styles: ReturnType<typeof makeStyles>): number {
  const bullets = job.bullets.map(b => {
    const lines = wrapText(styles.bullet.font, styles.bullet.size, b.lines.join(" "), CONTENT_WIDTH_PT - bulletIndentPt(styles));
    return { lines };
  });
  const bulletsH = measureBullets(bullets, styles);
  return ROLE_HEADER_HEIGHT_PT + ROLE_GAP_AFTER_HEADER_PT + bulletsH;
}

function splitBulletIntoTwo(text: string): string[] {
  const t = sanitizeText(text);
  const parts = t.split(/\s*;\s*/g).map(p => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    const a = parts[0];
    const b = parts.slice(1).join("; ");
    if (countWords(a) >= 6 && countWords(b) >= 6) return [a, b];
  }

  // Try splitting on " and " if it yields two substantial clauses
  const andParts = t.split(/\s+and\s+/i);
  if (andParts.length === 2) {
    const a = andParts[0].trim();
    const b = andParts[1].trim();
    if (countWords(a) >= 8 && countWords(b) >= 8) return [a + ".", b];
  }

  return [t];
}

function compressBulletToWordRange(text: string, range: { min: number; max: number }): string {
  let t = sanitizeText(text);
  t = t.replace(/\([^)]*\)/g, "").replace(/\[[^\]]*\]/g, "");
  t = t.replace(/\s{2,}/g, " ").trim();

  // Deterministic phrase compression
  const replacements: Array<[RegExp, string]> = [
    [/\bin order to\b/gi, "to"],
    [/\bas well as\b/gi, "and"],
    [/\bin addition to\b/gi, "and"],
    [/\bresponsible for\b/gi, "led"],
    [/\bworked on\b/gi, "built"],
    [/\butilized\b/gi, "used"],
    [/\bleveraged\b/gi, "used"],
  ];
  for (const [re, rep] of replacements) t = t.replace(re, rep);
  t = t.replace(/\s{2,}/g, " ").trim();

  const wc = countWords(t);
  if (wc <= range.max) return t;
  // Last resort: clamp to max words
  return clampWords(t, range.max);
}

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function mergeBulletsToCount(bullets: PdfBullet[], targetCount: number): PdfBullet[] {
  const texts = bullets.map(b => b.lines.join(" ").trim()).filter(Boolean);
  if (texts.length <= targetCount) return texts.map(t => ({ lines: [t] }));
  if (targetCount <= 0) return [{ lines: [texts.join("; ")] }];

  const buckets: string[][] = Array.from({ length: targetCount }, () => []);
  for (let i = 0; i < texts.length; i++) {
    buckets[i % targetCount].push(texts[i]);
  }
  return buckets.map(parts => ({ lines: [parts.join("; ")] }));
}

// -----------------------------
// Pagination + Measurement
// -----------------------------

type MeasuredPage = {
  blocks: Array<{ block: LayoutBlock; yTop: number }>; // yTop in page coordinates (top-down)
  usedHeight: number;
};

function paginate(model: PdfModel, styles: ReturnType<typeof makeStyles>, opts: { tight?: boolean } = {}): MeasuredPage[] {
  const tight = !!opts.tight;
  const gapSection = Math.max(8, GAP_BETWEEN_SECTIONS - (tight ? 2 : 0));
  const gapHeadingToContentDefault = Math.max(6, GAP_HEADING_TO_CONTENT - (tight ? 2 : 0));

  const blocks: LayoutBlock[] = [];
  const headerLayout = layoutHeader(model.header, styles);
  blocks.push({ kind: "header", height: measureHeaderLayout(headerLayout), data: headerLayout });

  for (const s of model.sections) {
    const prepared = prepareSection(s.items, styles);
    const gapHeadingToContent = s.title === "PROJECTS" ? PROJECTS_GAP_AFTER_HEADER_PT : gapHeadingToContentDefault;
    const chunks = chunkSectionItems(prepared.items, prepared.itemHeights, {
      title: s.title,
      headingHeight: prepared.headingHeight,
      gapHeadingToContent,
    });

    for (const chunk of chunks) {
      blocks.push({ kind: "section", title: s.title, height: chunk.height, items: chunk.items });
    }
  }

  const pages: MeasuredPage[] = [];
  let pageBlocks: MeasuredPage["blocks"] = [];
  let used = 0;

  const pushPage = () => {
    pages.push({ blocks: pageBlocks, usedHeight: used });
    pageBlocks = [];
    used = 0;
  };

  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    const isFirstBlock = pages.length === 0 && pageBlocks.length === 0;
    const extraGap = !isFirstBlock ? gapSection : 0;
    const needed = b.height + extraGap;

    // Header only on first page
    if (b.kind === "header" && pages.length > 0) {
      continue;
    }

    if (used + needed > CONTENT_HEIGHT_PT && pageBlocks.length > 0) {
      pushPage();
    }

    // If block itself bigger than page, we still place it (won't happen with our constraints)
    const yTop = MARGIN_PT + used + (pageBlocks.length ? extraGap : 0);
    used += needed;
    pageBlocks.push({ block: b, yTop });
  }

  if (pageBlocks.length) pushPage();
  return pages;
}

// -----------------------------
// Strict 2-page pagination policy
// -----------------------------

function paginateTwoPages(model: PdfModel, styles: ReturnType<typeof makeStyles>): MeasuredPage[] {
  // Deterministic allocation:
  // Page 1: Header + Summary + 1-2 most recent experience roles (as space allows)
  // Page 2: Remaining experience + Projects + Skills + Education + Certifications

  const gapSection = GAP_BETWEEN_SECTIONS;
  const gapHeadingToContentDefault = GAP_HEADING_TO_CONTENT;

  const sectionsByTitle = new Map(model.sections.map(s => [s.title, s] as const));
  const summary = sectionsByTitle.get("SUMMARY");
  const experience = sectionsByTitle.get("EXPERIENCE");

  const otherTitles = ["PROJECTS", "SKILLS", "EDUCATION", "CERTIFICATIONS"].filter(t => sectionsByTitle.has(t));

  // Prepare measured items for each section
  const headerLayout = layoutHeader(model.header, styles);
  const headerBlock: LayoutBlock = { kind: "header", height: measureHeaderLayout(headerLayout), data: headerLayout };

  const makeSectionChunks = (title: string, items: PdfSectionItem[]) => {
    const prepared = prepareSection(items, styles);
    const gapHeadingToContent = title === "PROJECTS" ? PROJECTS_GAP_AFTER_HEADER_PT : gapHeadingToContentDefault;
    return chunkSectionItems(prepared.items, prepared.itemHeights, {
      title,
      headingHeight: prepared.headingHeight,
      gapHeadingToContent,
    }).map(c => ({ kind: "section" as const, title, height: c.height, items: c.items }));
  };

  const summaryChunks = summary ? makeSectionChunks(summary.title, summary.items) : [];

  // Experience chunks: build per-job blocks so we can place 1-2 roles on page 1 deterministically.
  const expItems = (experience?.items || []).filter(i => i.kind === "job") as Array<Extract<PdfSectionItem, { kind: "job" }>>;
  const preparedExp = prepareSection(expItems, styles);
  const expItemHeights = preparedExp.itemHeights;

  const expJobBlocks = expItems.map((_, idx) => {
    const singlePrepared = preparedExp.items[idx] as Extract<PdfSectionItem, { kind: "job" }>;
    const h = expItemHeights[idx] ?? 0;
    // Represent each job as its own chunked section so it never splits.
    return { kind: "section" as const, title: "EXPERIENCE", height: preparedExp.headingHeight + gapHeadingToContentDefault + h, items: [singlePrepared] };
  });

  const otherBlocks: LayoutBlock[] = [];
  for (const t of otherTitles) {
    const s = sectionsByTitle.get(t)!;
    otherBlocks.push(...makeSectionChunks(s.title, s.items));
  }

  // Page 1 packing
  const page1Blocks: Array<{ block: LayoutBlock; yTop: number }> = [];
  let used1 = 0;

  const placeOnPage1 = (block: LayoutBlock) => {
    const isFirst = page1Blocks.length === 0;
    const extraGap = !isFirst ? gapSection : 0;
    const needed = block.height + extraGap;
    const yTop = MARGIN_PT + used1 + (page1Blocks.length ? extraGap : 0);
    used1 += needed;
    page1Blocks.push({ block, yTop });
  };

  placeOnPage1(headerBlock);

  // Summary always on page 1 if present
  for (const b of summaryChunks) {
    if (used1 + gapSection + b.height <= CONTENT_HEIGHT_PT) {
      placeOnPage1(b);
    } else {
      // Summary should be short; if it doesn't fit, still place it (will overflow; adaptation should prevent this).
      placeOnPage1(b);
      break;
    }
  }

  // Place 1-2 most recent roles as space allows (deterministic)
  let placedJobs = 0;
  for (const jb of expJobBlocks) {
    if (placedJobs >= 2) break;
    const needed = gapSection + jb.height;
    if (used1 + needed <= CONTENT_HEIGHT_PT || placedJobs === 0) {
      placeOnPage1(jb);
      placedJobs++;
    }
  }

  // Page 2 packing (no header)
  const page2Blocks: Array<{ block: LayoutBlock; yTop: number }> = [];
  let used2 = 0;
  const placeOnPage2 = (block: LayoutBlock) => {
    const isFirst = page2Blocks.length === 0;
    const extraGap = !isFirst ? gapSection : 0;
    const needed = block.height + extraGap;
    const yTop = MARGIN_PT + used2 + (page2Blocks.length ? extraGap : 0);
    used2 += needed;
    page2Blocks.push({ block, yTop });
  };

  // Remaining experience roles
  for (let i = placedJobs; i < expJobBlocks.length; i++) {
    placeOnPage2(expJobBlocks[i]);
  }

  // Other sections always on page 2
  for (const b of otherBlocks) {
    placeOnPage2(b);
  }

  const pages: MeasuredPage[] = [];
  pages.push({ blocks: page1Blocks, usedHeight: used1 });
  pages.push({ blocks: page2Blocks, usedHeight: used2 });

  // If page2 overflowed, return 3rd page via general paginator so adaptation can detect.
  if (used2 > CONTENT_HEIGHT_PT) {
    return paginate(model, styles);
  }

  // If page1 overflowed (shouldn't), fall back to general paginator.
  if (used1 > CONTENT_HEIGHT_PT) {
    return paginate(model, styles);
  }

  return pages;
}

function chunkSectionItems(
  items: PdfSectionItem[],
  itemHeights: number[],
  opts: { title: string; headingHeight: number; gapHeadingToContent: number }
): Array<{ items: PdfSectionItem[]; height: number }> {
  const chunks: Array<{ items: PdfSectionItem[]; height: number }> = [];

  // Section overhead (heading + gap) is repeated per chunk to keep context ATS-friendly.
  const overhead = opts.headingHeight + opts.gapHeadingToContent;

  let currentItems: PdfSectionItem[] = [];
  let currentHeight = overhead;

  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const h = itemHeights[i] ?? 0;
    const intraGap = currentItems.length ? 6 : 0;
    const candidate = currentHeight + intraGap + h;

    // If adding would exceed a page, flush current chunk
    if (currentItems.length && candidate > CONTENT_HEIGHT_PT) {
      chunks.push({ items: currentItems, height: currentHeight });
      currentItems = [];
      currentHeight = overhead;
    }

    // Add item (even if it alone is tall; we avoid infinite loops)
    currentHeight += (currentItems.length ? 6 : 0) + h;
    currentItems.push(it);
  }

  if (currentItems.length) {
    chunks.push({ items: currentItems, height: currentHeight });
  }

  return chunks;
}

function measureHeaderLayout(layout: PdfHeaderLayout): number {
  const titleLineHeight = layout.titleFontSize === HEADER_TITLE_FONT_SIZE ? HEADER_TITLE_LINE_HEIGHT : HEADER_TITLE_LINE_HEIGHT - 0.5;
  const contactLines = Math.max(0, Math.min(2, layout.contactLines.length));
  return HEADER_NAME_LINE_HEIGHT + titleLineHeight + HEADER_GAP_TITLE_TO_CONTACT + contactLines * HEADER_CONTACT_LINE_HEIGHT;
}

function layoutHeader(header: PdfHeader, styles: ReturnType<typeof makeStyles>): PdfHeaderLayout {
  const nameLine = sanitizeText(header.name).trim() || "Your Name";

  // Title rules: single line, max 90 chars, width <= 482pt; only title can be shortened.
  let titleFontSize = HEADER_TITLE_FONT_SIZE;
  let titleLine = sanitizeText(header.title).trim();
  if (!titleLine) titleLine = "Software Engineer";
  titleLine = clampTitleText(titleLine, 90);

  titleLine = fitTitleToWidth(styles, titleLine, titleFontSize);

  // Contact items in strict priority order; no icons, plain text, never truncate URLs.
  const items = {
    email: sanitizeText(header.contact.email || "").trim(),
    phone: sanitizeText(header.contact.phone || "").trim(),
    location: sanitizeText(header.contact.location || "").trim(),
    linkedin: sanitizeText(header.contact.linkedin || "").trim(),
    github: sanitizeText(header.contact.github || "").trim(),
    portfolio: sanitizeText(header.contact.portfolio || "").trim(),
  };

  const line3 = [items.email, items.phone, items.location].filter(Boolean);
  const line4 = [items.linkedin, items.github, items.portfolio].filter(Boolean);

  const packed = packContactLines(styles, line3, line4);

  // Auto-fix rules: if header exceeds 55pt, shorten title further, then reduce title font size by 0.5pt.
  let layout: PdfHeaderLayout = { nameLine, titleLine, titleFontSize, contactLines: packed };
  if (measureHeaderLayout(layout) > HEADER_MAX_HEIGHT_PT) {
    // 1) shorten title (not name)
    titleLine = fitTitleToWidth(styles, titleLine, titleFontSize, { aggressive: true });
    layout = { nameLine, titleLine, titleFontSize, contactLines: packed };
  }
  if (measureHeaderLayout(layout) > HEADER_MAX_HEIGHT_PT) {
    // 3) reduce title font size by max 0.5pt
    titleFontSize = HEADER_TITLE_FONT_SIZE_MIN;
    titleLine = fitTitleToWidth(styles, titleLine, titleFontSize, { aggressive: true });
    layout = { nameLine, titleLine, titleFontSize, contactLines: packed };
  }

  // Deterministic final check. If somehow over budget, we still return a layout that preserves data
  // and will render consistently (preview==PDF). Realistically, with 2 contact lines it fits.
  return layout;
}

function clampTitleText(text: string, maxChars: number): string {
  const t = (text || "").trim();
  if (t.length <= maxChars) return t;
  // Prefer trimming from the end without losing readability.
  return t.slice(0, maxChars).trimEnd().replace(/[;,:-]?$/, "") + "...";
}

function fitTitleToWidth(
  styles: ReturnType<typeof makeStyles>,
  title: string,
  fontSize: number,
  opts: { aggressive?: boolean } = {}
): string {
  const font = styles.body.font;
  const maxWidth = HEADER_MAX_WIDTH_PT;
  let t = clampTitleText(title, 90);
  if (font.widthOfTextAtSize(t, fontSize) <= maxWidth) return t;

  // First attempt: drop trailing "| skills" content if present.
  if (t.includes("|")) {
    const left = t.split("|")[0]?.trim();
    if (left && font.widthOfTextAtSize(left, fontSize) <= maxWidth) return left;
  }

  // Aggressive: remove everything after first separator (comma / dash) to keep ATS keywords minimal.
  if (opts.aggressive) {
    const cutAt = [",", "-", "—"].map(sep => t.indexOf(sep)).filter(i => i > 0).sort((a, b) => a - b)[0];
    if (typeof cutAt === "number") {
      const candidate = t.slice(0, cutAt).trim();
      if (candidate && font.widthOfTextAtSize(candidate, fontSize) <= maxWidth) return candidate;
    }
  }

  // Final: truncate to width with ellipsis (title can be shortened; URLs cannot).
  return truncateToWidth(font, fontSize, t, maxWidth);
}

function packContactLines(
  styles: ReturnType<typeof makeStyles>,
  preferredLine3: string[],
  preferredLine4: string[]
): string[] {
  const font = styles.meta.font;
  const size = HEADER_CONTACT_FONT_SIZE;
  const maxWidth = HEADER_MAX_WIDTH_PT;

  const l3 = [...preferredLine3].slice(0, 3);
  const l4 = [...preferredLine4].slice(0, 3);

  const join = (parts: string[], tight: boolean) => parts.join(tight ? "|" : " | ");
  const width = (parts: string[], tight: boolean) => font.widthOfTextAtSize(join(parts, tight), size);

  // We guarantee max 2 lines and <=3 items/line.
  // If a line exceeds width, move the last item to the other line if possible.
  const rebalance = () => {
    for (let i = 0; i < 6; i++) {
      if (l3.length > 1 && width(l3, false) > maxWidth && l4.length < 3) {
        l4.unshift(l3.pop() as string);
        continue;
      }
      if (l4.length > 1 && width(l4, false) > maxWidth && l3.length < 3) {
        l3.push(l4.pop() as string);
        continue;
      }
      break;
    }
  };

  rebalance();

  // If still too wide, remove spaces around separators as a deterministic last resort.
  const line3Tight = width(l3, false) > maxWidth ? true : false;
  const line4Tight = width(l4, false) > maxWidth ? true : false;

  // Final lines (never truncate items)
  const out: string[] = [];
  if (l3.length) out.push(join(l3, line3Tight));
  if (l4.length) out.push(join(l4, line4Tight));

  return out;
}

function prepareSection(items: PdfSectionItem[], styles: ReturnType<typeof makeStyles>): { headingHeight: number; items: PdfSectionItem[]; itemHeights: number[] } {
  const headingHeight = styles.heading.lineHeight;

  // Measure each item block; we keep items intact for pagination boundaries.
  const measuredItems: PdfSectionItem[] = items.map((it) => {
    if (it.kind === "paragraph") {
      const text = it.lines.join("\n");
      const lines = wrapText(styles.body.font, styles.body.size, text, CONTENT_WIDTH_PT);
      return { ...it, lines };
    }

    if (it.kind === "skills") {
      // Strict: skills lines are pre-computed; never auto-wrap.
      return { ...it, lines: it.lines.map(l => sanitizeText(l).trim()).filter(Boolean).slice(0, SKILLS_MAX_LINES) };
    }

    if (it.kind === "educationEntry") {
      return it;
    }

    if (it.kind === "job") {
      const job = it.job;
      const bullets = job.bullets.map(b => {
        const lines = wrapText(styles.bullet.font, styles.bullet.size, b.lines.join(" "), CONTENT_WIDTH_PT - bulletIndentPt(styles));
        return { lines };
      });
      return { ...it, job: { ...job, bullets } };
    }

    if (it.kind === "projects") {
      const project = it.project;
      const title = shortenProjectTitle(styles, project.title);
      const bullets = project.bullets.map(b => {
        const lines = wrapText(styles.bullet.font, styles.bullet.size, b.lines.join(" "), CONTENT_WIDTH_PT - bulletIndentPt(styles));
        return { lines };
      });
      return { ...it, project: { ...project, title, bullets: bullets.slice(0, PROJECT_BULLETS_MAX) } };
    }

    if (it.kind === "bullets") {
      const bullets = it.bullets.map(b => {
        const lines = wrapText(styles.bullet.font, styles.bullet.size, b.lines.join(" "), CONTENT_WIDTH_PT - bulletIndentPt(styles));
        return { lines };
      });
      return { ...it, bullets };
    }

    return it;
  });

  const itemHeights = measuredItems.map((it) => measureItem(it, styles));

  return { headingHeight, items: measuredItems, itemHeights };
}

function measureItem(item: PdfSectionItem, styles: ReturnType<typeof makeStyles>): number {
  if (item.kind === "paragraph") {
    // SUMMARY contract: content max height 70pt (enforced upstream); keep measurement exact.
    return item.lines.length * styles.body.lineHeight;
  }
  if (item.kind === "skills") {
    return item.lines.length * styles.body.lineHeight;
  }
  if (item.kind === "educationEntry") {
    return EDUCATION_ENTRY_HEIGHT_PT;
  }
  if (item.kind === "job") {
    const bulletsH = measureBullets(item.job.bullets, styles);
    return ROLE_HEADER_HEIGHT_PT + ROLE_GAP_AFTER_HEADER_PT + bulletsH;
  }
  if (item.kind === "projects") {
    const bulletsH = measureBullets(item.project.bullets.slice(0, PROJECT_BULLETS_MAX), styles);
    return styles.projectTitle.lineHeight + PROJECT_TITLE_TO_BULLETS_GAP_PT + bulletsH;
  }
  if (item.kind === "bullets") {
    return measureBullets(item.bullets, styles);
  }
  return 0;
}

function measureBullets(bullets: PdfBullet[], styles: ReturnType<typeof makeStyles>): number {
  if (!bullets.length) return 0;
  let h = 0;
  for (let i = 0; i < bullets.length; i++) {
    const b = bullets[i];
    const linesH = b.lines.length * styles.bullet.lineHeight;
    h += linesH;
    if (i !== bullets.length - 1) h += GAP_BETWEEN_BULLETS;
  }
  return h;
}

// -----------------------------
// Rendering
// -----------------------------

function render(pdfDoc: PDFDocument, pages: MeasuredPage[], styles: ReturnType<typeof makeStyles>) {
  for (let p = 0; p < pages.length; p++) {
    const page = pdfDoc.addPage([A4_WIDTH_PT, A4_HEIGHT_PT]);

    for (const placed of pages[p].blocks) {
      const { block, yTop } = placed;
      const x = MARGIN_PT;
      let y = A4_HEIGHT_PT - yTop; // convert top-down to PDF bottom-up baseline reference

      if (block.kind === "header") {
        y = drawHeader(page, x, y, block.data, styles);
        continue;
      }

      if (block.kind === "section") {
        y = drawSection(page, x, y, block.title, block.items, styles);
        continue;
      }
    }

    // Optional page numbers (ATS-safe)
    if (pages.length > 1) {
      const label = `${p + 1}`;
      page.drawText(label, {
        x: A4_WIDTH_PT - MARGIN_PT - styles.meta.font.widthOfTextAtSize(label, styles.meta.size),
        y: MARGIN_PT - 18,
        font: styles.meta.font,
        size: styles.meta.size,
        color: rgb(0.2, 0.2, 0.2),
      });
    }
  }
}

function drawHeader(page: any, x: number, yTopFromBottom: number, header: PdfHeaderLayout, styles: ReturnType<typeof makeStyles>): number {
  let y = yTopFromBottom;

  // Line 1: NAME (single line, no truncation expected)
  page.drawText(header.nameLine, {
    x,
    y: y - HEADER_NAME_LINE_HEIGHT,
    font: styles.name.font,
    size: HEADER_NAME_FONT_SIZE,
    color: rgb(0, 0, 0),
  });
  y -= HEADER_NAME_LINE_HEIGHT;

  // Line 2: TITLE (single line, shortened as needed)
  const titleLineHeight = header.titleFontSize === HEADER_TITLE_FONT_SIZE ? HEADER_TITLE_LINE_HEIGHT : HEADER_TITLE_LINE_HEIGHT - 0.5;
  page.drawText(header.titleLine, {
    x,
    y: y - titleLineHeight,
    font: styles.body.font,
    size: header.titleFontSize,
    color: rgb(0.1, 0.1, 0.1),
  });
  y -= titleLineHeight;

  // Small deterministic gap (represents the blank line in the reference layout)
  y -= HEADER_GAP_TITLE_TO_CONTACT;

  // Lines 3-4: CONTACT (max 2 lines, max 3 items each, URLs never truncated)
  const contactLines = header.contactLines.slice(0, 2);
  for (const line of contactLines) {
    page.drawText(line, {
      x,
      y: y - HEADER_CONTACT_LINE_HEIGHT,
      font: styles.meta.font,
      size: HEADER_CONTACT_FONT_SIZE,
      color: rgb(0.2, 0.2, 0.2),
    });
    y -= HEADER_CONTACT_LINE_HEIGHT;
  }

  return y;
}

function drawSection(page: any, x: number, yTopFromBottom: number, title: string, items: PdfSectionItem[], styles: ReturnType<typeof makeStyles>): number {
  let y = yTopFromBottom;

  // Heading
  page.drawText(title, {
    x,
    y: y - styles.heading.lineHeight,
    font: styles.heading.font,
    size: styles.heading.size,
    color: rgb(0, 0, 0),
  });
  y -= styles.heading.lineHeight;
  y -= title === "PROJECTS" ? PROJECTS_GAP_AFTER_HEADER_PT : GAP_HEADING_TO_CONTENT;

  for (let i = 0; i < items.length; i++) {
    const it = items[i];

    if (it.kind === "paragraph") {
      y = drawLines(page, x, y, it.lines, styles.body);
    } else if (it.kind === "skills") {
      y = drawLines(page, x, y, it.lines, styles.body);
    } else if (it.kind === "educationEntry") {
      y = drawEducationEntry(page, x, y, it.entry, styles);
    } else if (it.kind === "job") {
      y = drawJob(page, x, y, it.job, styles);
    } else if (it.kind === "projects") {
      y = drawProject(page, x, y, it.project, styles);
    } else if (it.kind === "bullets") {
      y = drawBullets(page, x, y, it.bullets, styles);
    }

    if (i !== items.length - 1) y -= 6;
  }

  return y;
}

function drawEducationEntry(page: any, x: number, yTopFromBottom: number, entry: PdfEducation, styles: ReturnType<typeof makeStyles>): number {
  let y = yTopFromBottom;
  const l1 = truncateToWidth(styles.body.font, styles.body.size, entry.line1, CONTENT_WIDTH_PT);
  const l2 = truncateToWidth(styles.body.font, styles.body.size, entry.line2, CONTENT_WIDTH_PT);

  page.drawText(l1, {
    x,
    y: y - styles.body.lineHeight,
    font: styles.body.font,
    size: styles.body.size,
    color: rgb(0.15, 0.15, 0.15),
  });

  page.drawText(l2, {
    x,
    y: y - styles.body.lineHeight - 2 - styles.body.lineHeight,
    font: styles.body.font,
    size: styles.body.size,
    color: rgb(0.15, 0.15, 0.15),
  });

  y -= EDUCATION_ENTRY_HEIGHT_PT;
  return y;
}

function drawLines(page: any, x: number, yTopFromBottom: number, lines: string[], style: TextStyle): number {
  let y = yTopFromBottom;
  for (const line of lines) {
    page.drawText(line, {
      x,
      y: y - style.lineHeight,
      font: style.font,
      size: style.size,
      color: style.color || rgb(0.15, 0.15, 0.15),
    });
    y -= style.lineHeight;
  }
  return y;
}

function drawJob(page: any, x: number, yTopFromBottom: number, job: PdfJob, styles: ReturnType<typeof makeStyles>): number {
  let y = yTopFromBottom;

  // Fixed role header height (30–34pt) with deterministic internal layout.
  const leftMaxW = CONTENT_WIDTH_PT * 0.72;
  const rightMaxW = CONTENT_WIDTH_PT * 0.28;

  const leftText = fitRoleCompanySingleLine(styles.jobTitle.font, styles.jobTitle.size, job.role, job.company, leftMaxW);
  const rightText = truncateToWidth(styles.meta.font, styles.meta.size, job.dates, rightMaxW);

  const line1H = styles.jobTitle.lineHeight;
  const line2H = styles.meta.lineHeight;
  const gapBetween = Math.max(2, ROLE_HEADER_HEIGHT_PT - line1H - line2H);

  // Line 1
  page.drawText(leftText, {
    x,
    y: y - line1H,
    font: styles.jobTitle.font,
    size: styles.jobTitle.size,
    color: rgb(0, 0, 0),
  });

  const rightWidth = styles.meta.font.widthOfTextAtSize(rightText, styles.meta.size);
  page.drawText(rightText, {
    x: x + CONTENT_WIDTH_PT - rightWidth,
    y: y - line1H + 2,
    font: styles.meta.font,
    size: styles.meta.size,
    color: rgb(0.25, 0.25, 0.25),
  });

  // Line 2 (location; deterministic spacing even if empty)
  const loc = job.location ? truncateToWidth(styles.meta.font, styles.meta.size, job.location, CONTENT_WIDTH_PT) : "";
  page.drawText(loc, {
    x,
    y: y - line1H - gapBetween - line2H,
    font: styles.meta.font,
    size: styles.meta.size,
    color: rgb(0.25, 0.25, 0.25),
  });

  y -= ROLE_HEADER_HEIGHT_PT;
  y -= ROLE_GAP_AFTER_HEADER_PT;

  y = drawBullets(page, x, y, job.bullets, styles);
  return y;
}

function fitRoleCompanySingleLine(font: PDFFont, fontSize: number, role: string, company: string, maxWidth: number): string {
  const r = sanitizeText(role).trim();
  const c0 = sanitizeText(company).trim();
  if (!c0) {
    return truncateToWidth(font, fontSize, r, maxWidth);
  }

  // Role title must remain single line. Prefer abbreviating/truncating company only.
  const companyCandidates = buildCompanyCandidates(c0);
  for (const c of companyCandidates) {
    const left = [r, c].filter(Boolean).join(", ");
    if (font.widthOfTextAtSize(left, fontSize) <= maxWidth) return left;
  }

  // If role itself is too long, apply a small set of safe abbreviations, then truncate.
  const roleAbbrev = abbreviateRoleTitle(r);
  const left2 = [roleAbbrev, companyCandidates[0]].filter(Boolean).join(", ");
  if (font.widthOfTextAtSize(left2, fontSize) <= maxWidth) return left2;

  // Last resort: truncate company first, then role.
  const companyTrunc = truncateToWidth(font, fontSize, companyCandidates[0], Math.max(40, maxWidth - font.widthOfTextAtSize(roleAbbrev + ", ", fontSize)));
  const left3 = [roleAbbrev, companyTrunc].filter(Boolean).join(", ");
  if (font.widthOfTextAtSize(left3, fontSize) <= maxWidth) return left3;
  return truncateToWidth(font, fontSize, roleAbbrev, maxWidth);
}

function buildCompanyCandidates(company: string): string[] {
  const base = sanitizeText(company).trim();
  const stripped = stripCompanySuffixes(base);
  const compacted = abbreviateCompanyWords(stripped);
  const candidates = [base, stripped, compacted].map(s => s.trim()).filter(Boolean);
  // Deduplicate deterministically
  const seen = new Set<string>();
  const out: string[] = [];
  for (const c of candidates) {
    const k = c.toLowerCase();
    if (!seen.has(k)) {
      seen.add(k);
      out.push(c);
    }
  }
  return out.length ? out : [base];
}

function stripCompanySuffixes(company: string): string {
  let t = company;
  t = t.replace(/\b(incorporated|inc\.?|corp\.?|corporation|ltd\.?|limited|llc|plc|gmbh|s\.a\.?|s\.p\.a\.?|pvt\.?|private|co\.?|company)\b/gi, "");
  t = t.replace(/\s{2,}/g, " ").replace(/\s+,/g, ",").replace(/,\s*,/g, ", ").trim();
  t = t.replace(/[,\-–—]+\s*$/g, "").trim();
  return t;
}

function abbreviateCompanyWords(company: string): string {
  const map = new Map<string, string>([
    ["international", "Intl"],
    ["technologies", "Tech"],
    ["technology", "Tech"],
    ["systems", "Sys"],
    ["solutions", "Soln"],
    ["services", "Svcs"],
    ["management", "Mgmt"],
    ["development", "Dev"],
    ["engineering", "Eng"],
    ["corporation", "Corp"],
    ["university", "Univ"],
  ]);

  const parts = company.split(/\s+/g).filter(Boolean);
  const out = parts.map(p => {
    const key = p.toLowerCase().replace(/[^a-z]/g, "");
    return map.get(key) || p;
  });
  return out.join(" ").replace(/\s{2,}/g, " ").trim();
}

function abbreviateRoleTitle(role: string): string {
  const map = new Map<string, string>([
    ["senior", "Sr"],
    ["junior", "Jr"],
    ["principal", "Prin"],
    ["engineer", "Eng"],
    ["developer", "Dev"],
    ["manager", "Mgr"],
    ["architect", "Arch"],
    ["specialist", "Spec"],
  ]);

  const parts = role.split(/\s+/g).filter(Boolean);
  const out = parts.map(p => {
    const key = p.toLowerCase().replace(/[^a-z]/g, "");
    return map.get(key) || p;
  });
  return out.join(" ").replace(/\s{2,}/g, " ").trim();
}

function drawProject(page: any, x: number, yTopFromBottom: number, project: PdfProject, styles: ReturnType<typeof makeStyles>): number {
  let y = yTopFromBottom;
  const title = truncateToWidth(styles.projectTitle.font, styles.projectTitle.size, project.title, CONTENT_WIDTH_PT);
  page.drawText(title, {
    x,
    y: y - styles.projectTitle.lineHeight,
    font: styles.projectTitle.font,
    size: styles.projectTitle.size,
    color: rgb(0, 0, 0),
  });
  y -= styles.projectTitle.lineHeight;
  y -= PROJECT_TITLE_TO_BULLETS_GAP_PT;
  y = drawBullets(page, x, y, project.bullets.slice(0, PROJECT_BULLETS_MAX), styles);
  return y;
}

function drawBullets(page: any, x: number, yTopFromBottom: number, bullets: PdfBullet[], styles: ReturnType<typeof makeStyles>): number {
  let y = yTopFromBottom;
  const indent = bulletIndentPt(styles);

  for (let i = 0; i < bullets.length; i++) {
    const b = bullets[i];
    const lines = b.lines;
    if (!lines.length) continue;

    for (let li = 0; li < lines.length; li++) {
      const isFirst = li === 0;
      const prefix = isFirst ? "-" : "";
      if (isFirst) {
        page.drawText(prefix, {
          x,
          y: y - styles.bullet.lineHeight,
          font: styles.bullet.font,
          size: styles.bullet.size,
          color: rgb(0.15, 0.15, 0.15),
        });
      }

      page.drawText(lines[li], {
        x: x + indent,
        y: y - styles.bullet.lineHeight,
        font: styles.bullet.font,
        size: styles.bullet.size,
        color: rgb(0.15, 0.15, 0.15),
      });
      y -= styles.bullet.lineHeight;
    }

    if (i !== bullets.length - 1) y -= GAP_BETWEEN_BULLETS;
  }

  return y;
}

function bulletIndentPt(styles: ReturnType<typeof makeStyles>): number {
  // Enough space for "- " and alignment
  const dashW = styles.bullet.font.widthOfTextAtSize("- ", styles.bullet.size);
  return Math.max(12, dashW + 6);
}

// -----------------------------
// Text measurement / wrapping
// -----------------------------

function wrapText(font: PDFFont, fontSize: number, text: string, maxWidth: number): string[] {
  const paragraphs = (text || "").split(/\r?\n+/g).map(p => p.trim()).filter(Boolean);
  if (!paragraphs.length) return [];

  const lines: string[] = [];
  for (const para of paragraphs) {
    const words = para.split(/\s+/g).filter(Boolean);
    let current = "";

    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, fontSize) <= maxWidth) {
        current = candidate;
        continue;
      }

      // push current line
      if (current) lines.push(current);
      // if single word too long, hard-break
      if (font.widthOfTextAtSize(word, fontSize) > maxWidth) {
        lines.push(...hardBreakWord(font, fontSize, word, maxWidth));
        current = "";
      } else {
        current = word;
      }
    }

    if (current) lines.push(current);
  }

  return lines;
}

function hardBreakWord(font: PDFFont, fontSize: number, word: string, maxWidth: number): string[] {
  const out: string[] = [];
  let w = word;
  while (w.length) {
    let cut = Math.min(w.length, 16);
    while (cut > 1 && font.widthOfTextAtSize(w.slice(0, cut), fontSize) > maxWidth) {
      cut--;
    }
    out.push(w.slice(0, cut));
    w = w.slice(cut);
  }
  return out;
}

function truncateToWidth(font: PDFFont, fontSize: number, text: string, maxWidth: number): string {
  const t = (text || "").trim();
  if (!t) return "";
  if (font.widthOfTextAtSize(t, fontSize) <= maxWidth) return t;

  const ell = "...";
  const ellW = font.widthOfTextAtSize(ell, fontSize);
  let lo = 0;
  let hi = t.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    const cand = t.slice(0, mid);
    if (font.widthOfTextAtSize(cand, fontSize) + ellW <= maxWidth) lo = mid;
    else hi = mid - 1;
  }
  return `${t.slice(0, Math.max(0, lo)).trimEnd()}${ell}`;
}

// -----------------------------
// Text sanitization + compression
// -----------------------------

function sanitizeText(input: string): string {
  const s = (input || "").replace(/\s+/g, " ").trim();
  if (!s) return "";

  // Remove emojis and pictographs (ATS safe)
  // Uses Unicode property escapes (supported in modern browsers)
  let out = s;
  try {
    out = out.replace(/\p{Extended_Pictographic}+/gu, "");
  } catch {
    // Fallback: remove common surrogate-pair emoji range
    out = out.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, "");
  }

  // Normalize bullets/symbols to plain text
  out = out.replace(/[•●▪◦]/g, "-");

  // Remove weird control chars
  out = out.replace(/[\u0000-\u001F\u007F]/g, " ");

  // Collapse spaces again
  out = out.replace(/\s+/g, " ").trim();
  return out;
}

function countWords(text: string): number {
  const t = (text || "").trim();
  if (!t) return 0;
  return t.split(/\s+/g).filter(Boolean).length;
}

function clampWords(text: string, maxWords: number): string {
  const words = (text || "").trim().split(/\s+/g).filter(Boolean);
  if (words.length <= maxWords) return (text || "").trim();
  return words.slice(0, maxWords).join(" ").replace(/[;,:-]?$/, "") + ".";
}

function compressToWordBudget(text: string, opts: { target: number; max: number }): string {
  let t = sanitizeText(text);

  // Remove parentheticals to compress while preserving meaning
  t = t.replace(/\([^)]*\)/g, "").replace(/\[[^\]]*\]/g, "");
  t = t.replace(/\s+/g, " ").trim();

  const wc = countWords(t);
  if (wc <= opts.max) return t;

  // Prefer truncating to max; target used only for intent
  return clampWords(t, opts.max);
}

function safeFilename(name: string): string {
  return (name || "Resume").trim().replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_\-]/g, "").slice(0, 64) || "Resume";
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

// -----------------------------
// Styles
// -----------------------------

function makeStyles(fontRegular: PDFFont, fontBold: PDFFont) {
  return {
    name: { font: fontBold, size: FONT_SIZE_NAME, lineHeight: FONT_SIZE_NAME * 1.1 } satisfies TextStyle,
    heading: { font: fontBold, size: FONT_SIZE_HEADING, lineHeight: FONT_SIZE_HEADING * LH_HEADING } satisfies TextStyle,
    body: { font: fontRegular, size: FONT_SIZE_BODY, lineHeight: FONT_SIZE_BODY * LH_BODY } satisfies TextStyle,
    bodyBold: { font: fontBold, size: FONT_SIZE_BODY, lineHeight: FONT_SIZE_BODY * LH_BODY } satisfies TextStyle,
    meta: { font: fontRegular, size: FONT_SIZE_META, lineHeight: FONT_SIZE_META * 1.1 } satisfies TextStyle,
    jobTitle: { font: fontBold, size: 12, lineHeight: 12 * LH_HEADING } satisfies TextStyle,
    projectTitle: { font: fontBold, size: PROJECT_TITLE_FONT_SIZE, lineHeight: PROJECT_TITLE_LINE_HEIGHT } satisfies TextStyle,
    bullet: { font: fontRegular, size: FONT_SIZE_BODY, lineHeight: FONT_SIZE_BODY * LH_BULLET } satisfies TextStyle,
  };
}

// Guard: margin rule (never reduce below 15mm)
export function assertMarginsOk(marginPt: number) {
  if (marginPt < MIN_MARGIN_PT) {
    throw new Error(`Margin ${marginPt}pt violates minimum ${MIN_MARGIN_PT}pt`);
  }
}
