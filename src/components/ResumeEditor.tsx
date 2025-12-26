import React, { useState } from 'react';
import { ResumePreview } from './ResumePreview';
import { ResumeEditAgent } from '../agents/ResumeEditAgent';
import type { ResumeProfile } from '../types';

interface ResumeEditorProps {
    resume: ResumeProfile;
    onUpdate: (updatedResume: ResumeProfile) => void;
}

export const ResumeEditor: React.FC<ResumeEditorProps> = ({ resume, onUpdate }) => {
    const [instruction, setInstruction] = useState('');
    const [isEditing, setIsEditing] = useState(false);

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

    return (
        <div className="flex flex-col lg:flex-row h-[calc(100vh-100px)] gap-6 p-6">
            {/* Editor Panel */}
            <div className="w-full lg:w-1/3 flex flex-col gap-4">
                <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-xl flex-grow flex flex-col">
                    <h2 className="text-xl font-bold text-blue-400 mb-4 flex items-center gap-2">
                        <span>✨</span> AI Editor
                    </h2>
                    <p className="text-sm text-gray-400 mb-6">
                        Ask the AI to improve sections, rewrite descriptions, or fix formatting.
                        The preview on the right updates automatically.
                    </p>

                    <form onSubmit={handleEdit} className="mt-auto">
                        <div className="relative">
                            <input
                                type="text"
                                value={instruction}
                                onChange={(e) => setInstruction(e.target.value)}
                                placeholder="Ex: 'Make the summary more punchy', 'Fix typos in experience'..."
                                className="w-full bg-gray-900 border border-gray-600 rounded-lg pl-4 pr-12 py-4 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-inner"
                            />
                            <button
                                type="submit"
                                disabled={isEditing || !instruction.trim()}
                                className="absolute right-2 top-2 bottom-2 bg-blue-600 hover:bg-blue-500 text-white p-2 rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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

                <div className="bg-gray-800 p-4 rounded-xl border border-gray-700 text-sm text-gray-400">
                    <strong>Pro Tip:</strong> Try asking "Quantify the impact in my latest project" or "Add React to my skills".
                </div>
            </div>

            {/* Preview Panel */}
            <div className="w-full lg:w-2/3 overflow-y-auto bg-gray-100 rounded-xl p-4 shadow-inner">
                <ResumePreview resume={resume} />
            </div>
        </div>
    );
};
