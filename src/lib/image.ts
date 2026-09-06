/**
 * Client-side helpers for preparing photos before upload.
 */

const MAX_EDGE = 1600;

/**
 * Downscales large photos and re-encodes as JPEG so uploads are small and
 * the vision model gets a format it can read. Falls back to the original
 * file when the browser can't decode it (e.g. HEIC).
 */
export async function prepareImage(file: File): Promise<{ blob: Blob; ext: string; type: string }> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Choose an image file.");
  }

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no canvas");
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.86)
    );
    if (!blob) throw new Error("encode failed");
    return { blob, ext: "jpg", type: "image/jpeg" };
  } catch {
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    return { blob: file, ext, type: file.type };
  }
}
