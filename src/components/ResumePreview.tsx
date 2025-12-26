import React from 'react';
import type { ResumeProfile } from '../types';

interface ResumePreviewProps {
    resume: ResumeProfile;
}

export const ResumePreview: React.FC<ResumePreviewProps> = ({ resume }) => {
    // Default to modern_minimal if not specified
    const templateId = resume.templateId || 'modern_minimal';

    // Base classes for consistent PDF rendering
    const containerClasses = "bg-white text-gray-900 font-sans mx-auto shadow-2xl relative";
    const containerStyle = {
        width: '210mm',
        minHeight: '297mm',
        padding: '20mm',
        boxSizing: 'border-box' as const,
    };

    // --- TEMPLATE VARIATIONS ---

    // 1. MODERN MINIMAL (Default)
    if (templateId === 'modern_minimal') {
        return (
            <div className={containerClasses} style={containerStyle}>
                <header className="border-b-2 border-gray-800 pb-4 mb-6">
                    <h1 className="text-4xl font-bold uppercase tracking-wide text-gray-900">{resume.personal.name}</h1>
                    <p className="text-xl text-gray-600 font-medium mt-1">{resume.headline}</p>

                    <div className="flex flex-wrap gap-3 mt-4 text-sm text-gray-600">
                        {resume.personal.email && <span>📧 {resume.personal.email}</span>}
                        {resume.personal.phone && <span>📱 {resume.personal.phone}</span>}
                        {resume.personal.location && <span>📍 {resume.personal.location}</span>}
                        {resume.personal.linkedin && <span>🔗 {resume.personal.linkedin}</span>}
                        {resume.personal.github && <span>💻 {resume.personal.github}</span>}
                    </div>
                </header>
                {renderSharedSections(resume)}
            </div>
        );
    }

    // 2. PROFESSIONAL CLASSIC (Serif, Centered)
    if (templateId === 'professional_classic') {
        return (
            <div className={containerClasses} style={containerStyle}>
                <header className="text-center border-b border-gray-300 pb-6 mb-8">
                    <h1 className="text-3xl font-serif font-bold text-gray-900 mb-2">{resume.personal.name}</h1>
                    <p className="text-lg text-gray-600 italic font-serif mb-3">{resume.headline}</p>
                    <div className="flex justify-center gap-4 text-sm text-gray-600 font-serif">
                        {resume.personal.email && <span>{resume.personal.email}</span>}
                        {resume.personal.phone && <span>| {resume.personal.phone}</span>}
                        {resume.personal.linkedin && <span>| {resume.personal.linkedin}</span>}
                    </div>
                </header>
                <div className="font-serif">
                    {renderSharedSections(resume, "font-serif text-center uppercase tracking-widest text-sm border-b border-gray-400 pb-1 mb-3 break-after-avoid")}
                </div>
            </div>
        );
    }

    // 3. TECH FOCUSED (Blue accents, Skills first)
    if (templateId === 'tech_focused') {
        return (
            <div className={containerClasses} style={containerStyle}>
                <header className="bg-slate-900 -mx-[20mm] -mt-[20mm] px-[20mm] py-8 mb-8 text-white">
                    <h1 className="text-4xl font-mono font-bold text-sky-400">{resume.personal.name}</h1>
                    <p className="text-xl text-gray-300 mt-1 font-mono">{resume.headline}</p>
                    <div className="flex flex-wrap gap-4 mt-4 text-sm text-gray-400 font-mono">
                        {resume.personal.email && <span>&gt; {resume.personal.email}</span>}
                        {resume.personal.github && <span>&gt; {resume.personal.github}</span>}
                        {resume.personal.linkedin && <span>&gt; {resume.personal.linkedin}</span>}
                    </div>
                </header>
                <div className="font-sans">
                    {/* Force Skills to top for Tech layout */}
                    <section className="mb-6 break-inside-avoid block">
                        <h2 className="mb-6 font-mono font-bold text-sky-700 border-b border-sky-200 break-after-avoid">Technical Skills</h2>
                        <div className="grid grid-cols-1 gap-2 text-sm bg-slate-50 p-4 rounded border border-slate-100">
                            {resume.skills.programming_languages.length > 0 && <div><span className="font-bold text-slate-700">Langs:</span> {resume.skills.programming_languages.join(', ')}</div>}
                            {resume.skills.frameworks.length > 0 && <div><span className="font-bold text-slate-700">Stack:</span> {resume.skills.frameworks.join(', ')}</div>}
                            {resume.skills.tools.length > 0 && <div><span className="font-bold text-slate-700">Tools:</span> {resume.skills.tools.join(', ')}</div>}
                        </div>
                    </section>
                    {renderSharedSections(resume, undefined, true)} {/* skip skills in shared */}
                </div>
            </div>
        );
    }

    // 4. MODERN PHOTO (Left Column Photo) & 5. EXECUTIVE (Top Right Photo)
    if (templateId === 'modern_photo' || templateId === 'executive_photo') {
        return (
            <div className={containerClasses} style={containerStyle}>
                <div className="flex gap-8 mb-8 items-start">
                    {/* Placeholder Avatar */}
                    <div className="w-24 h-24 bg-gray-200 rounded-full flex-shrink-0 flex items-center justify-center text-gray-400 text-xs text-center border-2 border-gray-100 overflow-hidden">
                        <svg className="w-12 h-12 text-gray-300" fill="currentColor" viewBox="0 0 24 24"><path d="M24 20.993V24H0v-2.996A14.977 14.977 0 0112.004 15c4.904 0 9.26 2.354 11.996 5.993zM16.002 8.999a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                    </div>
                    <div className="flex-grow">
                        <h1 className="text-4xl font-bold text-gray-900">{resume.personal.name}</h1>
                        <p className="text-xl text-blue-600 font-medium mt-1">{resume.headline}</p>
                        <div className="flex flex-wrap gap-4 mt-3 text-sm text-gray-500">
                            {resume.personal.email && <span>{resume.personal.email}</span>}
                            {resume.personal.phone && <span>{resume.personal.phone}</span>}
                            {resume.personal.location && <span>{resume.personal.location}</span>}
                        </div>
                    </div>
                </div>
                {renderSharedSections(resume)}
            </div>
        );
    }

    // Fallback
    return (
        <div className={containerClasses} style={containerStyle}>
            {renderSharedSections(resume)}
        </div>
    );
};

