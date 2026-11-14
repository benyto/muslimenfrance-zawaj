import sharp from "sharp";

// What a member may upload. Everything is decoded by libvips, so this is a
// check on the actual bytes, not on a filename or a Content-Type header the
// client chose. (HEIC isn't here: prebuilt libvips doesn't ship it. Phones
// convert to JPEG when the file picker is limited to these types.)
const SUPPORTED_FORMATS = new Set(["jpeg", "png", "webp", "gif", "avif", "tiff"]);
const MAX_INPUT_PIXELS = 50_000_000;

export class InvalidImageError extends Error {}

export type ProcessedPhoto = { display: Buffer; thumb: Buffer };

/**
 * Re-encodes an upload into the two WebP files the app stores.
 *
 * - Decoding then re-encoding is what makes the stored file trustworthy: a
 *   renamed script or a polyglot file fails to decode, and a valid image is
 *   rebuilt from pixels only.
 * - sharp drops all metadata on output unless asked to keep it, so EXIF —
 *   including GPS coordinates and the camera's serial number — never reaches
 *   storage. `rotate()` first bakes the EXIF orientation into the pixels, so
 *   photos don't turn sideways once that metadata is gone.
 * - The original is not kept.
 */
export async function processPhoto(input: Buffer): Promise<ProcessedPhoto> {
  const open = () => sharp(input, { failOn: "error", limitInputPixels: MAX_INPUT_PIXELS });

  let format: string | undefined;
  try {
    format = (await open().metadata()).format;
  } catch {
    throw new InvalidImageError("not a decodable image");
  }
  if (!format || !SUPPORTED_FORMATS.has(format)) {
    throw new InvalidImageError(`unsupported format: ${format ?? "unknown"}`);
  }

  try {
    const base = open().rotate();
    const [display, thumb] = await Promise.all([
      base
        .clone()
        .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
        .webp({ quality: 82 })
        .toBuffer(),
      base
        .clone()
        .resize({ width: 640, height: 800, fit: "inside", withoutEnlargement: true })
        .webp({ quality: 76 })
        .toBuffer(),
    ]);
    return { display, thumb };
  } catch {
    // A truncated or corrupt file that passed the header check.
    throw new InvalidImageError("failed to process image");
  }
}
