/**
 * Repair JSON that contains bare backslashes from stray LaTeX (\frac, \times…).
 * Replaces any backslash NOT followed by a valid JSON escape with a doubled one.
 */
function repairJson(s: string): string {
  return s.replace(/\\(?!["\\/bfnrtu])/g, "\\\\");
}

export function parseLooseJson<T = any>(s: string): T {
  try {
    return JSON.parse(s);
  } catch {
    return JSON.parse(repairJson(s)) as T;
  }
}

export async function callApi<T>(endpoint: string, body: any): Promise<T> {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  let data: any;
  try {
    data = await res.json();
  } catch {
    throw new Error(`API ${endpoint} returned non-JSON (HTTP ${res.status})`);
  }
  if (!res.ok) {
    throw new Error(data?.error || `API ${endpoint} failed (HTTP ${res.status})`);
  }
  return data as T;
}
