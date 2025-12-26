import { useState, useMemo } from 'react';
import { OrchestratorAgent, OrchestratorInput } from './agents/OrchestratorAgent';

function App() {
  const [message, setMessage] = useState('');
  const [phase, setPhase] = useState(1);
  const [hasResumeJSON, setHasResumeJSON] = useState(false);

  const result = useMemo(() => {
    const input: OrchestratorInput = {
      message,
      resumeJSON: hasResumeJSON ? {} : null,
      phase
    };
    return OrchestratorAgent.route(input);
  }, [message, phase, hasResumeJSON]);

  return (
    <div className="container mx-auto p-8 max-w-2xl">
      <h1 className="text-3xl font-bold mb-6 text-blue-400">Orchestrator Agent Debugger</h1>

      <div className="space-y-6 bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-700">

        {/* Phase Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Current Phase</label>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((p) => (
              <button
                key={p}
                onClick={() => setPhase(p)}
                className={`px-4 py-2 rounded-lg transition-colors ${phase === p
                    ? 'bg-blue-600 text-white ring-2 ring-blue-400'
                    : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                  }`}
              >
                Phase {p}
              </button>
            ))}
          </div>
        </div>

        {/* Input Message */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">User Message</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type a message (e.g., 'improve my resume', 'job description')"
            className="w-full h-32 bg-gray-900 border border-gray-600 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </div>

        {/* Resume JSON Toggle */}
        <div className="flex items-center gap-3">
          <input
            id="resumeJson"
            type="checkbox"
            checked={hasResumeJSON}
            onChange={(e) => setHasResumeJSON(e.target.checked)}
            className="w-5 h-5 rounded border-gray-600 text-blue-600 focus:ring-blue-500 bg-gray-900"
          />
          <label htmlFor="resumeJson" className="text-gray-300 select-none cursor-pointer">
            Resume JSON Exists (Simulate non-null)
          </label>
        </div>

        {/* Output */}
        <div className="mt-8 pt-6 border-t border-gray-700">
          <h2 className="text-xl font-semibold mb-4 text-gray-200">Orchestrator Decision</h2>
          <div className="bg-black/50 p-4 rounded-lg font-mono text-sm overflow-x-auto border border-gray-800">
            <pre className="text-green-400">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
            <div className="p-3 bg-gray-900 rounded border border-gray-700">
              <span className="text-gray-500 block mb-1">Intent</span>
              <span className="font-bold text-white">{result.intent}</span>
            </div>
            <div className="p-3 bg-gray-900 rounded border border-gray-700">
              <span className="text-gray-500 block mb-1">Agent</span>
              <span className="font-bold text-purple-400">{result.agentToCall || 'null'}</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

export default App;
