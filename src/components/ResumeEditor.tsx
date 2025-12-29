import React, { useState, useEffect } from 'react';
import { ResumePreview } from './ResumePreview';
import { ResumeEditAgent } from '../agents/ResumeEditAgent';
import { JDAnalyzerAgent } from '../agents/JDAnalyzerAgent'; // [NEW]
import type { ResumeProfile, ATSAnalysis } from '../types';
// @ts-ignore - basic html2pdf import
import html2pdf from 'html2pdf.js';

interface ResumeEditorProps {
    resume: ResumeProfile;
    jd?: string; // [NEW] Pass JD to editor
    onUpdate: (updatedResume: ResumeProfile) => void;
}

export const ResumeEditor: React.FC<ResumeEditorProps> = ({ resume, jd, onUpdate }) => {
    const [instruction, setInstruction] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);
    // Zoom State
    const [zoom, setZoom] = useState(0.8);

    // ATS State
    const [atsAnalysis, setAtsAnalysis] = useState<ATSAnalysis | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    // Run Analysis on Mount or when Resume/JD changes
    useEffect(() => {
        const runAnalysis = async () => {
            if (jd && jd.length > 50) {
                setIsAnalyzing(true);
                const analysis = await JDAnalyzerAgent.analyze(resume, jd);
                setAtsAnalysis(analysis);
                setIsAnalyzing(false);
            }
        };
        // Debounce or just run? For now, run if we have a JD.
        runAnalysis();
    }, [resume, jd]);

    const handleEdit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!instruction.trim()) return;

        setIsEditing(true);
        try {
            const updated = await ResumeEditAgent.edit(resume, instruction);
            onUpdate(updated);
            setInstruction('');
        } catch (error) {
            console.error("Edit failed:", error);
            alert("Failed to edit resume. Please try again.");
        } finally {
            setIsEditing(false);
        }
    };

    const handleDownload = () => {
        const element = document.getElementById('resume-preview-content');
        if (!element) return;

        setIsDownloading(true);
        const opt = {
            margin: 0,
            filename: `${resume.personal.name.replace(/\s+/g, '_')}_Resume.pdf`,
            image: { type: 'jpeg' as const, quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }, // Match CSS units
            pagebreak: { mode: ['avoid-all', 'css', 'legacy'] } // Smart page breaks
        };

        html2pdf().set(opt).from(element).save().then(() => {
            setIsDownloading(false);
        }).catch((err: any) => {
            console.error("Download error:", err);
            setIsDownloading(false);
        });
    };

    return (
        <div className="flex flex-col lg:flex-row h-[calc(100vh-80px)] gap-4 p-4 max-w-[1920px] mx-auto">
            {/* Editor Panel - Fixed Width on Desktop for consistency */}
            <div className="w-full lg:w-[400px] flex-shrink-0 flex flex-col gap-4">
                <div className="bg-gray-800 p-5 rounded-xl border border-gray-700 shadow-xl flex-grow flex flex-col">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-bold text-blue-400 flex items-center gap-2">
                            <span>✨</span> AI Editor
                        </h2>
                        {/* DOWNLOAD BUTTON */}
                        <button
                            onClick={handleDownload}
                            disabled={isDownloading}
                            className={`
                                flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold transition-all
                                ${isDownloading
                                    ? 'bg-gray-700 text-gray-500 cursor-wait'
                                    : 'bg-green-600 hover:bg-green-500 text-white shadow-lg hover:shadow-green-500/20'}
                            `}
                        >
                            {isDownloading ? 'Saving...' : 'Download'}
                            {!isDownloading && (
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                            )}
                        </button>
                    </div>

                    <p className="text-xs text-gray-400 mb-4 leading-relaxed">
                        Direct the AI to refine your content. The preview updates in real-time.
                    </p>

                    <form onSubmit={handleEdit} className="mt-auto flex flex-col gap-2">
                        <div className="relative">
                            <textarea
                                value={instruction}
                                onChange={(e) => setInstruction(e.target.value)}
                                placeholder="E.g. 'Shorten the summary', 'Add Java to skills'..."
                                className="w-full h-24 bg-gray-900 border border-gray-600 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-inner resize-none text-sm"
                            />
                            <button
                                type="submit"
                                disabled={isEditing || !instruction.trim()}
                                className="absolute right-2 bottom-2 bg-blue-600 hover:bg-blue-500 text-white p-1.5 rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                title="Send Instruction"
                            >
                                {isEditing ? (
                                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                ) : (
                                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                    </svg>
                                )}
                            </button>
                        </div>
                    </form>
                </div>

                {/* ATS DASHBOARD (Only if JD is provided) */}
                {atsAnalysis && (atsAnalysis.ats_score > 0) && (
                    <div className="bg-gray-800 p-4 rounded-xl border border-gray-700 shadow-xl animate-fade-in-up">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-sm font-bold text-gray-300">ATS Match Score</h3>
                            <span className={`text-xl font-bold ${getScoreColor(atsAnalysis.ats_score)}`}>
                                {atsAnalysis.ats_score}%
                            </span>
                        </div>

                        {/* Progress Bar */}
                        <div className="w-full bg-gray-700 rounded-full h-2 mb-4">
                            <div
                                className={`h-2 rounded-full transition-all duration-1000 ${getScoreColorBg(atsAnalysis.ats_score)}`}
                                style={{ width: `${atsAnalysis.ats_score}%` }}
                            ></div>
                        </div>

                        {/* Missing Skills */}
                        {atsAnalysis.missing_required_skills.length > 0 && (
                            <div className="mb-3">
                                <p className="text-[10px] uppercase font-bold text-red-400 mb-1">Missing Keywords</p>
                                <div className="flex flex-wrap gap-1">
                                    {atsAnalysis.missing_required_skills.slice(0, 5).map(skill => (
                                        <span key={skill} className="px-2 py-0.5 rounded text-[10px] bg-red-500/10 text-red-300 border border-red-500/20">
                                            {skill}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        <p className="text-[10px] text-gray-500 italic border-t border-gray-700 pt-2 mt-2">
                            "{atsAnalysis.overall_feedback}"
                        </p>
                    </div>
                )}

                <div className="bg-gray-800 p-3 rounded-xl border border-gray-700 text-xs text-gray-400">
                    <strong>Tip:</strong> Try "Fix grammar" or "Bullet points for projects".
                </div>
            </div>

            {/* Preview Panel - Flexible Width with Zoom */}
            <div className="flex-grow bg-gray-100 rounded-xl shadow-inner flex flex-col overflow-hidden relative group">

                {/* ZOOM CONTROLS OVERLAY */}
                <div className="absolute top-4 right-6 z-10 flex items-center gap-2 bg-gray-900/80 backdrop-blur-sm p-1.5 rounded-full shadow-xl border border-gray-700 transition-opacity opacity-0 group-hover:opacity-100">
                    <button onClick={() => setZoom(Math.max(0.3, zoom - 0.1))} className="p-1 hover:text-blue-400 text-white"><svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5 10a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1z" clipRule="evenodd" /></svg></button>
                    <span className="text-xs font-mono w-8 text-center text-white">{Math.round(zoom * 100)}%</span>
                    <button onClick={() => setZoom(Math.min(1.5, zoom + 0.1))} className="p-1 hover:text-blue-400 text-white"><svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" /></svg></button>
                </div>

                <div className="flex-grow overflow-auto p-4 md:p-8 flex justify-center items-start bg-gray-200/50">
                    <div
                        id="resume-preview-content"
                        style={{
                            transform: `scale(${zoom})`,
                            transformOrigin: 'top center',
                            transition: 'transform 0.2s ease-out'
                        }}
                    >
                        <ResumePreview resume={resume} />
                    </div>
                </div>
            </div>
        </div>
    );
};
