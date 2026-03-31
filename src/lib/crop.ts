import type { BoundingBox, UncropPad } from "./types";

// === EXISTING CROP FUNCTION — DO NOT MODIFY ===

const PADDING_TOP = 4;
const PADDING_BOTTOM = 5;
const PADDING_LR = 1;

export function cropExercise(
  pageDataUrl: string,
  bbox: BoundingBox
): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const bboxWidth = bbox.right - bbox.left;
      const bboxHeight = bbox.bottom - bbox.top;

      console.log(`[Crop] Input bbox:`, bbox);
      console.log(
        `[Crop] Source image: ${img.naturalWidth}x${img.naturalHeight}`
      );
      console.log(
        `[Crop] Bbox size: ${bboxWidth.toFixed(1)}% wide x ${bboxHeight.toFixed(1)}% tall`
      );

      if (bboxWidth < 1 || bboxHeight < 1) {
        console.warn(`[Crop] Bbox too small (<1%), falling back to full page`);
        resolve(pageDataUrl);
        return;
      }

      // Apply padding, snap column right edges, and clamp to 0–100
      const top = Math.max(0, bbox.top - PADDING_TOP);
      const left = Math.max(0, bbox.left - PADDING_LR);
      const bottom = Math.min(100, bbox.bottom + PADDING_BOTTOM);
      const columnRight = bbox.left < 50 ? 52 : 100;
      const right = Math.min(
        100,
        Math.max(bbox.right + PADDING_LR, columnRight)
      );

      const sx = (left / 100) * img.naturalWidth;
      const sy = (top / 100) * img.naturalHeight;
      const sw = ((right - left) / 100) * img.naturalWidth;
      const sh = ((bottom - top) / 100) * img.naturalHeight;

      console.log(
        `[Crop] Pixel region: sx=${sx.toFixed(0)}, sy=${sy.toFixed(0)}, sw=${sw.toFixed(0)}, sh=${sh.toFixed(0)}`
      );

      const canvas = document.createElement("canvas");
      canvas.width = sw;
      canvas.height = sh;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);

      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => {
      console.error(`[Crop] Failed to load source image`);
      resolve(pageDataUrl);
    };
    img.src = pageDataUrl;
  });
}

// === NEW: Full crop with extra padding for uncrop feature ===

export function cropExerciseFull(
  pageDataUrl: string,
  bbox: BoundingBox
): Promise<{ dataUrl: string; pad: UncropPad }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const bboxH = bbox.bottom - bbox.top;
      const bboxW = bbox.right - bbox.left;
      const extraV = bboxH * 0.3;
      const extraH = bboxW * 0.25;

      // Display crop region (replicates cropExercise logic for offset calculation)
      const displayTop = Math.max(0, bbox.top - PADDING_TOP);
      const displayLeft = Math.max(0, bbox.left - PADDING_LR);
      const displayBottom = Math.min(100, bbox.bottom + PADDING_BOTTOM);
      const columnRight = bbox.left < 50 ? 52 : 100;
      const displayRight = Math.min(
        100,
        Math.max(bbox.right + PADDING_LR, columnRight)
      );

      // Full crop region = display + extra padding
      const fullTop = Math.max(0, displayTop - extraV);
      const fullLeft = Math.max(0, displayLeft - extraH);
      const fullBottom = Math.min(100, displayBottom + extraV);
      const fullRight = Math.min(100, displayRight + extraH);

      const sx = (fullLeft / 100) * img.naturalWidth;
      const sy = (fullTop / 100) * img.naturalHeight;
      const sw = ((fullRight - fullLeft) / 100) * img.naturalWidth;
      const sh = ((fullBottom - fullTop) / 100) * img.naturalHeight;

      // Pixel padding: how many pixels of extra context on each side
      const padTopPx = ((displayTop - fullTop) / 100) * img.naturalHeight;
      const padBottomPx = ((fullBottom - displayBottom) / 100) * img.naturalHeight;
      const padLeftPx = ((displayLeft - fullLeft) / 100) * img.naturalWidth;
      const padRightPx = ((fullRight - displayRight) / 100) * img.naturalWidth;

      const canvas = document.createElement("canvas");
      canvas.width = Math.round(sw);
      canvas.height = Math.round(sh);
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);

      resolve({
        dataUrl: canvas.toDataURL("image/png"),
        pad: {
          top: Math.round(padTopPx),
          right: Math.round(padRightPx),
          bottom: Math.round(padBottomPx),
          left: Math.round(padLeftPx),
        },
      });
    };
    img.onerror = () => {
      resolve({
        dataUrl: pageDataUrl,
        pad: { top: 0, right: 0, bottom: 0, left: 0 },
      });
    };
    img.src = pageDataUrl;
  });
}

// Crop the visible region from the full crop image given expand values
export function cropFromFull(
  fullDataUrl: string,
  pad: UncropPad,
  expand: UncropPad
): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const sx = pad.left - expand.left;
      const sy = pad.top - expand.top;
      const sw =
        img.naturalWidth - pad.left - pad.right + expand.left + expand.right;
      const sh =
        img.naturalHeight - pad.top - pad.bottom + expand.top + expand.bottom;

      const canvas = document.createElement("canvas");
      canvas.width = Math.round(sw);
      canvas.height = Math.round(sh);
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(
        img,
        sx,
        sy,
        sw,
        sh,
        0,
        0,
        canvas.width,
        canvas.height
      );
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => resolve(fullDataUrl);
    img.src = fullDataUrl;
  });
}

// Get the effective crop for an exercise (applies uncrop expansion if any)
export async function getEffectiveCrop(
  croppedDataUrl: string,
  fullCroppedDataUrl: string,
  pad: UncropPad,
  expand: UncropPad
): Promise<string> {
  if (
    expand.top === 0 &&
    expand.right === 0 &&
    expand.bottom === 0 &&
    expand.left === 0
  ) {
    return croppedDataUrl;
  }
  return cropFromFull(fullCroppedDataUrl, pad, expand);
}
