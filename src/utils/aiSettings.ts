export type AiProvider = 'gemini' | 'openai_compatible';

export type AiSettings = {
  provider: AiProvider;
  apiKey: string;
  baseUrl?: string;
  model?: string;
};

const LS_PROVIDER = 'ai_provider';
const LS_API_KEY = 'ai_api_key';
const LS_BASE_URL = 'ai_base_url';
const LS_MODEL = 'ai_model';

export function getAiSettings(): AiSettings {
  let provider: AiProvider = 'gemini';
  let apiKey = '';
  let baseUrl = '';
  let model = '';

  try {
    const p = String(window.localStorage.getItem(LS_PROVIDER) || '').trim();
    if (p === 'gemini' || p === 'openai_compatible') provider = p;

    apiKey = String(window.localStorage.getItem(LS_API_KEY) || '').trim();
    baseUrl = String(window.localStorage.getItem(LS_BASE_URL) || '').trim();
    model = String(window.localStorage.getItem(LS_MODEL) || '').trim();
  } catch {
    // ignore
  }

  return {
    provider,
    apiKey,
    baseUrl: baseUrl || undefined,
    model: model || undefined,
  };
}

export function saveAiSettings(next: Partial<AiSettings>) {
  try {
    if (next.provider) window.localStorage.setItem(LS_PROVIDER, next.provider);
    if (typeof next.apiKey === 'string') window.localStorage.setItem(LS_API_KEY, next.apiKey.trim());
    if (typeof next.baseUrl === 'string') window.localStorage.setItem(LS_BASE_URL, next.baseUrl.trim());
    if (typeof next.model === 'string') window.localStorage.setItem(LS_MODEL, next.model.trim());
  } catch {
    // ignore
  }
}

export function isAiConfigured(settings: AiSettings): boolean {
  if (!settings.apiKey || settings.apiKey.trim().length <= 10) return false;
  if (settings.provider === 'openai_compatible') {
    if (!settings.model || !settings.model.trim()) return false;
    // baseUrl optional; defaults server-side
  }
  return true;
}
