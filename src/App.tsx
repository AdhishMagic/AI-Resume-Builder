import { useState } from 'react';
import { ResumeBuilder } from './components/ResumeBuilder';
import { ResumeEditor } from './components/ResumeEditor';
import { JDOptimizer } from './components/JDOptimizer';
import { ATSScoreboard } from './components/ATSScoreboard';
import type { ResumeProfile, JDAnalysis } from './types';

function App() {
  const [resume, setResume] = useState<ResumeProfile | null>(null);
  const [activeTab, setActiveTab] = useState<'editor' | 'jd' | 'ats'>('editor');
  const [jdAnalysis, setJdAnalysis] = useState<JDAnalysis | null>(null);
  const [currentJd, setCurrentJd] = useState<string>(''); // [NEW] Stores JD for analysis
  const [requestedPageCount, setRequestedPageCount] = useState<number>(1);

  // Layout for the App
  return (
    <div className="min-h-screen bg-[#0A0A0A] text-gray-100 font-sans selection:bg-blue-500/30 overflow-hidden relative">

      {/* GLOBAL BACKGROUND EFFECTS */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-0 -left-1/4 w-1/2 h-1/2 bg-blue-500/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 -right-1/4 w-1/2 h-1/2 bg-purple-500/10 rounded-full blur-[120px]" />
      </div>

      {/* Top Navigation Bar - Minimalist */}
      <nav className="relative z-50 border-b border-white/5 bg-black/20 backdrop-blur-xl sticky top-0">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div
            onClick={() => {
              if (resume && confirm("Return to home? Unsaved changes will be lost.")) {
                setResume(null);
                setJdAnalysis(null);
              }
            }}
            className="flex items-center gap-3 cursor-pointer group"
          >
            {/* PREMIUM LOGO */}
            <div className="relative h-9 w-9 group-hover:scale-110 transition-transform duration-300">
              <div className="absolute inset-0 bg-blue-500 blur-lg opacity-20 group-hover:opacity-40 transition-opacity"></div>
              <svg className="h-full w-full drop-shadow-md" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#3b82f6" />
                    <stop offset="100%" stopColor="#9333ea" />
                  </linearGradient>
                </defs>
                {/* Abstract Architect A / Layered Structure */}
                <path d="M50 10L90 30V70L50 90L10 70V30L50 10Z" stroke="url(#logoGradient)" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M50 25V75" stroke="url(#logoGradient)" strokeWidth="6" strokeLinecap="round" />
                <path d="M10 30L50 50L90 30" stroke="url(#logoGradient)" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="50" cy="50" r="8" fill="white" className="animate-pulse" />
              </svg>
            </div>
            <span className="text-lg font-bold tracking-tight text-white group-hover:text-blue-400 transition-colors">
              AI Personal Architect
            </span>
          </div>

          {resume && (
            <div className="flex items-center gap-1 bg-white/5 p-1 rounded-lg border border-white/5 backdrop-blur-sm">
              <button
                onClick={() => setActiveTab('editor')}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === 'editor'
                  ? 'bg-gray-800 text-white shadow-sm'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
              >
                Editor
              </button>
              <button
                onClick={() => setActiveTab('jd')}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === 'jd'
                  ? 'bg-gray-800 text-white shadow-sm'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
              >
                JD Match
              </button>
              <button
                onClick={() => setActiveTab('ats')}
                disabled={!jdAnalysis}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === 'ats'
                  ? 'bg-gray-800 text-white shadow-sm'
                  : !jdAnalysis ? 'opacity-30 cursor-not-allowed text-gray-500' : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
              >
                ATS Score
              </button>
            </div>
          )}

          <div className="w-8"></div> {/* Spacer for balance */}
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="relative z-10 max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {!resume ? (
          <ResumeBuilder onGenerate={(profile, jd, pageCount) => {
            setResume(profile);
            if (jd) setCurrentJd(jd);
            setRequestedPageCount(pageCount || 1);
          }} />
        ) : (
          <div className="animate-slide-up-fade">
            {activeTab === 'editor' && (
              <ResumeEditor
                resume={resume}
                jd={currentJd}
                requestedPageCount={requestedPageCount}
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

            {activeTab === 'ats' && (
              jdAnalysis ? (
                <ATSScoreboard
                  resume={resume}
                  jdAnalysis={jdAnalysis}
                />
              ) : (
                <div className="flex flex-col items-center justify-center py-32 text-center space-y-4">
                  <div className="p-4 rounded-full bg-gray-800/50">
                    <svg className="w-8 h-8 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-medium text-white">No Job Description Analyzed</h3>
                  <p className="text-gray-400 max-w-md">
                    Head over to the <span className="text-blue-400 cursor-pointer hover:underline" onClick={() => setActiveTab('jd')}>JD Match tab</span> to analyze a job description first. We can't score your resume without knowing what you're applying for.
                  </p>
                </div>
              )
            )}
          </div>
        )}
      </main>

    </div>
  );
}

export default App;
