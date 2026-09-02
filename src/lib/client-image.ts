"use client";

/**
 * Client-side image compression.
 *
 * Resizes + re-encodes any payment screenshot in the browser so the payload
 * sent to the backend is ALWAYS below the target size (default 1.5 MB binary,
 * well under the 2 MB requirement) — preventing HTTP 413 payload errors and
 * slow uploads on mobile connections.
 */

export type CompressedImage = {
  dataUrl: string;
  /** approximate binary size in bytes after compression */
  bytes: number;
  width: number;
  height: number;
};

const TARGET_BYTES = 1.5 * 1024 * 1024; // 1.5 MB binary target (< 2 MB requirement)
const MAX_DIMENSION = 1600;
const MIN_QUALITY = 0.4;

function dataUrlBytes(dataUrl: string): number {
  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  return Math.floor(base64.length * 0.75);
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read the selected image."));
    };
    image.src = url;
  });
}

export async function compressImageFile(
  file: File,
  options?: { targetBytes?: number; maxDimension?: number },
): Promise<CompressedImage> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Please select an image file (PNG, JPG or WEBP).");
  }

  const targetBytes = options?.targetBytes ?? TARGET_BYTES;
  const maxDimension = options?.maxDimension ?? MAX_DIMENSION;

  const image = await loadImage(file);

  let { width, height } = image;
  const scale = Math.min(1, maxDimension / Math.max(width, height));
  width = Math.max(1, Math.round(width * scale));
  height = Math.max(1, Math.round(height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Image processing is not supported in this browser.");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);

  // Iteratively lower JPEG quality (and dimensions if needed) until we are
  // comfortably under the target payload size.
  let quality = 0.86;
  let dataUrl = canvas.toDataURL("image/jpeg", quality);

  while (dataUrlBytes(dataUrl) > targetBytes && quality > MIN_QUALITY) {
    quality = Math.max(MIN_QUALITY, quality - 0.12);
    dataUrl = canvas.toDataURL("image/jpeg", quality);
  }

  // Last resort: shrink dimensions until it fits.
  while (dataUrlBytes(dataUrl) > targetBytes && canvas.width > 480) {
    canvas.width = Math.round(canvas.width * 0.8);
    canvas.height = Math.round(canvas.height * 0.8);
    const ctx = canvas.getContext("2d");
    if (!ctx) break;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    dataUrl = canvas.toDataURL("image/jpeg", quality);
  }

  return {
    dataUrl,
    bytes: dataUrlBytes(dataUrl),
    width: canvas.width,
    height: canvas.height,
  };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
