import { withRotation } from "./_lib/gemini.js";

export const config = { maxDuration: 60 };

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }
  try {
    const { prompt, imageData, mimeType = "image/png" } = req.body || {};
    if (!prompt || !imageData) {
      return res.status(400).json({ error: "Missing prompt or imageData" });
    }

    const result: any = await withRotation((genAI) =>
      genAI.models.generateContent({
        model: "gemini-2.5-flash-image",
        contents: {
          parts: [
            { inlineData: { data: imageData, mimeType } },
            { text: prompt },
          ],
        } as any,
      })
    );

    let newImageData = "";
    const parts = result?.candidates?.[0]?.content?.parts || [];
    for (const part of parts) {
      if (part?.inlineData?.data) {
        newImageData = part.inlineData.data;
        break;
      }
    }

    return res.status(200).json({ imageData: newImageData });
  } catch (err: any) {
    return res
      .status(500)
      .json({ error: err?.message || "Failed to edit image" });
  }
}
