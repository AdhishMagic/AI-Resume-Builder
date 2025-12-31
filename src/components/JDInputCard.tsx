import { useState } from "react";

type Props = {
  initialValue?: string;
  onSubmit: (jdText: string) => void;
};

export function JDInputCard({ initialValue = "", onSubmit }: Props) {
  const [jdText, setJdText] = useState(initialValue);

  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700 shadow-xl overflow-hidden h-[260px] flex flex-col">
      <div className="p-3 bg-gray-700/40 border-b border-gray-700 flex items-center justify-between">
        <h3 className="text-sm font-bold text-gray-200">Job Description</h3>
        <span className="text-[11px] text-gray-400">Paste JD to analyze</span>
      </div>

      <div className="p-3 flex-1 flex flex-col gap-2 min-h-0">
        <textarea
          value={jdText}
          onChange={(e) => setJdText(e.target.value)}
          placeholder="Paste the Job Description here..."
          className="w-full flex-1 min-h-0 bg-gray-900 border border-gray-600 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500 resize-none text-sm"
        />
        <div className="flex justify-end">
          <button
            onClick={() => onSubmit(jdText)}
            disabled={jdText.trim().length < 50}
            className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Analyze JD
          </button>
        </div>
        <div className="text-[11px] text-gray-500">
          Minimum ~50 characters to analyze.
        </div>
      </div>
    </div>
  );
}
