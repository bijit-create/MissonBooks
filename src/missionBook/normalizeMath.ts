/**
 * Best-effort normalizer that converts plain-text math (the LLM forgets the
 * $...$ delimiters about half the time) into proper LaTeX so KaTeX can render.
 *
 * Conservative: only operates on portions of text that are NOT already inside
 * $...$ or $$...$$ regions, so anything the LLM did wrap stays untouched.
 */
export function normalizeMath(input: string | undefined): string {
  if (!input) return "";
  const text = input;

  // Walk the string, splitting into "math" (inside $..$) and "plain" regions.
  const out: string[] = [];
  let i = 0;
  while (i < text.length) {
    const dollar = text.indexOf("$", i);
    if (dollar === -1) {
      out.push(normalizePlain(text.slice(i)));
      break;
    }
    if (dollar > i) out.push(normalizePlain(text.slice(i, dollar)));

    // $$ or $?
    const isDisplay = text[dollar + 1] === "$";
    const close = isDisplay ? "$$" : "$";
    const searchFrom = dollar + close.length;
    const closeIdx = text.indexOf(close, searchFrom);
    if (closeIdx === -1) {
      // Unclosed delimiter — treat the rest as plain so we don't lose content
      out.push(normalizePlain(text.slice(dollar)));
      break;
    }
    out.push(text.slice(dollar, closeIdx + close.length));
    i = closeIdx + close.length;
  }
  return out.join("");
}

function normalizePlain(text: string): string {
  if (!text) return text;
  let s = text;

  // 1) Bare \frac{a}{b} without surrounding $...$ → wrap it.
  s = s.replace(/\\frac\{[^{}]+\}\{[^{}]+\}/g, (m) => `$${m}$`);

  // 2) Bare LaTeX-ish atoms (\times, \div, \cdot, \pi) followed/preceded by
  //    plain digits — wrap a short surrounding window.
  //    Conservative: only wrap one of these per match to avoid runaway.
  s = s.replace(
    /(\d+)\s*\\(times|div|cdot)\s*(\d+)/g,
    (_m, a, op, b) => `$${a} \\${op} ${b}$`
  );

  // 3) Mixed fractions like "5 1/2" → keep the integer outside, wrap the
  //    fraction part: "5 $\frac{1}{2}$".
  s = s.replace(
    /(?<![\/\d.])(\d+)\s+(\d+)\/(\d+)(?![\/\d])/g,
    (_m, whole, n, d) => `${whole} $\\frac{${n}}{${d}}$`
  );

  // 4) Plain integer/integer fractions → $\frac{n}{d}$. Lookbehind rejects
  //    dates (1/1/2025) and decimals (1.5/2).
  s = s.replace(
    /(?<![\/\d.])(\d+)\/(\d+)(?![\/\d])/g,
    (_m, n, d) => `$\\frac{${n}}{${d}}$`
  );

  // 5) Powers like x^2, x^{10}.
  s = s.replace(/\b([a-zA-Z]|\d+)\^(\{[^}]+\}|\d+)/g, (_m, base, exp) => `$${base}^${exp}$`);

  // 6) Unicode superscripts ²³⁴ etc.
  s = s.replace(
    /([a-zA-Z0-9])([²³⁴⁵⁶⁷⁸⁹⁰¹]+)/g,
    (_m, base, sup) => {
      const map: Record<string, string> = {
        "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4",
        "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9",
      };
      const exp = sup.split("").map((c: string) => map[c] || c).join("");
      return `$${base}^{${exp}}$`;
    }
  );

  return s;
}
