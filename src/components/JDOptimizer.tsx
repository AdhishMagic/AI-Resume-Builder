import { useState } from 'react';
import { JDAnalyzerAgent } from '../agents/JDAnalyzerAgent';
import { ResumeJDMergerAgent } from '../agents/ResumeJDMergerAgent';
import type { ResumeProfile, JDAnalysis } from '../types';

interface JDOptimizerProps {
    resume: ResumeProfile;
    onAnalysisComplete: (analysis: JDAnalysis) => void;
    onResumeOptimized: (resume: ResumeProfile) => void;
}

export const JDOptimizer: React.FC<JDOptimizerProps> = ({ resume, onAnalysisComplete, onResumeOptimized }) => {
    const [jdText, setJdText] = useState('');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isOptimizing, setIsOptimizing] = useState(false);
    const [analysis, setAnalysis] = useState<JDAnalysis | null>(null);

    const handleAnalyze = async () => {
        if (!jdText.trim()) return;
        setIsAnalyzing(true);
        try {
            const result = await JDAnalyzerAgent.analyze(jdText);
            setAnalysis(result);
            onAnalysisComplete(result);
        } catch (error) {
            console.error("JD Analysis failed:", error);
            alert("Analysis failed.");
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleOptimize = async () => {
        if (!analysis) return;
        setIsOptimizing(true);
        try {
            const optimizedResume = await ResumeJDMergerAgent.merge(resume, analysis);
            onResumeOptimized(optimizedResume);
            alert("Resume optimized for the job description!");
        } catch (error) {
            console.error("Optimization failed:", error);
            alert("Optimization failed.");
        } finally {
            setIsOptimizing(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto p-6 space-y-8">

            {/* Input Section */}
            <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-lg">
                <h2 className="text-2xl font-bold text-orange-400 mb-4">Job Description Analyzer</h2>
                <textarea
                    value={jdText}
                    onChange={(e) => setJdText(e.target.value)}
                    placeholder="Paste the Job Description here..."
                    className="w-full h-40 bg-gray-900 border border-gray-600 rounded-lg p-4 text-white focus:ring-2 focus:ring-orange-500 resize-none"
                />
                <div className="mt-4 flex justify-end">
                    <button
                        onClick={handleAnalyze}
                        disabled={isAnalyzing || !jdText.trim()}
                        className="bg-orange-600 hover:bg-orange-500 text-white px-6 py-2 rounded-lg font-bold disabled:opacity-50 transition-colors"
                    >
                        {isAnalyzing ? "Analyzing..." : "Analyze JD"}
                    </button>
                </div>
            </div>

            {/* Analysis Result */}
            {analysis && (
                <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-lg animate-fade-in">
                    <div className="flex justify-between items-start mb-6">
                        <div>
                            <h3 className="text-xl font-bold text-white">{analysis.role_title}</h3>
                            <p className="text-gray-400 text-sm">Experience Level: {analysis.experience_level}</p>
                        </div>
                        <button
                            onClick={handleOptimize}
                            disabled={isOptimizing}
                            className="bg-green-600 hover:bg-green-500 text-white px-6 py-2 rounded-lg font-bold shadow-lg transform hover:scale-105 transition-all"
                        >
                            {isOptimizing ? "Optimizing..." : "⚡ Optimize Resume"}
                        </button>
                    </div>

                    <div className="grid md:grid-cols-2 gap-6">
                        <div className="bg-gray-900 p-4 rounded-lg">
                            <h4 className="font-bold text-gray-300 mb-2 uppercase text-xs tracking-wider">Required Skills</h4>
                            <div className="flex flex-wrap gap-2">
                                {analysis.required_skills.map((skill, i) => (
                                    <span key={i} className="bg-red-900/50 text-red-200 px-2 py-1 rounded text-xs border border-red-800">
                                        {skill}
                                    </span>
                                ))}
                            </div>
                        </div>
                        <div className="bg-gray-900 p-4 rounded-lg">
                            <h4 className="font-bold text-gray-300 mb-2 uppercase text-xs tracking-wider">Keywords</h4>
                            <div className="flex flex-wrap gap-2">
                                {analysis.keywords.map((kw, i) => (
                                    <span key={i} className="bg-blue-900/50 text-blue-200 px-2 py-1 rounded text-xs border border-blue-800">
                                        {kw}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
