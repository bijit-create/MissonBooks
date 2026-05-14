import { removeBackground as imglyRemove } from "@imgly/background-removal";

export interface BgRemovalProgress {
  key: string;
  current: number;
  total: number;
}

/**
 * Remove background from an image (data URL in, data URL out).
 * Uses BRIA RMBG via @imgly/background-removal. The first call downloads
 * the ONNX model (~30MB) into IndexedDB; subsequent calls are instant.
 */
export async function removeBackground(
  srcDataUrl: string,
  onProgress?: (p: BgRemovalProgress) => void
): Promise<string> {
  const blob = await (await fetch(srcDataUrl)).blob();
  const result = await imglyRemove(blob, {
    output: { format: "image/png", quality: 0.92 },
    progress: onProgress
      ? (key: string, current: number, total: number) =>
          onProgress({ key, current, total })
      : undefined,
  });
  return await blobToDataUrl(result);
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(new Error("Failed to read transparent PNG"));
    r.readAsDataURL(blob);
  });
}
