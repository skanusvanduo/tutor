import type { Exercise } from "./types";
import { getEffectiveCrop } from "./crop";

const LOGICAL_WIDTH = 1200;
const SCALE = 2; // 2x for retina crispness
const CANVAS_WIDTH = LOGICAL_WIDTH * SCALE;
const MARGIN = 60;
const CONTENT_WIDTH = LOGICAL_WIDTH - MARGIN * 2; // 1080
const WORKSPACE_HEIGHT = 500;
const LABEL_HEIGHT = 40;
const SEPARATOR_GAP = 20;
const MAX_PAGE_HEIGHT = 12000;

interface LayoutItem {
  img: HTMLImageElement;
  label: string;
  scaledHeight: number;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export async function generateWorksheetPages(
  exercises: Exercise[]
): Promise<string[]> {
  // Get effective crops for all exercises
  // Use user-adjusted crop if available, otherwise use tight display crop
  const cropUrls = await Promise.all(
    exercises.map((ex) => {
      const userAdjusted = ex.croppedDataUrl !== ex.displayCroppedDataUrl;
      const baseUrl = userAdjusted ? ex.croppedDataUrl : ex.displayCroppedDataUrl;
      return userAdjusted
        ? Promise.resolve(baseUrl)
        : getEffectiveCrop(baseUrl, ex.fullCroppedDataUrl, ex.uncropPad, ex.uncropExpand);
    })
  );

  // Load all images and compute layout
  const items: LayoutItem[] = [];
  for (let i = 0; i < exercises.length; i++) {
    const img = await loadImage(cropUrls[i]);
    const scaledHeight =
      img.naturalHeight * (CONTENT_WIDTH / img.naturalWidth);
    items.push({
      img,
      label: `${i + 1}.`,
      scaledHeight,
    });
  }

  // Split into pages
  const pages: LayoutItem[][] = [];
  let currentPage: LayoutItem[] = [];
  let currentHeight = MARGIN; // top margin

  for (const item of items) {
    const sectionHeight =
      LABEL_HEIGHT + item.scaledHeight + WORKSPACE_HEIGHT + SEPARATOR_GAP;

    if (
      currentHeight + sectionHeight > MAX_PAGE_HEIGHT - MARGIN &&
      currentPage.length > 0
    ) {
      pages.push(currentPage);
      currentPage = [];
      currentHeight = MARGIN;
    }

    currentPage.push(item);
    currentHeight += sectionHeight;
  }
  if (currentPage.length > 0) {
    pages.push(currentPage);
  }

  // Render each page to a canvas
  const dataUrls: string[] = [];

  for (const pageItems of pages) {
    // Calculate total height for this page
    let totalHeight = MARGIN; // top margin
    for (const item of pageItems) {
      totalHeight +=
        LABEL_HEIGHT + item.scaledHeight + WORKSPACE_HEIGHT + SEPARATOR_GAP;
    }
    totalHeight += MARGIN; // bottom margin

    const canvas = document.createElement("canvas");
    canvas.width = LOGICAL_WIDTH * SCALE;
    canvas.height = Math.round(totalHeight) * SCALE;
    const ctx = canvas.getContext("2d")!;
    ctx.scale(SCALE, SCALE);

    // White background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, LOGICAL_WIDTH, totalHeight);

    let y = MARGIN;

    for (let i = 0; i < pageItems.length; i++) {
      const item = pageItems[i];

      // Exercise number label
      ctx.fillStyle = "#111111";
      ctx.font = "bold 28px sans-serif";
      ctx.fillText(item.label, MARGIN, y + 28);
      y += LABEL_HEIGHT;

      // Exercise image
      ctx.drawImage(item.img, MARGIN, y, CONTENT_WIDTH, item.scaledHeight);
      y += item.scaledHeight;

      // Workspace (just white space)
      y += WORKSPACE_HEIGHT;

      // Separator line (skip for last item)
      if (i < pageItems.length - 1) {
        ctx.strokeStyle = "#d1d5db";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(MARGIN, y);
        ctx.lineTo(CANVAS_WIDTH - MARGIN, y);
        ctx.stroke();
        y += SEPARATOR_GAP;
      }
    }

    dataUrls.push(canvas.toDataURL("image/png"));
  }

  return dataUrls;
}
