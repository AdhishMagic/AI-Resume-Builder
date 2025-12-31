import type { ATSAnalysis, JDAnalysis } from "../types";

type Props = {
  jdAnalysis: JDAnalysis;
  atsResult: ATSAnalysis | null;
  onChangeJd: () => void;
};

function renderChips(items: string[], variant: "red" | "blue" | "gray") {
  const cls =
    variant === "red"
      ? "bg-red-500/10 text-red-200 border border-red-500/20"
      : variant === "blue"
        ? "bg-blue-500/10 text-blue-200 border border-blue-500/20"
        : "bg-gray-500/10 text-gray-200 border border-gray-500/20";

  if (!items.length) return <div className="text-xs text-gray-500">None detected.</div>;

  return (
    <div className="flex flex-wrap gap-1">
      {items.map((s) => (
        <span key={s} className={`px-2 py-0.5 rounded text-[10px] ${cls}`}>
          {s}
        </span>
      ))}
    </div>
  );
}

export function JDAnalyzerPanel({ jdAnalysis, atsResult, onChangeJd }: Props) {
  const suggestions: string[] = [];
  const missing = atsResult?.missing_required_skills || [];

  if (missing.length) {
    suggestions.push("Add missing required keywords only if you genuinely have the skill/experience.");
  }
  suggestions.push("Mirror JD terminology in Skills/Experience bullet wording (without exaggeration).");
  suggestions.push("Ensure experience bullets reflect the JD’s core responsibilities.");

  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700 shadow-xl overflow-hidden h-[260px] flex flex-col">
      <div className="p-3 bg-gray-700/40 border-b border-gray-700 flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-gray-200">JD Analyzer</h3>
          <div className="text-[11px] text-gray-400">
            {jdAnalysis.role_title ? jdAnalysis.role_title : "Job Description"}
            {jdAnalysis.experience_level ? ` • ${jdAnalysis.experience_level}` : ""}
          </div>
        </div>
        <button
          onClick={onChangeJd}
          className="text-xs text-blue-300 hover:text-blue-200 hover:underline"
          type="button"
        >
          Change JD
        </button>
      </div>

      <div className="p-3 flex-1 min-h-0 overflow-auto space-y-3">
        <div>
          <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-2">Required Skills</div>
          {renderChips(jdAnalysis.required_skills.slice(0, 30), "red")}
        </div>

        <div>
          <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-2">Nice-to-have Skills</div>
          {renderChips(jdAnalysis.preferred_skills.slice(0, 30), "blue")}
        </div>

        <div>
          <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-2">Role Focus Areas</div>
          {jdAnalysis.responsibilities.length ? (
            <ul className="list-disc list-inside text-xs text-gray-200 space-y-1">
              {jdAnalysis.responsibilities.slice(0, 6).map((r, idx) => (
                <li key={idx}>{r}</li>
              ))}
            </ul>
          ) : (
            <div className="text-xs text-gray-500">No responsibilities extracted.</div>
          )}
        </div>

        <div>
          <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-2">Improvement Suggestions</div>
          <ul className="list-disc list-inside text-xs text-gray-200 space-y-1">
            {suggestions.map((s, idx) => (
              <li key={idx}>{s}</li>
            ))}
          </ul>
        </div>

        <div>
          <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-2">Keywords</div>
          {renderChips(jdAnalysis.keywords.slice(0, 30), "gray")}
        </div>
      </div>
    </div>
  );
}
