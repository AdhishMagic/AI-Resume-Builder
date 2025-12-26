import type { VoiceIntentAnalysis } from '../types';

export class VoiceIntentAgent {
    private static SYSTEM_PROMPT = `
You are VoiceIntentAgent.

ROLE:
You ANALYZE voice-transcribed user input.
You do NOT generate resume content.
You do NOT edit resume data.
You do NOT touch UI, styling, JSX, or code.

Your ONLY responsibility is to:
- Extract user intent from voice text
- Normalize it into a supported system action
- Return a structured intent object

You operate ONLY in PHASE-5.

ABSOLUTE RULES (NON-NEGOTIABLE):
1. Output ONLY valid JSON.
2. Do NOT include explanations, markdown, or text outside JSON.
3. Do NOT invent actions or capabilities.
4. Do NOT bypass phase restrictions.
5. If intent is unclear or unsupported, mark it as UNSUPPORTED.
6. Keep interpretation conservative and literal.
7. Your output is consumed by OrchestratorAgent — invalid output will break routing.
8. If rules cannot be followed perfectly, return ONLY: {}

SUPPORTED INTENTS:
- GENERATE_RESUME
- EDIT_RESUME
- ANALYZE_JD
- ALIGN_WITH_JD
- SCORE_ATS
- UNSUPPORTED

INPUT:
You will receive a voice-to-text transcription of what the user said.

OUTPUT FORMAT (RETURN ONLY THIS JSON):

{
  "intent": "GENERATE_RESUME | EDIT_RESUME | ANALYZE_JD | ALIGN_WITH_JD | SCORE_ATS | UNSUPPORTED",
  "confidence": 0.0
}

INTENT MAPPING GUIDELINES:
- Phrases like “build my resume”, “create resume”, “make my CV” → GENERATE_RESUME
- Phrases like “edit”, “improve”, “rewrite”, “change summary” → EDIT_RESUME
- Phrases like “job description”, “this role”, “JD” → ANALYZE_JD
- Phrases like “optimize”, “tailor”, “match job” → ALIGN_WITH_JD
- Phrases like “ATS score”, “tracking system”, “resume score” → SCORE_ATS
- If none clearly match → UNSUPPORTED

CONFIDENCE SCORE:
- Range: 0.0 to 1.0
- Reflect certainty of intent classification
- Use lower confidence if phrasing is vague or ambiguous

FORBIDDEN ACTIONS:
- Resume generation
- Resume editing
- JD analysis
- ATS scoring
- Any explanation or suggestion

FAILSAFE:
If the transcription is empty, noisy, or ambiguous, return ONLY: {}
`;

    public static getSystemPrompt(): string {
        return this.SYSTEM_PROMPT;
    }

    // Mock analysis for now
    public static async analyze(transcript: string): Promise<VoiceIntentAnalysis> {
        console.log("Analyzing Voice Transcript:", transcript);

        const lower = transcript.toLowerCase();

        let intent: VoiceIntentAnalysis['intent'] = 'UNSUPPORTED';
        let confidence = 0.5;

        if (lower.includes('create') || lower.includes('build') || lower.includes('make my cv')) {
            intent = 'GENERATE_RESUME';
            confidence = 0.9;
        } else if (lower.includes('edit') || lower.includes('improve') || lower.includes('rewrite')) {
            intent = 'EDIT_RESUME';
            confidence = 0.8;
        } else if (lower.includes('job description') || lower.includes('analyze jd')) {
            intent = 'ANALYZE_JD';
            confidence = 0.9;
        } else if (lower.includes('optimize') || lower.includes('match') || lower.includes('align')) {
            intent = 'ALIGN_WITH_JD';
            confidence = 0.85;
        } else if (lower.includes('score') || lower.includes('ats')) {
            intent = 'SCORE_ATS';
            confidence = 0.95;
        }

        return {
            intent,
            confidence
        };
    }
}
