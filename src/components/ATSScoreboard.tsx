import React, { useEffect, useState } from 'react';
import { ATSScoringAgent } from '../agents/ATSScoringAgent';
import type { ResumeProfile, JDAnalysis, ATSAnalysis } from '../types';

interface ATSScoreboardProps {
    resume: ResumeProfile;
    jdAnalysis: JDAnalysis;
}

export const ATSScoreboard: React.FC<ATSScoreboardProps> = ({ resume, jdAnalysis }) => {
    const [scoreData, setScoreData] = useState<ATSAnalysis | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        let mounted = true;
        const fetchScore = async () => {
            try {
                const result = await ATSScoringAgent.score(resume, jdAnalysis);
                if (mounted) setScoreData(result);
            } catch (error) {
                console.error("ATS scoring failed:", error);
            } finally {
                if (mounted) setIsLoading(false);
            }
        };
        fetchScore();
        return () => { mounted = false; };
    }, [resume, jdAnalysis]);

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto mb-4"></div>
                    <p className="text-gray-400">Calculating ATS Score...</p>
                </div>
            </div>
        );
    }

    if (!scoreData) return <div className="text-red-500 text-center">Failed to load ATS score.</div>;

    return (
        <div className="max-w-4xl mx-auto p-6">
            <div className="grid md:grid-cols-2 gap-8 mb-8">
                {/* Score Card */}
                <div className="bg-gray-800 p-8 rounded-2xl border border-gray-700 shadow-xl text-center flex flex-col justify-center items-center relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 to-transparent"></div>
                    <h2 className="text-gray-400 font-medium uppercase tracking-widest mb-2 z-10">ATS Compatibility</h2>
                    <div className="text-8xl font-black text-white z-10 relative">
                        {scoreData.ats_score}
                        <span className="text-2xl text-gray-500 absolute top-2 -right-6">%</span>
                    </div>
                    <p className="mt-4 text-green-400 font-medium z-10">{scoreData.overall_feedback}</p>
                </div>

                {/* Skill Match Breakdown */}
                <div className="bg-gray-800 p-6 rounded-2xl border border-gray-700 shadow-xl">
                    <h3 className="text-xl font-bold text-white mb-6">Skill Match Analysis</h3>

                    <div className="mb-4">
                        <div className="flex justify-between text-sm mb-1">
                            <span className="text-gray-400">Keyword Match</span>
                            <span className="text-white font-bold">{scoreData.skill_match_percentage}%</span>
                        </div>
                        <div className="w-full bg-gray-700 rounded-full h-2.5">
                            <div className="bg-blue-500 h-2.5 rounded-full" style={{ width: `${scoreData.skill_match_percentage}%` }}></div>
                        </div>
                    </div>

                    {scoreData.missing_required_skills.length > 0 && (
                        <div className="mt-6">
                            <h4 className="text-sm font-bold text-red-400/80 uppercase mb-2">Missing Critical Skills</h4>
                            <div className="flex flex-wrap gap-2">
                                {scoreData.missing_required_skills.map((skill, i) => (
                                    <span key={i} className="px-2 py-1 bg-red-900/30 border border-red-800/50 rounded text-xs text-red-200">
                                        {skill}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Detailed Feedback */}
            <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
                <div className="p-4 bg-gray-700/50 border-b border-gray-700">
                    <h3 className="font-bold text-white">Section-wise Feedback</h3>
                </div>
                <div className="divide-y divide-gray-700">
                    {Object.entries(scoreData.section_wise_feedback).map(([section, feedback]) => (
                        <div key={section} className="p-4 grid grid-cols-[150px_1fr] gap-4">
                            <span className="text-gray-400 capitalize font-medium">{section}</span>
                            <p className="text-gray-200 text-sm">{feedback}</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
