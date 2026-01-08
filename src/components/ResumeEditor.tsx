import { useState, useEffect } from 'react';
import type { ResumeProfile, ATSAnalysis, JDAnalysis } from '../types';
import { generateAtsOptimizedPdf, type GeneratedAtsPdf } from '../utils/atsPdfEngine';
import { assessAtsLayout } from '../utils/atsPdfEngine';
import { postAiEditor } from '../api/aiEditorClient';
import { ATSScoreCard } from './ATSScoreCard';
import { JDInputCard } from './JDInputCard';
import { JDAnalyzerPanel } from './JDAnalyzerPanel';

interface ResumeEditorProps {
    resume: ResumeProfile;
    requestedPageCount?: number;
    jdState: string | null;
    jdAnalysis: JDAnalysis | null;
    atsResult: ATSAnalysis | null;
    isAtsLoading: boolean;
    onSubmitJd: (jdText: string) => void;
    onClearJd: () => void;
    onUpdate: (updatedResume: ResumeProfile) => void;
}

export const ResumeEditor: React.FC<ResumeEditorProps> = ({
    resume,
    requestedPageCount,
    jdState,
    jdAnalysis,
    atsResult,
    isAtsLoading,
    onSubmitJd,
    onClearJd,
    onUpdate
}) => {
    const [instruction, setInstruction] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);
    const [editError, setEditError] = useState<string | null>(null);
    const [lastEditExplanation, setLastEditExplanation] = useState<string | null>(null);
    const [cooldownUntilMs, setCooldownUntilMs] = useState<number | null>(null);
    const [cooldownNowMs, setCooldownNowMs] = useState(() => Date.now());
    // Zoom State
    const [zoom, setZoom] = useState(0.8);

    // PDF Preview State (Option A: preview is the generated PDF)
    const [generatedPdf, setGeneratedPdf] = useState<GeneratedAtsPdf | null>(null);
    const [isRenderingPdf, setIsRenderingPdf] = useState(false);

    // Cooldown ticker (used when server returns HTTP 429)
    useEffect(() => {
        if (!cooldownUntilMs) return;
        const t = window.setInterval(() => setCooldownNowMs(Date.now()), 250);
        return () => window.clearInterval(t);
    }, [cooldownUntilMs]);

    const cooldownRemainingMs = cooldownUntilMs ? Math.max(0, cooldownUntilMs - cooldownNowMs) : 0;
    const cooldownRemainingSec = Math.ceil(cooldownRemainingMs / 1000);
    const isCooldownActive = cooldownRemainingMs > 0;

    const handleEdit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!instruction.trim()) return;
        if (isCooldownActive) return;

        let runtimeApiKey = '';
        try {
            runtimeApiKey = String(window.localStorage.getItem('ai_api_key') || '').trim();
        } catch {
            runtimeApiKey = '';
        }
        if (runtimeApiKey.length <= 10) {
            setEditError('AI API key is required. Go back to home and paste your API key to continue.');
            return;
        }

        setIsEditing(true);
        setEditError(null);
        try {
            const mode = (requestedPageCount || 1) === 2 ? '2-page' : '1-page';
            const result = await postAiEditor({ command: instruction, resume, mode });

            // Client-side safety net: validate layout contracts before accepting.
            const assessment = await assessAtsLayout(result.updatedResume, { requestedPageCount: requestedPageCount || 1 });
            if (!assessment.ok) {
                const msg = assessment.issues[0]?.message || 'AI edit would break strict PDF layout contracts.';
                throw new Error(msg);
            }

            onUpdate(result.updatedResume);
            setLastEditExplanation(result.explanation || null);
            setInstruction('');
        } catch (error) {
            console.error("Edit failed:", error);
            const msg = (error as any)?.message || 'Failed to edit resume.';
            if (String(msg).includes('HTTP 429')) {
                // Respect backend Retry-After=15 (server-side); keep UI from re-spamming.
                setCooldownUntilMs(Date.now() + 15_000);
            }
            setEditError(isCooldownActive ? `Rate limited. Try again in ${cooldownRemainingSec}s.` : msg);
        } finally {
            setIsEditing(false);
        }
    };

    const handleDownload = async () => {
        setIsDownloading(true);
        try {
            // Download EXACTLY what is being previewed.
            const pdf = generatedPdf || await generateAtsOptimizedPdf(resume, { requestedPageCount: requestedPageCount || 1 });
            const filename = `${(resume.personal?.name || 'Resume').replace(/\s+/g, '_')}_Resume.pdf`;
            const url = URL.createObjectURL(pdf.blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1500);
        } catch (err) {
            console.error('Download error:', err);
            alert('Failed to export ATS PDF. Please try again.');
        } finally {
            setIsDownloading(false);
        }
    };

    // Deterministic PDF generation for preview (measure → adapt → render)
    useEffect(() => {
        let cancelled = false;
        const prevUrl = generatedPdf?.objectUrl;

        const run = async () => {
            setIsRenderingPdf(true);
            try {
                const pdf = await generateAtsOptimizedPdf(resume, { requestedPageCount: requestedPageCount || 1 });
                if (cancelled) {
                    URL.revokeObjectURL(pdf.objectUrl);
                    return;
                }
                setGeneratedPdf(pdf);
                if (prevUrl) URL.revokeObjectURL(prevUrl);
            } catch (e) {
                console.error('PDF preview generation failed:', e);
            } finally {
                if (!cancelled) setIsRenderingPdf(false);
            }
        };

        run();
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [resume, requestedPageCount]);

    return (
        <div className="h-[calc(100vh-80px)] p-4 max-w-[1920px] mx-auto grid grid-cols-1 lg:grid-cols-2 grid-rows-[minmax(0,1fr)_260px] gap-4">
            {/* Top Left: AI Editor */}
            <div className="bg-gray-800 p-5 rounded-xl border border-gray-700 shadow-xl flex flex-col min-h-0">
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

                    {(editError || isCooldownActive) && (
                        <div className="text-xs text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg p-2 mb-3">
                            {isCooldownActive ? `Rate limited. Try again in ${cooldownRemainingSec}s.` : editError}
                        </div>
                    )}

                    {lastEditExplanation && !editError && !isCooldownActive && (
                        <div className="text-xs text-emerald-200 bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-2 mb-3">
                            {lastEditExplanation}
                        </div>
                    )}

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
                                disabled={isEditing || isCooldownActive || !instruction.trim()}
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

            {/* Top Right: Preview (untouched logic) */}
            <div className="bg-gray-100 rounded-xl shadow-inner flex flex-col overflow-hidden relative group min-h-0">

                {/* ZOOM CONTROLS OVERLAY */}
                <div className="absolute top-4 right-6 z-10 flex items-center gap-2 bg-gray-900/80 backdrop-blur-sm p-1.5 rounded-full shadow-xl border border-gray-700 transition-opacity opacity-0 group-hover:opacity-100">
                    <button onClick={() => setZoom(Math.max(0.3, zoom - 0.1))} className="p-1 hover:text-blue-400 text-white"><svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5 10a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1z" clipRule="evenodd" /></svg></button>
                    <span className="text-xs font-mono w-8 text-center text-white">{Math.round(zoom * 100)}%</span>
                    <button onClick={() => setZoom(Math.min(1.5, zoom + 0.1))} className="p-1 hover:text-blue-400 text-white"><svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" /></svg></button>
                </div>

                <div className="flex-grow overflow-auto p-4 md:p-8 flex justify-center items-start bg-gray-200/50">
                    <div
                        style={{
                            width: '595pt',
                            height: '842pt',
                            transform: `scale(${zoom})`,
                            transformOrigin: 'top center',
                            transition: 'transform 0.2s ease-out'
                        }}
                    >
                        <div
                            style={{
                                width: '595pt',
                                height: '842pt',
                                boxSizing: 'border-box',
                                background: '#fff',
                                position: 'relative'
                            }}
                        >
                            {isRenderingPdf && (
                                <div className="absolute inset-0 flex items-center justify-center text-gray-500 text-sm bg-white/70">
                                    Rendering PDF preview...
                                </div>
                            )}

                            {generatedPdf?.objectUrl ? (
                                <iframe
                                    title="Resume PDF Preview"
                                    src={generatedPdf.objectUrl}
                                    style={{
                                        width: '595pt',
                                        height: '842pt',
                                        border: 'none'
                                    }}
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-gray-500 text-sm">
                                    PDF preview unavailable.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Bottom Left: ATS Score Card (always visible) */}
            <ATSScoreCard atsResult={atsResult} hasJd={Boolean(jdState)} isLoading={isAtsLoading} />

            {/* Bottom Right: JD Analyzer (only if JD exists) */}
            {jdState && jdAnalysis ? (
                <JDAnalyzerPanel
                    jdAnalysis={jdAnalysis}
                    atsResult={atsResult}
                    onChangeJd={onClearJd}
                />
            ) : (
                <JDInputCard
                    initialValue={jdState || ''}
                    onSubmit={(jd) => onSubmitJd(jd)}
                />
            )}
        </div>
    );
};
