const raw = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || "";

const keys = raw
  .split(",")
  .map((k) => k.trim())
  .filter(Boolean);

let cursor = 0;

export function nextKey(): string {
  if (keys.length === 0) {
    throw new Error(
      "No Gemini API keys configured. Set GEMINI_API_KEYS as a comma-separated list (e.g. GEMINI_API_KEYS=key1,key2)."
    );
  }
  const key = keys[cursor % keys.length];
  cursor = (cursor + 1) % keys.length;
  return key;
}

export const keyCount = keys.length;
