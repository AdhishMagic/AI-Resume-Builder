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
    },
    {
        id: 'professional_classic',
        label: 'Professional Classic',
        description: 'Traditional corporate structure.',
        category: 'ats',
        color: 'bg-blue-900'
    },
    {
        id: 'tech_focused',
        label: 'Tech Focused',
        description: 'Emphasizes skills & projects.',
        category: 'ats',
        color: 'bg-emerald-900'
    },
    // PHOTO FOCUSED
    {
        id: 'modern_photo',
        label: 'Modern + Photo',
        description: 'Left-aligned photo for creative roles.',
        category: 'photo',
        color: 'bg-purple-900'
    },
    {
        id: 'executive_photo',
        label: 'Executive',
        description: 'Formal top-right photo layout.',
        category: 'photo',
        color: 'bg-indigo-900'
    }
];
