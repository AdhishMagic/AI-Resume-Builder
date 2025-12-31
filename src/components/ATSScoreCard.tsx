import type { ATSAnalysis } from "../types";

type Props = {
  atsResult: ATSAnalysis | null;
  hasJd: boolean;
  isLoading?: boolean;
};

export function ATSScoreCard({ atsResult, hasJd, isLoading }: Props) {
  const waiting = !hasJd;

  const ats = atsResult?.ats_score ?? 0;
  const skill = atsResult?.skill_match_percentage ?? 0;
  const missing = atsResult?.missing_required_skills ?? [];

  const experienceIndicator = (atsResult?.section_wise_feedback?.experience || "")
    .replace(/^experience alignment\s*:\s*/i, "")
    .replace(/\.$/, "")
    .trim();

  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700 shadow-xl overflow-hidden h-[260px] flex flex-col">
      <div className="p-3 bg-gray-700/40 border-b border-gray-700 flex items-center justify-between">
        <h3 className="text-sm font-bold text-gray-200">ATS Score</h3>
        <span className="text-[11px] text-gray-400">Always visible</span>
      </div>

      <div className="p-4 flex-1 flex flex-col gap-3">
        {waiting ? (
          <div className="text-sm text-gray-400">
            <div className="text-2xl font-black text-white">Waiting for JD</div>
            <div className="text-xs text-gray-500 mt-1">Paste a Job Description to calculate your match.</div>
          </div>
        ) : isLoading ? (
          <div className="flex items-center gap-3 text-sm text-gray-300">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-green-500" />
            Calculating ATS score...
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-gray-900/60 border border-gray-700 rounded-lg p-3">
                <div className="text-[10px] text-gray-400 uppercase tracking-wider">ATS Match</div>
                <div className="text-3xl font-black text-white leading-tight">{ats}%</div>
              </div>
              <div className="bg-gray-900/60 border border-gray-700 rounded-lg p-3">
                <div className="text-[10px] text-gray-400 uppercase tracking-wider">Skill Match</div>
                <div className="text-3xl font-black text-white leading-tight">{skill}%</div>
              </div>
              <div className="bg-gray-900/60 border border-gray-700 rounded-lg p-3">
                <div className="text-[10px] text-gray-400 uppercase tracking-wider">Experience</div>
                <div className="text-lg font-bold text-white leading-tight">
                  {experienceIndicator || "N/A"}
                </div>
              </div>
            </div>

            <div className="flex-1 min-h-0">
              <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-2">Missing Required Skills</div>
              {missing.length === 0 ? (
                <div className="text-xs text-emerald-300">No missing required skills detected.</div>
              ) : (
                <div className="flex flex-wrap gap-1 max-h-[92px] overflow-auto pr-1">
                  {missing.slice(0, 14).map((s) => (
                    <span
                      key={s}
                      className="px-2 py-0.5 rounded text-[10px] bg-red-500/10 text-red-200 border border-red-500/20"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="text-[11px] text-gray-400">
              {atsResult?.overall_feedback || ""}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
