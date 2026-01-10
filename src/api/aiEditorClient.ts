import type { ResumeProfile } from "../types";
import { aiEditResume } from "./aiRuntime";

export type AiEditorMode = "1-page" | "2-page";

export type AiEditorRequest = {
  command: string;
  resume: ResumeProfile;
  mode: AiEditorMode;
};

export type AiEditorSuccess = {
  status: "success";
  updatedResume: ResumeProfile;
  explanation: string;
};

export type AiEditorError = {
  status: "error";
  message: string;
};

export type AiEditorResponse = AiEditorSuccess | AiEditorError;

export async function postAiEditor(req: AiEditorRequest): Promise<AiEditorSuccess> {
  const result = await aiEditResume({ command: req.command, resume: req.resume, mode: req.mode });
  return {
    status: "success",
    updatedResume: result.updatedResume,
    explanation: result.explanation,
  };
}
