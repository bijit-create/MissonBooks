import { withRotation } from "./_lib/gemini.js";

export const config = { maxDuration: 60 };

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }
  try {
    const { prompt, imageSize = "1K" } = req.body || {};
    if (!prompt) return res.status(400).json({ error: "Missing prompt" });

    const result: any = await withRotation((genAI) =>
      genAI.models.generateContent({
        model: "gemini-3.1-flash-image-preview",
        contents: { parts: [{ text: prompt }] } as any,
        config: { imageConfig: { aspectRatio: "1:1", imageSize } } as any,
      })
    );

    let imageData = "";
    const parts = result?.candidates?.[0]?.content?.parts || [];
    for (const part of parts) {
      if (part?.inlineData?.data) {
        imageData = part.inlineData.data;
        break;
      }
    }

    return res.status(200).json({ imageData });
  } catch (err: any) {
    return res
      .status(500)
      .json({ error: err?.message || "Failed to generate image" });
  }
}
