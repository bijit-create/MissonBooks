import html2canvas from "html2canvas";
import jsPDF from "jspdf";

const A4_WIDTH_PT = 595.28;
const A4_HEIGHT_PT = 841.89;

export async function exportPagesToPdf(
  pages: HTMLElement[]
): Promise<Blob> {
  if (pages.length === 0) {
    throw new Error("No pages to export.");
  }

  const doc = new jsPDF({ unit: "pt", format: "a4", compress: true });

  for (let i = 0; i < pages.length; i++) {
    const el = pages[i];
    const canvas = await html2canvas(el, {
      scale: 2,
      backgroundColor: "#ffffff",
      useCORS: true,
      logging: false,
      windowWidth: el.scrollWidth,
      windowHeight: el.scrollHeight,
    });
    const imgData = canvas.toDataURL("image/jpeg", 0.92);
    if (i > 0) doc.addPage("a4");
    doc.addImage(imgData, "JPEG", 0, 0, A4_WIDTH_PT, A4_HEIGHT_PT, undefined, "FAST");
  }

  return doc.output("blob");
}
