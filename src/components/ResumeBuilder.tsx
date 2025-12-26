import React, { useState } from 'react';
import { ResumeGeneratorAgent } from '../agents/ResumeGeneratorAgent';
import type { ResumeProfile } from '../types';

interface ResumeBuilderProps {
    onGenerate: (profile: ResumeProfile) => void;
}

export const ResumeBuilder: React.FC<ResumeBuilderProps> = ({ onGenerate }) => {
    const [description, setDescription] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);

    const handleGenerate = async () => {
        if (!description.trim()) return;

        setIsGenerating(true);
        try {
            // Direct call to agent as per requirement to trigger Orchestrator logic via UI action
            // In a pure agentic loop, Orchestrator would route it, but here we enforce Phase 1 = Generate.
            // We essentially act as the "Executor" of the GENERATE_RESUME intent here.
            const profile = await ResumeGeneratorAgent.generate(description);
            onGenerate(profile);
        } catch (error) {
            console.error("Generation failed:", error);
            alert("Failed to generate resume. Please try again.");
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto p-6">
            <div className="text-center mb-10">
                <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-600 mb-4">
                    AI Resume Architect
                </h1>
                <p className="text-gray-400 text-lg">
                    Tell us about your background, experience, and skills. We'll build a professional resume for you in seconds.
                </p>
            </div>

            <div className="bg-gray-800 p-6 rounded-xl shadow-xl border border-gray-700">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                    Your Professional Profile
                </label>
                <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="E.g., I am a Full Stack Developer with 3 years of experience in React and Node.js. I worked at TechCorp optimizing APIs..."
                    className="w-full h-48 bg-gray-900 border border-gray-600 rounded-lg p-4 text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none transition-all"
                />

                <div className="mt-6 flex justify-end">
                    <button
                        onClick={handleGenerate}
                        disabled={isGenerating || !description.trim()}
                        className={`
              px-8 py-3 rounded-lg font-bold text-white shadow-lg transform transition-all
              ${isGenerating
                                ? 'bg-gray-600 cursor-not-allowed opacity-75'
                                : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 hover:scale-105 active:scale-95'
                            }
            `}
                    >
                        {isGenerating ? (
                            <span className="flex items-center gap-2">
                                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Generating...
                            </span>
                        ) : "Generate Resume"}
                    </button>
                </div>
            </div>
        </div>
    );
};
