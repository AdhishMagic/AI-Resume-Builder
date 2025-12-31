export interface TemplateOption {
    id: string;
    label: string;
    description: string;
    category: 'ats' | 'photo';
    color: string;
}

export const RESUME_TEMPLATES: TemplateOption[] = [
    // ATS / TEXT FOCUSED
    {
        id: 'modern_minimal',
        label: 'Modern Minimal',
        description: 'Clean, one-column. Best for ATS & Tech.',
        category: 'ats',
        color: 'bg-slate-700'
    }
];