// SHARED RENDER LOGIC
const renderSharedSections = (resume: ResumeProfile, headerClass?: string, skipSkills = false) => {
    // Default header class with break-after-avoid to prevent orphaned headers
    const h2Class = headerClass || "text-lg font-bold text-gray-800 uppercase border-b border-gray-300 pb-1 mb-2 break-after-avoid";

    return (
        <>
            {resume.summary && (
                <section className="mb-6 break-inside-avoid block">
                    <h2 className={h2Class}>Professional Summary</h2>
                    <p className="text-gray-700 leading-relaxed text-sm">{resume.summary}</p>
                </section>
            )}

            {!skipSkills && (
                <section className="mb-6 break-inside-avoid block">
                    <h2 className={h2Class}>Technical Skills</h2>
                    <div className="space-y-2 text-sm">
                        {resume.skills.programming_languages.length > 0 && <div className="grid grid-cols-[150px_1fr]"><span className="font-semibold text-gray-700">Languages:</span><span className="text-gray-600">{resume.skills.programming_languages.join(', ')}</span></div>}
                        {resume.skills.frameworks.length > 0 && <div className="grid grid-cols-[150px_1fr]"><span className="font-semibold text-gray-700">Frameworks:</span><span className="text-gray-600">{resume.skills.frameworks.join(', ')}</span></div>}
                        {resume.skills.tools.length > 0 && <div className="grid grid-cols-[150px_1fr]"><span className="font-semibold text-gray-700">Tools:</span><span className="text-gray-600">{resume.skills.tools.join(', ')}</span></div>}
                        {resume.skills.databases.length > 0 && <div className="grid grid-cols-[150px_1fr]"><span className="font-semibold text-gray-700">Databases:</span><span className="text-gray-600">{resume.skills.databases.join(', ')}</span></div>}
                        {resume.skills.concepts.length > 0 && <div className="grid grid-cols-[150px_1fr]"><span className="font-semibold text-gray-700">Concepts:</span><span className="text-gray-600">{resume.skills.concepts.join(', ')}</span></div>}
                    </div>
                </section>
            )}

            {/* Experience */}
            {resume.experience.length > 0 && (
                <section className="mb-6">
                    <h2 className={h2Class}>Experience</h2>
                    <div className="space-y-4">
                        {resume.experience.map((exp, idx) => (
                            <div key={idx} className="break-inside-avoid block">
                                <div className="flex justify-between items-baseline mb-1">
                                    <h3 className="font-bold text-gray-900">{exp.role}</h3>
                                    <span className="text-xs text-gray-500 font-medium">{exp.duration}</span>
                                </div>
                                <div className="flex justify-between items-center text-sm mb-2">
                                    <span className="font-semibold text-gray-700">{exp.company}</span>
                                    <span className="italic text-gray-500">{exp.location}</span>
                                </div>
                                <ul className="list-disc list-outside ml-4 space-y-1 text-sm text-gray-700">
                                    {exp.achievements.map((ach, i) => <li key={i}>{ach}</li>)}
                                </ul>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* Projects - KEY FIX: break-after-avoid on text-lg header to prevent orphans */}
            {resume.projects.length > 0 && (
                <section className="mb-6">
                    <h2 className={h2Class}>Projects</h2>
                    <div className="space-y-4">
                        {resume.projects.map((proj, idx) => (
                            <div key={idx} className="break-inside-avoid block">
                                <div className="flex justify-between items-baseline mb-1">
                                    <h3 className="font-bold text-gray-900">{proj.name}</h3>
                                </div>
                                {proj.tech_stack.length > 0 && (
                                    <div className="text-xs text-gray-500 mb-1 font-mono">
                                        {proj.tech_stack.join(' • ')}
                                    </div>
                                )}
                                <div className="text-sm text-gray-700 mb-1">{proj.description}</div>
                                <div className="text-sm text-gray-600 italic">Impact: {proj.impact}</div>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* Education */}
            {resume.education.institution && (
                <section className="mb-6 break-inside-avoid block">
                    <h2 className={h2Class}>Education</h2>
                    <div className="flex justify-between items-baseline">
                        <div>
                            <h3 className="font-bold text-gray-900">{resume.education.degree}</h3>
                            <p className="text-sm text-gray-700">{resume.education.institution}</p>
                        </div>
                        <div className="text-right">
                            <span className="block text-xs text-gray-500 font-medium">{resume.education.year}</span>
                            {resume.education.cgpa && <span className="block text-xs text-gray-600">CGPA: {resume.education.cgpa}</span>}
                        </div>
                    </div>
                </section>
            )}

            {/* Certifications */}
            {resume.certifications.length > 0 && (
                <section className="break-inside-avoid block">
                    <h2 className={h2Class}>Certifications</h2>
                    <ul className="list-disc list-outside ml-4 space-y-1 text-sm text-gray-700">
                        {resume.certifications.map((cert, idx) => (
                            <li key={idx}>{cert}</li>
                        ))}
                    </ul>
                </section>
            )}
        </>
    );
};
