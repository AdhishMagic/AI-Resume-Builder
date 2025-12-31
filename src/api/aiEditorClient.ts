import type { ResumeProfile } from "../types";

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
  const res = await fetch("/api/ai-editor", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });

  const data = (await res.json().catch(() => null)) as AiEditorResponse | null;

  // Prefer server-provided JSON error message even on non-2xx responses.
  if (data && data.status === "error") {
    const suffix = res.ok ? "" : ` (HTTP ${res.status})`;
    throw new Error(`${data.message || "AI Editor request failed."}${suffix}`);
  }

  if (!res.ok) {
    throw new Error(`AI Editor request failed. (HTTP ${res.status})`);
  }

  if (!data || data.status !== "success") {
    throw new Error("AI Editor request failed.");
  }

  return data;
}
