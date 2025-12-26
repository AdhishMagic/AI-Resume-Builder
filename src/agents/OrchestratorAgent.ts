export type Intent = 'GENERATE_RESUME' | 'EDIT_RESUME' | 'ANALYZE_JD' | 'ALIGN_WITH_JD' | 'SCORE_ATS' | 'UNSUPPORTED';
export type AgentType = 'ResumeGeneratorAgent' | 'ResumeEditAgent' | 'JDAnalyzerAgent' | 'ResumeJDMergerAgent' | 'ATSScoringAgent' | null;

export interface OrchestratorInput {
    message: string;
    resumeJSON: object | null;
    phase: number;
}

export interface OrchestratorOutput {
    intent: Intent;
    agentToCall: AgentType;
    reason: string;
}

export class OrchestratorAgent {
    public static route(input: OrchestratorInput): OrchestratorOutput {
        const { message, resumeJSON, phase } = input;
        const lowerMsg = message.toLowerCase();

        // 1. Intent Detection
        let intent: Intent = 'UNSUPPORTED';

        if (resumeJSON === null) {
            intent = 'GENERATE_RESUME';
        } else if (lowerMsg.includes('improve') || lowerMsg.includes('edit') || lowerMsg.includes('rewrite') || lowerMsg.includes('change')) {
            intent = 'EDIT_RESUME';
        } else if (lowerMsg.includes('job description') || lowerMsg.includes('jd') || lowerMsg.includes('role')) {
            intent = 'ANALYZE_JD';
        } else if (lowerMsg.includes('optimize') || lowerMsg.includes('tailor') || lowerMsg.includes('match')) {
            intent = 'ALIGN_WITH_JD';
        } else if (lowerMsg.includes('ats') || lowerMsg.includes('score')) {
            intent = 'SCORE_ATS';
        } else {
            intent = 'UNSUPPORTED';
        }

        // 2. Phase Enforcement & 3. FailSafe
        if (intent === 'UNSUPPORTED') {
            return {
                intent: 'UNSUPPORTED',
                agentToCall: null,
                reason: 'Action not permitted or unclear'
            };
        }

        let isAllowed = false;
        if (phase >= 1 && intent === 'GENERATE_RESUME') isAllowed = true;
        if (phase >= 2 && intent === 'EDIT_RESUME') isAllowed = true;
        if (phase >= 3 && (intent === 'ANALYZE_JD' || intent === 'ALIGN_WITH_JD')) isAllowed = true;
        if (phase >= 4 && intent === 'SCORE_ATS') isAllowed = true;

        // Phase 5 allows ALL, which is implicitly covered if the above checks pass? 
        // No, Phase 5 adds Voice Handling which isn't an intent here yet, but allows ALL previous.
        // The prompt says "Phase 5 allows: ALL". 
        // The intents list only goes up to SCORE_ATS.
        // So Phase 5 logically permits everything Phase 4 permits + Voice. 
        // Since Voice isn't in Intent list, we just ensure Phase 5 permits all defined intents.
        if (phase >= 5) isAllowed = true;


        if (!isAllowed) {
            // Technically strict rules say "If an action is not allowed, BLOCK it".
            // Failsafe says if rules cannot be followed -> UNSUPPORTED.
            return {
                intent: 'UNSUPPORTED',
                agentToCall: null,
                reason: 'Phase restriction: Action not allowed in current phase'
            };
        }

        // 4. Map to Agent
        let agent: AgentType = null;
        switch (intent) {
            case 'GENERATE_RESUME': agent = 'ResumeGeneratorAgent'; break;
            case 'EDIT_RESUME': agent = 'ResumeEditAgent'; break;
            case 'ANALYZE_JD': agent = 'JDAnalyzerAgent'; break;
            case 'ALIGN_WITH_JD': agent = 'ResumeJDMergerAgent'; break;
            case 'SCORE_ATS': agent = 'ATSScoringAgent'; break;
        }

        return {
            intent: intent,
            agentToCall: agent,
            reason: 'Intent detected and phase permitted'
        };
    }
}
