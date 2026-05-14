import html2canvas from "html2canvas";
import jsPDF from "jspdf";

const A4_WIDTH_PT = 595.28;
const A4_HEIGHT_PT = 841.89;

/**
 * Wait until ALL @font-face fonts have loaded so KaTeX's math fonts
 * (KaTeX_Math, KaTeX_Main, etc.) are available before html2canvas snapshots
 * the DOM. Without this, fraction bars render as crooked "T" shapes because
 * html2canvas captures with fallback fonts mid-flight.
 */
async function waitForFonts(): Promise<void> {
  try {
    const f: any = (document as any).fonts;
    if (f && typeof f.ready?.then === "function") {
      await f.ready;
    }
  } catch {
    // ignore — older browsers without FontFaceSet just skip the wait
  }
}

export async function exportPagesToPdf(
  pages: HTMLElement[]
): Promise<Blob> {
  if (pages.length === 0) {
    throw new Error("No pages to export.");
  }

  // Ensure custom (KaTeX) fonts are loaded so math renders correctly.
  await waitForFonts();
  // Give the browser a frame to settle any font-induced reflow.
  await new Promise<void>((r) => requestAnimationFrame(() => r()));

  const doc = new jsPDF({ unit: "pt", format: "a4", compress: true });

  for (let i = 0; i < pages.length; i++) {
    const el = pages[i];
    const canvas = await html2canvas(el, {
      // Higher scale → thin elements (KaTeX fraction bar, card borders) render
      // crisply instead of disappearing into 1-px aliasing.
      scale: 3,
      backgroundColor: "#ffffff",
      useCORS: true,
      logging: false,
      windowWidth: el.scrollWidth,
      windowHeight: el.scrollHeight,
    } as any);
    const imgData = canvas.toDataURL("image/jpeg", 0.93);
    if (i > 0) doc.addPage("a4");
    doc.addImage(imgData, "JPEG", 0, 0, A4_WIDTH_PT, A4_HEIGHT_PT, undefined, "FAST");
  }

  return doc.output("blob");
}
