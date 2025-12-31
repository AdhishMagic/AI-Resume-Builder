import type { CanonicalResume, ResumeProfile } from "../types";

export const createCanonicalResumeBase = (): CanonicalResume => ({
  basics: {
    full_name: "",
    headline: "",
    email: "",
    phone: "",
    location: "",
    linkedin: "",
    github: "",
    portfolio: "",
  },
  professional_summary: {
    text: "",
  },
  skills: {
    programming_languages: [],
    frameworks_libraries: [],
    tools_platforms: [],
    databases: [],
    core_concepts: [],
  },
  experience: [],
  projects: [],
  education: [],
  certifications: [],
  achievements: [],
  open_source_contributions: [],
  additional_information: {
    languages: [],
    availability: "",
    work_authorization: "",
  },
});

const toDuration = (start: string, end: string) => {
  const s = (start || "").trim();
  const e = (end || "").trim();
  if (!s && !e) return "";
  if (s && !e) return `${s} - Present`;
  if (!s && e) return e;
  return `${s} - ${e}`;
};

const nonEmpty = (items: string[]) => (items || []).map(s => (s || "").trim()).filter(Boolean);

export const canonicalToResumeProfile = (canonical: CanonicalResume): ResumeProfile => {
  const firstEducation = canonical.education[0];
  const degree = firstEducation
    ? [firstEducation.degree, firstEducation.field_of_study].filter(Boolean).join(" - ")
    : "";

  return {
    personal: {
      name: canonical.basics.full_name || "Your Name",
      email: canonical.basics.email || "",
      phone: canonical.basics.phone || "",
      location: canonical.basics.location || "",
      linkedin: canonical.basics.linkedin || "",
      github: canonical.basics.github || "",
    },
    headline: canonical.basics.headline || "Software Engineer",
    summary: canonical.professional_summary.text || "",
    skills: {
      programming_languages: nonEmpty(canonical.skills.programming_languages),
      frameworks: nonEmpty(canonical.skills.frameworks_libraries),
      tools: nonEmpty(canonical.skills.tools_platforms),
      databases: nonEmpty(canonical.skills.databases),
      concepts: nonEmpty(canonical.skills.core_concepts),
    },
    experience: (canonical.experience || []).map((exp) => {
      const achievements = nonEmpty(exp.achievements);
      const responsibilities = nonEmpty(exp.responsibilities);
      return {
        company: exp.company || "",
        role: exp.role || "",
        duration: toDuration(exp.start_date, exp.end_date),
        location: exp.location || "",
        achievements: achievements.length ? achievements : responsibilities,
      };
    }),
    projects: (canonical.projects || []).map((proj) => {
      const features = nonEmpty(proj.key_features);
      const description = [proj.description || "", features.length ? `Key features: ${features.join("; ")}` : ""]
        .filter(Boolean)
        .join("\n");
      return {
        name: proj.project_name || "",
        tech_stack: nonEmpty(proj.technologies_used),
        description,
        impact: proj.impact || "",
      };
    }),
    education: {
      degree,
      institution: firstEducation?.institution || "",
      year: firstEducation?.end_year || "",
      cgpa: firstEducation?.cgpa || "",
    },
    certifications: (canonical.certifications || []).map((c) => c?.name).filter(Boolean) as string[],
    achievements: nonEmpty(canonical.achievements),
    templateId: "modern_minimal",
    canonical,
  };
};
