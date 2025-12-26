import React, { useState, useRef } from 'react';
import { ResumeGeneratorAgent } from '../agents/ResumeGeneratorAgent';
import type { ResumeProfile } from '../types';
import { RESUME_TEMPLATES, type TemplateOption } from '../data/templates';

interface ResumeBuilderProps {
    onGenerate: (profile: ResumeProfile) => void;
}

export const ResumeBuilder: React.FC<ResumeBuilderProps> = ({ onGenerate }) => {
    // STATE
    const [description, setDescription] = useState('');
    const [jd, setJd] = useState('');
    const [pageCount, setPageCount] = useState(1);
    const [selectedTemplate, setSelectedTemplate] = useState<string>(RESUME_TEMPLATES[0].id);
    const [file, setFile] = useState<File | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);

    // UI FLAGS
    const [showJdInput, setShowJdInput] = useState(false);
    const [isDragging, setIsDragging] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);

    // HANDLERS
    const handleGenerate = async () => {
        if (!description.trim() && !file) return;

        setIsGenerating(true);
        try {
            const profile = await ResumeGeneratorAgent.generate({
                description,
                file,
                jd,
                pageCount,
                // @ts-ignore - passing templateId dynamically
                templateId: selectedTemplate
            });
            onGenerate(profile);
        } catch (error) {
            console.error("Generation failed:", error);
            alert("Failed to generate resume. Please try again.");
        } finally {
            setIsGenerating(false);
        }
    };

    const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };

    const onDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            setFile(e.dataTransfer.files[0]);
        }
    };

    return (
        <div className="min-h-[70vh] flex flex-col justify-center items-center px-4 max-w-3xl mx-auto">

            {/* VIBE HEADER */}
            <div className="text-center space-y-4 mb-6 animate-fade-in-up">
                <div className="inline-flex items-center justify-center p-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 mb-2">
                    <span className="text-blue-400 text-[10px] font-bold tracking-widest uppercase px-2">
                        AI Personal Architect
                    </span>
                </div>

                <h1 className="text-3xl md:text-5xl font-bold tracking-tight text-white mb-2">
                    Tell us your story <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">once</span>.
                </h1>

                <p className="text-sm text-gray-400 max-w-xl mx-auto leading-relaxed">
                    Upload your old resume, paste a job description, or just talk.
                </p>
            </div>

            {/* TEMPLATE GALLERY */}
            <div className="w-full max-w-2xl mb-6 animate-fade-in-up delay-75">
                <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide snap-x">
                    {RESUME_TEMPLATES.map((t) => (
                        <div
                            key={t.id}
                            onClick={() => setSelectedTemplate(t.id)}
                            className={`
                                flex-shrink-0 w-32 md:w-40 p-3 rounded-lg border cursor-pointer transition-all duration-200 snap-center
                                ${selectedTemplate === t.id
                                    ? 'bg-blue-500/10 border-blue-500 shadow-lg shadow-blue-500/10 scale-105'
                                    : 'bg-gray-900/50 border-gray-800 hover:border-gray-700 hover:bg-gray-800'}
                            `}
                        >
                            {/* Skeleton Preview */}
                            <div className={`h-20 w-full mb-2 rounded bg-opacity-20 ${t.color} flex flex-col gap-1 p-1`}>
                                <div className="w-1/2 h-1.5 bg-white/20 rounded-full"></div>
                                <div className="w-full h-1 bg-white/10 rounded-full"></div>
                                <div className="w-3/4 h-1 bg-white/10 rounded-full"></div>
                                {t.category === 'photo' && (
                                    <div className="absolute top-4 right-4 w-4 h-4 rounded-full bg-white/20"></div>
                                )}
                            </div>

                            <h3 className={`text-xs font-bold leading-tight ${selectedTemplate === t.id ? 'text-blue-400' : 'text-gray-300'}`}>
                                {t.label}
                            </h3>
                            <p className="text-[9px] text-gray-500 mt-0.5 leading-none">
                                {t.description}
                            </p>

                            {selectedTemplate === t.id && (
                                <div className="absolute top-2 right-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]"></div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* MAIN INPUT CONTAINER */}
            <div className="w-full max-w-2xl animate-fade-in-up delay-100 flex flex-col gap-3">

                {/* 1. FILE UPLOAD ZONE */}
                <div
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={onDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`
                        relative group border border-dashed rounded-lg p-4 transition-all duration-300 cursor-pointer
                        ${isDragging ? 'border-blue-500 bg-blue-500/10' : 'border-gray-800 bg-gray-900/50 hover:border-gray-700 hover:bg-gray-800'}
                        ${file ? 'border-green-500/50 bg-green-500/5' : ''}
                    `}
                >
                    <input type="file" ref={fileInputRef} onChange={onFileChange} className="hidden" accept=".pdf,.docx,.txt" />

                    <div className="flex items-center justify-center gap-3">
                        <div className={`p-2 rounded-full ${file ? 'bg-green-500/20 text-green-400' : 'bg-gray-800 text-gray-400 group-hover:bg-gray-700 group-hover:text-white'}`}>
                            {file ? (
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                            ) : (
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                </svg>
                            )}
                        </div>
                        <div className="text-left">
                            <p className={`text-sm font-medium ${file ? 'text-green-400' : 'text-gray-300 group-hover:text-white'}`}>
                                {file ? file.name : "Upload existing resume (Optional)"}
                            </p>
                            {!file && <p className="text-[10px] text-gray-500">Drag & drop PDF, DOCX, or TXT</p>}
                        </div>
                        {file && (
                            <button
                                onClick={(e) => { e.stopPropagation(); setFile(null); }}
                                className="ml-auto text-gray-500 hover:text-red-400"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        )}
                    </div>
                </div>

                {/* 2. TEXT INPUT AREA */}
                <div className="relative group">
                    <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
                    <div className="relative bg-gray-900 rounded-xl p-0.5">
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder={file ? "Add any extra details..." : "I'm a Full Stack Developer with 2 years of experience..."}
                            className="w-full h-24 bg-gray-900 text-sm text-white placeholder-gray-600 p-4 rounded-t-xl border-none focus:ring-0 resize-none leading-relaxed"
                            disabled={isGenerating}
                        />

                        {/* FOOTER ACTIONS */}
                        <div className="flex justify-between items-center px-4 py-2 border-t border-gray-800 bg-gray-900/50 rounded-b-xl">

                            {/* JD TOGGLE */}
                            <button
                                onClick={() => setShowJdInput(!showJdInput)}
                                className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${showJdInput ? 'text-blue-400' : 'text-gray-500 hover:text-gray-300'}`}
                            >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                </svg>
                                {showJdInput || jd ? "JD Added" : "Add JD"}
                            </button>

                            <div className="flex items-center gap-3">
                                {/* PAGE LENGTH INPUT */}
                                <div className="flex items-center gap-1.5 bg-gray-800 rounded-md px-2 py-0.5 border border-gray-700">
                                    <span className="text-[10px] text-gray-500 font-bold uppercase">Pages</span>
                                    <input
                                        type="number"
                                        min="1"
                                        max="3"
                                        value={pageCount}
                                        onChange={(e) => setPageCount(parseInt(e.target.value) || 1)}
                                        className="w-6 bg-transparent text-xs text-center text-white focus:outline-none focus:ring-0 p-0 border-none"
                                    />
                                </div>

                                {/* GENERATE BUTTON */}
                                <button
                                    onClick={handleGenerate}
                                    disabled={isGenerating || (!description.trim() && !file)}
                                    className={`
                                        flex items-center justify-center px-4 py-1.5 rounded-lg text-sm font-semibold text-white transition-all duration-300
                                        ${isGenerating
                                            ? 'bg-gray-800 cursor-wait text-gray-400'
                                            : (description.trim() || file)
                                                ? 'bg-gradient-to-r from-blue-600 to-purple-600 hover:shadow-lg hover:shadow-blue-500/25 transform hover:-translate-y-0.5'
                                                : 'bg-gray-800 text-gray-500 cursor-not-allowed'}
                                    `}
                                >
                                    {isGenerating ? (
                                        <>
                                            <svg className="animate-spin -ml-1 mr-2 h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                            Building...
                                        </>
                                    ) : (
                                        <>
                                            Generate
                                            <svg className="ml-1.5 w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                            </svg>
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 3. JD INPUT (Expandable) */}
                {showJdInput && (
                    <div className="animate-slide-up-fade bg-gray-900/50 border border-gray-800 rounded-lg p-3">
                        <textarea
                            value={jd}
                            onChange={(e) => setJd(e.target.value)}
                            placeholder="Paste the job description here..."
                            className="w-full h-16 bg-transparent text-xs text-gray-300 placeholder-gray-600 border-none focus:ring-0 resize-none"
                        />
                    </div>
                )}
            </div>
        </div>
    );
};
