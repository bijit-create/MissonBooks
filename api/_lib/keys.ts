let cursor = 0;
let cached: string[] | null = null;

function loadKeys(): string[] {
  if (cached) return cached;
  const raw = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || "";
  cached = raw
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);
  return cached;
}

export function nextKey(): string {
  const keys = loadKeys();
  if (keys.length === 0) {
    throw new Error(
      "No Gemini API keys configured. Set GEMINI_API_KEYS as a comma-separated list (e.g. GEMINI_API_KEYS=key1,key2)."
    );
  }
  const key = keys[cursor % keys.length];
  cursor = (cursor + 1) % keys.length;
  return key;
}

export function getKeyCount(): number {
  return loadKeys().length;
}
