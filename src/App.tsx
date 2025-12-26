import React, { useState } from 'react';
import { ResumeBuilder } from './components/ResumeBuilder';
import { ResumeEditor } from './components/ResumeEditor';
import { JDOptimizer } from './components/JDOptimizer';
import { ATSScoreboard } from './components/ATSScoreboard';
import type { ResumeProfile, JDAnalysis } from './types';

function App() {
  const [resume, setResume] = useState<ResumeProfile | null>(null);
  const [activeTab, setActiveTab] = useState<'editor' | 'jd' | 'ats'>('editor');
  const [jdAnalysis, setJdAnalysis] = useState<JDAnalysis | null>(null);

  // Layout for the App
  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 font-sans selection:bg-blue-500/30">

      {/* Top Navigation Bar */}
      <nav className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600"></div>
              <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">
                Antigravity Resume
              </span>
            </div>

            {resume && (
              <div className="flex space-x-4">
                <button
                  onClick={() => setActiveTab('editor')}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'editor'
                      ? 'bg-gray-800 text-white shadow-sm'
                      : 'text-gray-400 hover:text-white hover:bg-gray-800'
                    }`}
                >
                  Editor
                </button>
                <button
                  onClick={() => setActiveTab('jd')}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'jd'
                      ? 'bg-gray-800 text-white shadow-sm'
                      : 'text-gray-400 hover:text-white hover:bg-gray-800'
                    }`}
                >
                  JD Optimizer
                </button>
                <button
                  onClick={() => setActiveTab('ats')}
                  disabled={!jdAnalysis}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'ats'
                      ? 'bg-gray-800 text-white shadow-sm'
                      : !jdAnalysis ? 'opacity-50 cursor-not-allowed text-gray-600' : 'text-gray-400 hover:text-white hover:bg-gray-800'
                    }`}
                >
                  ATS Score
                </button>
              </div>
            )}

            {resume && (
              <button
                onClick={() => {
                  if (confirm("Start over? All data will be lost.")) {
                    setResume(null);
                    setJdAnalysis(null);
                    setActiveTab('editor');
                  }
                }}
                className="text-xs text-red-400 hover:text-red-300 transition-colors"
              >
                Reset
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {!resume ? (
          <ResumeBuilder onGenerate={(profile) => setResume(profile)} />
        ) : (
          <div className="animate-fade-in-up">
            {activeTab === 'editor' && (
              <ResumeEditor
                resume={resume}
                onUpdate={(updated) => setResume(updated)}
              />
            )}

            {activeTab === 'jd' && (
              <JDOptimizer
                resume={resume}
                onAnalysisComplete={(analysis) => setJdAnalysis(analysis)}
                onResumeOptimized={(optimized) => setResume(optimized)}
              />
            )}

            {activeTab === 'ats' && jdAnalysis && (
              <ATSScoreboard
                resume={resume}
                jdAnalysis={jdAnalysis}
              />
            )}
            {activeTab === 'ats' && !jdAnalysis && (
              <div className="text-center py-20">
                <p className="text-gray-400">Please analyze a Job Description in the "JD Optimizer" tab first.</p>
              </div>
            )}
          </div>
        )}
      </main>

    </div>
  );
}

export default App;
