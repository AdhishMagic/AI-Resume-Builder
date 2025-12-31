import { useEffect, useState } from 'react';
import { ResumeBuilder } from './components/ResumeBuilder';
import { ResumeEditor } from './components/ResumeEditor';
import type { ResumeProfile, JDAnalysis, ATSAnalysis } from './types';
import { analyzeJdLocal } from './utils/jdAnalyzerLocal';
import { ATSScoringAgent } from './agents/ATSScoringAgent';

function App() {
  // GLOBAL STATE MODEL (required)
  const [resumeState, setResumeState] = useState<ResumeProfile | null>(null);
  const [jdState, setJdState] = useState<string | null>(null);
  const [atsResult, setAtsResult] = useState<ATSAnalysis | null>(null);
  const [jdAnalysis, setJdAnalysis] = useState<JDAnalysis | null>(null);
  const [isAtsLoading, setIsAtsLoading] = useState(false);
  const [requestedPageCount, setRequestedPageCount] = useState<number>(1);

  const handleSubmitJd = (jdText: string) => {
    const text = String(jdText || "").trim();
    if (!text) {
      setJdState(null);
      return;
    }
    setJdState(text);
    setJdAnalysis(analyzeJdLocal(text));
  };

  // ON PAGE LOAD / ON JD INPUT: analyze JD (read-only)
  useEffect(() => {
    if (!jdState) {
      setJdAnalysis(null);
      setAtsResult(null);
      return;
    }

    const analysis = analyzeJdLocal(jdState);
    setJdAnalysis(analysis);
  }, [jdState]);

  // ON RESUME UPDATE (and when JD analysis exists): recalculate ATS only
  useEffect(() => {
    let mounted = true;
    const run = async () => {
      if (!resumeState || !jdState || !jdAnalysis) {
        return;
      }
      setIsAtsLoading(true);
      try {
        const result = await ATSScoringAgent.score(resumeState, jdAnalysis);
        if (mounted) setAtsResult(result);
      } finally {
        if (mounted) setIsAtsLoading(false);
      }
    };
    run();
    return () => {
      mounted = false;
    };
  }, [resumeState, jdState, jdAnalysis]);

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
              if (resumeState && confirm("Return to home? Unsaved changes will be lost.")) {
                setResumeState(null);
                setJdState(null);
                setAtsResult(null);
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

          {resumeState && (
            <div className="text-xs text-gray-400">
              Workspace
            </div>
          )}

          <div className="w-8"></div> {/* Spacer for balance */}
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="relative z-10 max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {!resumeState ? (
          <ResumeBuilder onGenerate={(profile, jd, pageCount) => {
            setResumeState(profile);
            if (jd && jd.trim()) setJdState(jd);
            setRequestedPageCount(pageCount || 1);
          }} />
        ) : (
          <div className="animate-slide-up-fade">
            <ResumeEditor
              resume={resumeState}
              requestedPageCount={requestedPageCount}
              jdState={jdState}
              jdAnalysis={jdAnalysis}
              atsResult={atsResult}
              isAtsLoading={isAtsLoading}
              onSubmitJd={handleSubmitJd}
              onClearJd={() => setJdState(null)}
              onUpdate={(updated) => setResumeState(updated)}
            />
          </div>
        )}
      </main>

    </div>
  );
}

export default App;
