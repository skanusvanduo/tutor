/**
 * Compress a data URL (PNG or JPEG) to JPEG for API transmission.
 * Returns raw base64 string (no data URI prefix).
 *
 * A typical 2× scale PDF page is ~5-8 MB as PNG base64.
 * After JPEG compression at quality 0.7 it drops to ~400-800 KB,
 * well within Vercel's 4.5 MB request body limit.
 */
export function compressForApi(
  dataUrl: string,
  quality = 0.7
): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      const jpeg = canvas.toDataURL("image/jpeg", quality);
      // Clean up
      canvas.width = 0;
      canvas.height = 0;
      resolve(jpeg.replace(/^data:image\/jpeg;base64,/, ""));
    };
    img.onerror = () => {
      // Fallback: strip whatever prefix and return raw base64
      resolve(dataUrl.replace(/^data:image\/[a-z]+;base64,/, ""));
    };
    img.src = dataUrl;
  });
}
