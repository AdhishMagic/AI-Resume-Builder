import { OrchestratorAgent, OrchestratorInput } from './agents/OrchestratorAgent';

const testCases: { name: string, input: OrchestratorInput, expectedIntent: string, expectedAgent: string | null }[] = [
    {
        name: "Generate Resume (No JSON)",
        input: { message: "", resumeJSON: null, phase: 1 },
        expectedIntent: "GENERATE_RESUME",
        expectedAgent: "ResumeGeneratorAgent"
    },
    {
        name: "Edit Resume (Phase 2 - Allowed)",
        input: { message: "improve my resume", resumeJSON: {}, phase: 2 },
        expectedIntent: "EDIT_RESUME",
        expectedAgent: "ResumeEditAgent"
    },
    {
        name: "Edit Resume (Phase 1 - Blocked)",
        input: { message: "improve my resume", resumeJSON: {}, phase: 1 },
        expectedIntent: "UNSUPPORTED",
        expectedAgent: null
    },
    {
        name: "Analyze JD (Phase 3 - Allowed)",
        input: { message: "analyze this job description", resumeJSON: {}, phase: 3 },
        expectedIntent: "ANALYZE_JD",
        expectedAgent: "JDAnalyzerAgent"
    },
    {
        name: "Align JD (Phase 2 - Blocked)",
        input: { message: "optimize for this role", resumeJSON: {}, phase: 2 },
        expectedIntent: "UNSUPPORTED",
        expectedAgent: null
    },
    {
        name: "ATS Score (Phase 4 - Allowed)",
        input: { message: "check ATS score", resumeJSON: {}, phase: 4 },
        expectedIntent: "SCORE_ATS",
        expectedAgent: "ATSScoringAgent"
    },
    {
        name: "Unknown Intent",
        input: { message: "hello world", resumeJSON: {}, phase: 5 },
        expectedIntent: "UNSUPPORTED",
        expectedAgent: null
    }
];

console.log("Running Orchestrator Tests...\n");

let passed = 0;
testCases.forEach((test, index) => {
    const result = OrchestratorAgent.route(test.input);
    const intentMatch = result.intent === test.expectedIntent;
    const agentMatch = result.agentToCall === test.expectedAgent;

    if (intentMatch && agentMatch) {
        console.log(`✅ [PASS] ${test.name}`);
        passed++;
    } else {
        console.log(`❌ [FAIL] ${test.name}`);
        console.log(`   Expected: ${test.expectedIntent} -> ${test.expectedAgent}`);
        console.log(`   Got:      ${result.intent} -> ${result.agentToCall}`);
        console.log(`   Reason:   ${result.reason}`);
    }
});

console.log(`\nSummary: ${passed}/${testCases.length} passed.`);

if (passed === testCases.length) {
    process.exit(0);
} else {
    process.exit(1);
}
