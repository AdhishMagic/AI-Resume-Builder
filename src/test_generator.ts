import { ResumeGeneratorAgent } from './agents/ResumeGeneratorAgent';

console.log("Testing ResumeGeneratorAgent...\n");

const systemPrompt = ResumeGeneratorAgent.getSystemPrompt();
console.log("System Prompt Length:", systemPrompt.length);
console.log("System Prompt contains 'LOCKED JSON SCHEMA':", systemPrompt.includes("LOCKED JSON SCHEMA (CONTRACT)"));

// Mock Generation
console.log("\nTesting Mock Generation:");
ResumeGeneratorAgent.generate("I am a software engineer").then(result => {
    console.log("Generated JSON:", JSON.stringify(result, null, 2));
});
