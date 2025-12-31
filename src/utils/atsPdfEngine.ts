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
  | { kind: "education"; entry: PdfEducation }
  | { kind: "projects"; project: PdfProject }
  | { kind: "bullets"; bullets: PdfBullet[] };

type PdfBullet = { lines: string[] };

type PdfJob = {
  leftTitle: string; // Role, Company
  rightMeta: string; // Dates
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

  // 1) Build content model (sanitized)
  const baseModel = buildPdfModel(resume);

  // 2) Adapt to requested constraints
  const { model, modeUsed } = adaptToFit(baseModel, styles, requestedMode);

  // 3) Paginate deterministically based on policy
  const measuredPages = modeUsed === "two-page" ? paginateTwoPages(model, styles) : paginate(model, styles);

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
        const leftTitle = [sanitizeText(j.role || "").trim(), sanitizeText(j.company || "").trim()]
          .filter(Boolean)
          .join(", ");
        const rightMeta = sanitizeText(j.duration || "").trim();
        const location = sanitizeText(j.location || "").trim();
        const bulletsRaw = (j.achievements || []).map(a => sanitizeText(a || "").trim()).filter(Boolean);
        const bullets = bulletsRaw.map(b => ({ lines: [b] }));
        return { kind: "job", job: { leftTitle, rightMeta, location, bullets } } as const;
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

  // Skills (comma-separated)
  const skills = mergeAndDedupeSkills(resume);
  if (skills.length) {
    sections.push({
      title: "SKILLS",
      items: [{ kind: "skills", lines: [skills.join(", ")] }],
    });
  }

  // Education (2 lines)
  const edu = resume.education;
  if (edu?.institution || edu?.degree) {
    const degree = sanitizeText(edu.degree || "").trim();
    const institution = sanitizeText(edu.institution || "").trim();
    const year = sanitizeText(edu.year || "").trim();
    const cgpa = sanitizeText(edu.cgpa || "").trim();

    const line1 = [degree, institution].filter(Boolean).join(" — ");
    const line2 = [year, cgpa ? `CGPA: ${cgpa}` : ""].filter(Boolean).join(" | ");

    sections.push({
      title: "EDUCATION",
      items: [{ kind: "education", entry: { line1, line2 } }],
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

function mergeAndDedupeSkills(resume: ResumeProfile): string[] {
  const all = [
    ...(resume.skills?.programming_languages || []),
    ...(resume.skills?.frameworks || []),
    ...(resume.skills?.tools || []),
    ...(resume.skills?.databases || []),
    ...(resume.skills?.concepts || []),
  ]
    .map(s => sanitizeText(s || "").trim())
    .filter(Boolean);

  const seen = new Map<string, string>();
  for (const s of all) {
    const key = s.toLowerCase();
    if (!seen.has(key)) seen.set(key, s);
  }
  return Array.from(seen.values());
}

// -----------------------------
// Adaptation Logic (one-page compression)
// -----------------------------

function adaptToFit(base: PdfModel, styles: ReturnType<typeof makeStyles>, requestedMode: RequestedMode): { model: PdfModel; modeUsed: RequestedMode } {
  if (requestedMode === "multi-page") return { model: enforceConstraints(base), modeUsed: "multi-page" };

  if (requestedMode === "two-page") {
    // Start with conservative constraints (no data loss, only compression/merging)
    let model = enforceConstraints(base);

    // If it already fits in 2 pages with deterministic allocation, keep it.
    if (paginateTwoPages(model, styles).length <= 2) {
      return { model, modeUsed: "two-page" };
    }

    // Progressive compression until it fits within 2 pages.
    const steps: Array<(m: PdfModel) => PdfModel> = [
      (m) => compressExperienceBullets(m, 4),
      (m) => shortenAllBullets(m, { target: 18, max: 22 }),
      (m) => compressExperienceBullets(m, 3),
      (m) => clampSkills(m, 18),
      (m) => clampSummary(m, styles, { minWords: 40, maxWords: 60, maxLines: 4 }),
      // last resort: merge to 2 bullets per role (still preserves content, but more compressed)
      (m) => compressExperienceBullets(m, 2),
    ];

    for (const step of steps) {
      model = step(model);
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

  // 2) Apply one-page compression steps in order
  const steps: Array<(m: PdfModel) => PdfModel> = [
    // Reduce bullets per role (5 -> 3) by merging (preserve semantics)
    (m) => compressExperienceBullets(m, 3),
    // Condense bullet text toward ~18 words
    (m) => shortenAllBullets(m, { target: 18, max: 22 }),
    // Merge overlapping skills and clamp count
    (m) => clampSkills(m, 18),
    // Clamp summary word count / lines
    (m) => clampSummary(m, styles, { minWords: 40, maxWords: 60, maxLines: 4 }),
    // Reduce section gaps by 2pt if needed (handled at measurement time via tight flag)
  ];

  for (const step of steps) {
    model = step(model);
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
  const pagesTight = paginate(model, styles, { tight: true });
  if (pagesTight.length === 1 && pagesTight[0].usedHeight <= CONTENT_HEIGHT_PT) {
    return { model, modeUsed: "one-page" };
  }

  // Still overflow → switch to multi-page, keeping compressed content (no data loss)
  return { model, modeUsed: "multi-page" };
}

function enforceConstraints(model: PdfModel): PdfModel {
  // Clamp bullets per job to 5 by merging extras
  const sections = model.sections.map((s) => {
    if (s.title !== "EXPERIENCE") return s;
    return {
      ...s,
      items: s.items.map((it) => {
        if (it.kind !== "job") return it;
        const merged = mergeBulletsToCount(it.job.bullets, 5);
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

function clampSkills(model: PdfModel, maxSkills: number): PdfModel {
  const sections = model.sections.map((s) => {
    if (s.title !== "SKILLS") return s;
    const item = s.items.find(i => i.kind === "skills") as Extract<PdfSectionItem, { kind: "skills" }> | undefined;
    if (!item) return s;

    const raw = item.lines.join(" ");
    const parts = raw
      .split(",")
      .map(p => sanitizeText(p).trim())
      .filter(Boolean);

    const seen = new Map<string, string>();
    for (const p of parts) {
      const key = p.toLowerCase();
      if (!seen.has(key)) seen.set(key, p);
    }

    const clamped = Array.from(seen.values()).slice(0, maxSkills);
    return { ...s, items: [{ kind: "skills" as const, lines: [clamped.join(", ")] }] };
  });
  return { ...model, sections };
}

function clampSummary(model: PdfModel, styles: ReturnType<typeof makeStyles>, opts: { minWords: number; maxWords: number; maxLines: number }): PdfModel {
  const sections = model.sections.map((s) => {
    if (s.title !== "SUMMARY") return s;
    const item = s.items.find(i => i.kind === "paragraph") as Extract<PdfSectionItem, { kind: "paragraph" }> | undefined;
    if (!item) return s;

    const text = item.lines.join(" ");
    let clipped = clampWords(text, opts.maxWords);

    // Try to fit to max lines by measurement-based trimming
    for (let attempt = 0; attempt < 6; attempt++) {
      const lines = wrapText(styles.body.font, styles.body.size, clipped, CONTENT_WIDTH_PT);
      if (lines.length <= opts.maxLines) break;
      // Trim ~8% words each attempt, but not below minWords
      const wc = countWords(clipped);
      const next = Math.max(opts.minWords, Math.floor(wc * 0.92));
      clipped = clampWords(clipped, next);
      if (countWords(clipped) <= opts.minWords) break;
    }

    return { ...s, items: [{ kind: "paragraph" as const, lines: [clipped], style: "body" as const }] };
  });
  return { ...model, sections };
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
  const gapHeadingToContent = Math.max(6, GAP_HEADING_TO_CONTENT - (tight ? 2 : 0));

  const blocks: LayoutBlock[] = [];
  const headerLayout = layoutHeader(model.header, styles);
  blocks.push({ kind: "header", height: measureHeaderLayout(headerLayout), data: headerLayout });

  for (const s of model.sections) {
    const prepared = prepareSection(s.items, styles);
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
  const gapHeadingToContent = GAP_HEADING_TO_CONTENT;

  const sectionsByTitle = new Map(model.sections.map(s => [s.title, s] as const));
  const summary = sectionsByTitle.get("SUMMARY");
  const experience = sectionsByTitle.get("EXPERIENCE");

  const otherTitles = ["PROJECTS", "SKILLS", "EDUCATION", "CERTIFICATIONS"].filter(t => sectionsByTitle.has(t));

  // Prepare measured items for each section
  const headerLayout = layoutHeader(model.header, styles);
  const headerBlock: LayoutBlock = { kind: "header", height: measureHeaderLayout(headerLayout), data: headerLayout };

  const makeSectionChunks = (title: string, items: PdfSectionItem[]) => {
    const prepared = prepareSection(items, styles);
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
    return { kind: "section" as const, title: "EXPERIENCE", height: preparedExp.headingHeight + gapHeadingToContent + h, items: [singlePrepared] };
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
      const text = it.lines.join("\n");
      const lines = wrapText(styles.body.font, styles.body.size, text, CONTENT_WIDTH_PT);
      return { ...it, lines };
    }

    if (it.kind === "education") {
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
      const bullets = project.bullets.map(b => {
        const lines = wrapText(styles.bullet.font, styles.bullet.size, b.lines.join(" "), CONTENT_WIDTH_PT - bulletIndentPt(styles));
        return { lines };
      });
      return { ...it, project: { ...project, bullets } };
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
    return item.lines.length * styles.body.lineHeight;
  }
  if (item.kind === "skills") {
    // Keep within 40-55pt by clamping to 4 lines max (measurement-based wrap already)
    const raw = item.lines.length * styles.body.lineHeight;
    return Math.min(55, Math.max(40, raw));
  }
  if (item.kind === "education") {
    // 2 lines per degree
    return 2 * styles.body.lineHeight + 2;
  }
  if (item.kind === "job") {
    const headerH = styles.jobTitle.lineHeight;
    const gapAfterHeader = 5;
    const bulletsH = measureBullets(item.job.bullets, styles);
    // Spec target per job 90-120; keep reasonable without forcing
    const raw = headerH + gapAfterHeader + bulletsH;
    return Math.min(160, Math.max(80, raw));
  }
  if (item.kind === "projects") {
    const titleH = styles.body.lineHeight;
    const bulletsH = measureBullets(item.project.bullets, styles);
    const raw = titleH + 4 + bulletsH;
    return Math.min(90, Math.max(45, raw));
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
  y -= GAP_HEADING_TO_CONTENT;

  for (let i = 0; i < items.length; i++) {
    const it = items[i];

    if (it.kind === "paragraph") {
      y = drawLines(page, x, y, it.lines, styles.body);
    } else if (it.kind === "skills") {
      y = drawLines(page, x, y, it.lines, styles.body);
    } else if (it.kind === "education") {
      const l1 = truncateToWidth(styles.body.font, styles.body.size, it.entry.line1, CONTENT_WIDTH_PT);
      const l2 = truncateToWidth(styles.body.font, styles.body.size, it.entry.line2, CONTENT_WIDTH_PT);
      y = drawLines(page, x, y, [l1, l2].filter(Boolean), styles.body);
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

  // Role + Company (left), Dates (right)
  const left = truncateToWidth(styles.jobTitle.font, styles.jobTitle.size, job.leftTitle, CONTENT_WIDTH_PT * 0.72);
  const right = truncateToWidth(styles.meta.font, styles.meta.size, job.rightMeta, CONTENT_WIDTH_PT * 0.28);

  page.drawText(left, {
    x,
    y: y - styles.jobTitle.lineHeight,
    font: styles.jobTitle.font,
    size: styles.jobTitle.size,
    color: rgb(0, 0, 0),
  });

  const rightWidth = styles.meta.font.widthOfTextAtSize(right, styles.meta.size);
  page.drawText(right, {
    x: x + CONTENT_WIDTH_PT - rightWidth,
    y: y - styles.jobTitle.lineHeight + 2,
    font: styles.meta.font,
    size: styles.meta.size,
    color: rgb(0.25, 0.25, 0.25),
  });

  y -= styles.jobTitle.lineHeight;

  // Optional location under header, in meta
  if (job.location) {
    const loc = truncateToWidth(styles.meta.font, styles.meta.size, job.location, CONTENT_WIDTH_PT);
    page.drawText(loc, {
      x,
      y: y - styles.meta.lineHeight,
      font: styles.meta.font,
      size: styles.meta.size,
      color: rgb(0.25, 0.25, 0.25),
    });
    y -= styles.meta.lineHeight;
  }

  y -= 5;

  y = drawBullets(page, x, y, job.bullets, styles);
  return y;
}

function drawProject(page: any, x: number, yTopFromBottom: number, project: PdfProject, styles: ReturnType<typeof makeStyles>): number {
  let y = yTopFromBottom;
  const title = truncateToWidth(styles.bodyBold.font, styles.bodyBold.size, project.title, CONTENT_WIDTH_PT);
  page.drawText(title, {
    x,
    y: y - styles.body.lineHeight,
    font: styles.bodyBold.font,
    size: styles.bodyBold.size,
    color: rgb(0, 0, 0),
  });
  y -= styles.body.lineHeight;
  y -= 4;
  y = drawBullets(page, x, y, project.bullets.slice(0, 2), styles);
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
    bullet: { font: fontRegular, size: FONT_SIZE_BODY, lineHeight: FONT_SIZE_BODY * LH_BULLET } satisfies TextStyle,
  };
}

// Guard: margin rule (never reduce below 15mm)
export function assertMarginsOk(marginPt: number) {
  if (marginPt < MIN_MARGIN_PT) {
    throw new Error(`Margin ${marginPt}pt violates minimum ${MIN_MARGIN_PT}pt`);
  }
}
