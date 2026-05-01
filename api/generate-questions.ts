import { withRotation } from "./_lib/gemini.js";

export const config = { maxDuration: 60 };

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }
  try {
    const { prompt, referenceParts = [] } = req.body || {};
    if (!prompt) return res.status(400).json({ error: "Missing prompt" });

    const result = await withRotation((genAI) =>
      genAI.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: [
          { role: "user", parts: [...referenceParts, { text: prompt }] },
        ],
        config: { responseMimeType: "application/json" },
      })
    );

    return res.status(200).json({ text: result.text || "[]" });
  } catch (err: any) {
    return res
      .status(500)
      .json({ error: err?.message || "Failed to generate questions" });
  }
}
