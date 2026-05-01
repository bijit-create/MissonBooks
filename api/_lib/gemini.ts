import { GoogleGenAI } from "@google/genai";
import { nextKey, keyCount } from "./keys.js";

export async function withRotation<T>(
  fn: (genAI: GoogleGenAI) => Promise<T>
): Promise<T> {
  const attempts = Math.max(keyCount, 1);
  let lastError: any;
  for (let i = 0; i < attempts; i++) {
    const apiKey = nextKey();
    try {
      const genAI = new GoogleGenAI({ apiKey });
      return await fn(genAI);
    } catch (err: any) {
      lastError = err;
      const msg = String(err?.message || "");
      const status = err?.status ?? err?.code;
      const isQuota =
        status === 429 ||
        /quota|rate.?limit|RESOURCE_EXHAUSTED|too many requests/i.test(msg);
      const isAuth =
        status === 401 ||
        status === 403 ||
        /API key not valid|API_KEY_INVALID|PERMISSION_DENIED|unauthorized/i.test(
          msg
        );
      if (isQuota || isAuth) continue;
      throw err;
    }
  }
  throw lastError;
}
