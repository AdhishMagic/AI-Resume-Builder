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

export interface VoiceIntentAnalysis {
    intent: 'GENERATE_RESUME' | 'EDIT_RESUME' | 'ANALYZE_JD' | 'ALIGN_WITH_JD' | 'SCORE_ATS' | 'UNSUPPORTED';
    confidence: number;
}
