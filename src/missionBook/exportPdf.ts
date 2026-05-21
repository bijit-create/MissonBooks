import { toCanvas } from "html-to-image";
import jsPDF from "jspdf";

const A4_WIDTH_PT = 595.28;
const A4_HEIGHT_PT = 841.89;

// html-to-image inlines @font-face rules (including base64-encoding the actual
// .woff/.woff2 binaries) into the serialised SVG before rasterising it. That
// closes the gap html2canvas + foreignObjectRendering left open — where the
// page's web fonts (Inter for the question-number badges, KaTeX_* for math)
// dropped out of the snapshot and digits rendered as thin fallback glyphs.
//
// We still kick the document's FontFaceSet first so any lazy faces are present
// before html-to-image walks the stylesheets.
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
  // Page body / badge font — Tailwind's font-sans resolves to Inter.
  '700 9pt "Inter"',
  '400 9.5pt "Inter"',
  '600 10pt "Inter"',
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

  await waitForFonts();
  await new Promise<void>((r) => requestAnimationFrame(() => r()));

  const doc = new jsPDF({ unit: "pt", format: "a4", compress: true });

  for (let i = 0; i < pages.length; i++) {
    const el = pages[i];
    // pixelRatio 3 keeps thin elements (fraction bars, badge borders) crisp.
    // html-to-image inlines @font-face rules as data: URIs so the snapshot
    // actually paints with the page fonts instead of system fallbacks.
    const canvas = await toCanvas(el, {
      pixelRatio: 3,
      backgroundColor: "#ffffff",
      cacheBust: true,
      // Skip anything tagged screen-only (toolbars, +Add buttons, nudge UI).
      filter: (node) => {
        if (node instanceof HTMLElement) {
          if (node.dataset && node.dataset.screenOnly !== undefined) return false;
          if (node.hasAttribute && node.hasAttribute("data-screen-only")) return false;
        }
        return true;
      },
    });
    const imgData = canvas.toDataURL("image/jpeg", 0.93);
    if (i > 0) doc.addPage("a4");
    doc.addImage(imgData, "JPEG", 0, 0, A4_WIDTH_PT, A4_HEIGHT_PT, undefined, "FAST");
  }

  return doc.output("blob");
}
