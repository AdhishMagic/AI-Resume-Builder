import React from 'react';
import type { ResumeProfile } from '../types';

interface ResumePreviewProps {
    resume: ResumeProfile;
}

export const ResumePreview: React.FC<ResumePreviewProps> = ({ resume }) => {
    return (
        <div className="bg-white text-gray-900 p-8 rounded-lg shadow-lg border border-gray-200 font-sans max-w-4xl mx-auto my-4">
            {/* Header */}
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

            {/* Summary */}
            {resume.summary && (
                <section className="mb-6">
                    <h2 className="text-lg font-bold text-gray-800 uppercase border-b border-gray-300 pb-1 mb-2">Professional Summary</h2>
                    <p className="text-gray-700 leading-relaxed text-sm">{resume.summary}</p>
                </section>
            )}

            {/* Skills */}
            <section className="mb-6">
                <h2 className="text-lg font-bold text-gray-800 uppercase border-b border-gray-300 pb-1 mb-2">Technical Skills</h2>
                <div className="space-y-2 text-sm">
                    {resume.skills.programming_languages.length > 0 && (
                        <div className="grid grid-cols-[150px_1fr]">
                            <span className="font-semibold text-gray-700">Languages:</span>
                            <span className="text-gray-600">{resume.skills.programming_languages.join(', ')}</span>
                        </div>
                    )}
                    {resume.skills.frameworks.length > 0 && (
                        <div className="grid grid-cols-[150px_1fr]">
                            <span className="font-semibold text-gray-700">Frameworks:</span>
                            <span className="text-gray-600">{resume.skills.frameworks.join(', ')}</span>
                        </div>
                    )}
                    {resume.skills.tools.length > 0 && (
                        <div className="grid grid-cols-[150px_1fr]">
                            <span className="font-semibold text-gray-700">Tools:</span>
                            <span className="text-gray-600">{resume.skills.tools.join(', ')}</span>
                        </div>
                    )}
                    {resume.skills.databases.length > 0 && (
                        <div className="grid grid-cols-[150px_1fr]">
                            <span className="font-semibold text-gray-700">Databases:</span>
                            <span className="text-gray-600">{resume.skills.databases.join(', ')}</span>
                        </div>
                    )}
                </div>
            </section>

            {/* Experience */}
            {resume.experience.length > 0 && (
                <section className="mb-6">
                    <h2 className="text-lg font-bold text-gray-800 uppercase border-b border-gray-300 pb-1 mb-2">Experience</h2>
                    <div className="space-y-4">
                        {resume.experience.map((exp, idx) => (
                            <div key={idx}>
                                <div className="flex justify-between items-baseline mb-1">
                                    <h3 className="font-bold text-gray-900">{exp.role}</h3>
                                    <span className="text-xs text-gray-500 font-medium">{exp.duration}</span>
                                </div>
                                <div className="flex justify-between items-center text-sm mb-2">
                                    <span className="font-semibold text-gray-700">{exp.company}</span>
                                    <span className="italic text-gray-500">{exp.location}</span>
                                </div>
                                <ul className="list-disc list-outside ml-4 space-y-1 text-sm text-gray-700">
                                    {exp.achievements.map((ach, i) => (
                                        <li key={i}>{ach}</li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* Projects */}
            {resume.projects.length > 0 && (
                <section className="mb-6">
                    <h2 className="text-lg font-bold text-gray-800 uppercase border-b border-gray-300 pb-1 mb-2">Projects</h2>
                    <div className="space-y-4">
                        {resume.projects.map((proj, idx) => (
                            <div key={idx}>
                                <div className="flex justify-between items-baseline mb-1">
                                    <h3 className="font-bold text-gray-900">{proj.name}</h3>
                                </div>
                                {proj.tech_stack.length > 0 && (
                                    <div className="text-xs text-gray-500 mb-1 font-mono">
                                        {proj.tech_stack.join(' • ')}
                                    </div>
                                )}
                                <p className="text-sm text-gray-700 mb-1">{proj.description}</p>
                                <p className="text-sm text-gray-600 italic">Impact: {proj.impact}</p>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* Education */}
            {resume.education.institution && (
                <section className="mb-6">
                    <h2 className="text-lg font-bold text-gray-800 uppercase border-b border-gray-300 pb-1 mb-2">Education</h2>
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

            {/* Certifications - Optional if needed */}
            {resume.certifications.length > 0 && (
                <section>
                    <h2 className="text-lg font-bold text-gray-800 uppercase border-b border-gray-300 pb-1 mb-2">Certifications</h2>
                    <ul className="list-disc list-outside ml-4 space-y-1 text-sm text-gray-700">
                        {resume.certifications.map((cert, idx) => (
                            <li key={idx}>{cert}</li>
                        ))}
                    </ul>
                </section>
            )}
        </div>
    );
};
