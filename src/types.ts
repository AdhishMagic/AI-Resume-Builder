export interface ResumeProfile {
    personal: {
        name: string;
        email: string;
        phone: string;
        location: string;
        linkedin: string;
        github: string;
    };
    headline: string;
    summary: string;
    skills: {
        programming_languages: string[];
        frameworks: string[];
        tools: string[];
        databases: string[];
        concepts: string[];
    };
    experience: {
        company: string;
        role: string;
        duration: string;
        location: string;
        achievements: string[];
    }[];
    projects: {
        name: string;
        tech_stack: string[];
        description: string;
        impact: string;
    }[];
    education: {
        degree: string;
        institution: string;
        year: string;
        cgpa: string;
    };
    certifications: string[];
    achievements: string[];
    templateId?: string;
    canonical?: CanonicalResume;
}

export interface CanonicalResume {
    basics: {
        full_name: string;
        headline: string;
        email: string;
        phone: string;
        location: string;
        linkedin: string;
        github: string;
        portfolio: string;
    };

    professional_summary: {
        text: string;
    };

    skills: {
        programming_languages: string[];
        frameworks_libraries: string[];
        tools_platforms: string[];
        databases: string[];
        core_concepts: string[];
    };

    experience: Array<{
        company: string;
        role: string;
        employment_type: string;
        location: string;
        start_date: string;
        end_date: string;
        responsibilities: string[];
        achievements: string[];
        technologies_used: string[];
    }>;

    projects: Array<{
        project_name: string;
        role: string;
        description: string;
        key_features: string[];
        impact: string;
        technologies_used: string[];
        links: {
            github: string;
            demo: string;
        };
    }>;

    education: Array<{
        degree: string;
        field_of_study: string;
        institution: string;
        location: string;
        start_year: string;
        end_year: string;
        cgpa: string;
    }>;

    certifications: Array<{
        name: string;
        issuer: string;
        year: string;
    }>;

    achievements: string[];

    open_source_contributions: Array<{
        project_name: string;
        contribution: string;
        link: string;
    }>;

    additional_information: {
        languages: string[];
        availability: string;
        work_authorization: string;
    };
}

export interface JDAnalysis {
    role_title: string;
    required_skills: string[];
    preferred_skills: string[];
    tools_and_technologies: string[];
    responsibilities: string[];
    keywords: string[];
    experience_level: string;
}

export interface ATSAnalysis {
    ats_score: number;
    skill_match_percentage: number;
    missing_required_skills: string[];
    missing_preferred_skills: string[];
    matched_keywords: string[];
    unmatched_keywords: string[];
    section_wise_feedback: {
        summary: string;
        skills: string;
        experience: string;
        projects: string;
    };
    overall_feedback: string;
}

export interface ResumeGenerationPayload {
    description?: string;
    file?: File | null;
    jd?: string;
    template?: 'modern' | 'minimal' | 'classic';
}

export interface VoiceIntentAnalysis {
    intent: 'GENERATE_RESUME' | 'EDIT_RESUME' | 'ANALYZE_JD' | 'ALIGN_WITH_JD' | 'SCORE_ATS' | 'UNSUPPORTED';
    confidence: number;
}
