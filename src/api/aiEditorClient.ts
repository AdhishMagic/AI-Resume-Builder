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
  let runtimeApiKey = "";
  let runtimeProvider = "";
  let runtimeBaseUrl = "";
  let runtimeModel = "";
  try {
    runtimeApiKey = String(window.localStorage.getItem('ai_api_key') || "").trim();
    runtimeProvider = String(window.localStorage.getItem('ai_provider') || "").trim();
    runtimeBaseUrl = String(window.localStorage.getItem('ai_base_url') || "").trim();
    runtimeModel = String(window.localStorage.getItem('ai_model') || "").trim();
  } catch {
    runtimeApiKey = "";
    runtimeProvider = "";
    runtimeBaseUrl = "";
    runtimeModel = "";
  }

  let res: Response;
  try {
    res = await fetch("/api/ai-editor", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(runtimeApiKey ? { "x-ai-api-key": runtimeApiKey } : {}),
        ...(runtimeProvider ? { "x-ai-provider": runtimeProvider } : {}),
        ...(runtimeBaseUrl ? { "x-ai-base-url": runtimeBaseUrl } : {}),
        ...(runtimeModel ? { "x-ai-model": runtimeModel } : {}),
      },
      body: JSON.stringify(req),
    });
  } catch (_err) {
    throw new Error(
      "AI Editor server is not reachable. Start it with `npm run dev:api` (or `npm run dev:full`), then try again."
    );
  }

  const raw = await res.text().catch(() => "");
  let data: AiEditorResponse | null = null;
  try {
    data = raw ? (JSON.parse(raw) as AiEditorResponse) : null;
  } catch {
    data = null;
  }

  // Prefer server-provided JSON error message even on non-2xx responses.
  if (data && data.status === "error") {
    const suffix = res.ok ? "" : ` (HTTP ${res.status})`;
    throw new Error(`${data.message || "AI Editor request failed."}${suffix}`);
  }

  if (!res.ok) {
    // Vite proxy returns HTML/plain text on upstream connection errors (e.g., API server not running).
    const hint =
      res.status >= 500 && /ECONNREFUSED|connect\s+econnrefused|proxy/i.test(raw)
        ? " Ensure the API server is running: `npm run dev:api` (or `npm run dev:full`)."
        : "";

    throw new Error(`AI Editor request failed. (HTTP ${res.status})${hint}`);
  }

  if (!data || data.status !== "success") {
    throw new Error(
      "AI Editor request failed: invalid server response. If you are running Vite only, also start the API server with `npm run dev:api`."
    );
  }

  return data;
}
