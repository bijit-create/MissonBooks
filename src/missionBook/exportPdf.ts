import html2canvas from "html2canvas";
import jsPDF from "jspdf";

const A4_WIDTH_PT = 595.28;
const A4_HEIGHT_PT = 841.89;

// Browsers only fetch @font-face fonts on demand. document.fonts.ready alone
// doesn't trigger lazy loads, so we explicitly request every KaTeX face the
// math renderer can emit — otherwise html2canvas snapshots while KaTeX_Math /
// KaTeX_Size* are still missing and digits get painted with fallback glyphs
// (the "↑" artifacts seen in fractions).
const KATEX_FONT_SPECS: string[] = [
  '1em "KaTeX_AMS"',
  '1em "KaTeX_Caligraphic"',
  'bold 1em "KaTeX_Caligraphic"',
  '1em "KaTeX_Fraktur"',
  'bold 1em "KaTeX_Fraktur"',
  '1em "KaTeX_Main"',
  'bold 1em "KaTeX_Main"',
  'italic 1em "KaTeX_Main"',
  'bold italic 1em "KaTeX_Main"',
  'italic 1em "KaTeX_Math"',
  'bold italic 1em "KaTeX_Math"',
  '1em "KaTeX_SansSerif"',
  'bold 1em "KaTeX_SansSerif"',
  'italic 1em "KaTeX_SansSerif"',
  '1em "KaTeX_Script"',
  '1em "KaTeX_Size1"',
  '1em "KaTeX_Size2"',
  '1em "KaTeX_Size3"',
  '1em "KaTeX_Size4"',
  '1em "KaTeX_Typewriter"',
];

async function waitForFonts(): Promise<void> {
  try {
    const f: any = (document as any).fonts;
    if (!f) return;
    if (typeof f.load === "function") {
      await Promise.all(
        KATEX_FONT_SPECS.map((spec) => f.load(spec).catch(() => undefined))
      );
    }
    if (typeof f.ready?.then === "function") {
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
