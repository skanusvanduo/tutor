import * as pdfjs from "pdfjs-dist";
import type { PageImage } from "./types";

pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

export async function renderPdfToImages(
  file: File,
  onProgress?: (current: number, total: number) => void
): Promise<PageImage[]> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
  const totalPages = pdf.numPages;
  const pages: PageImage[] = [];

  for (let i = 1; i <= totalPages; i++) {
    onProgress?.(i, totalPages);
    const page = await pdf.getPage(i);

    let scale = 1.5;
    let viewport = page.getViewport({ scale });

    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d")!;

    await page.render({ canvasContext: ctx, canvas, viewport }).promise;

    let dataUrl = canvas.toDataURL("image/png");

    // If too large, re-render at lower scale
    if (dataUrl.length > 10_000_000) {
      scale = 1;
      viewport = page.getViewport({ scale });
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, canvas, viewport }).promise;
      dataUrl = canvas.toDataURL("image/png");
    }

    pages.push({
      pageNumber: i,
      dataUrl,
      width: canvas.width,
      height: canvas.height,
    });
  }

  return pages;
}
