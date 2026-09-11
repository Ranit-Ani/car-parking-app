// ─── Profile photo crop + compression helpers ──────────────────────────────
// Used by PhotoCropModal to turn a user-selected crop region into a small,
// good-quality square JPEG entirely in the browser — the server never sees
// (or stores) the original full-size image, only this final result.

// Preferred output edge length (px). WhatsApp-style avatars don't need to be
// huge; this comfortably covers every place the photo is displayed
// (sidebar thumbnail, profile page, full "view photo" modal) while keeping
// file size low.
const PREFERRED_OUTPUT_SIZE = 640;
// Fallback sizes tried (largest first) if compression at PREFERRED_OUTPUT_SIZE
// can't hit the target size without going below an acceptable quality floor.
const FALLBACK_SIZES = [512, 400, 320];
// JPEG quality ladder — starts high and only steps down as far as needed,
// so we don't over-compress images that would already fit at high quality.
const QUALITY_STEPS = [0.92, 0.85, 0.78, 0.7, 0.6, 0.5, 0.4];
// Target ceiling for the final file (~1MB).
export const TARGET_MAX_BYTES = 1024 * 1024;

/**
 * Crop the visible circular-viewport region out of `img` using the current
 * pan/zoom transform, then encode it as a compressed JPEG data URL that is
 * resized/quality-tuned to land at or under `maxBytes`.
 */
export async function cropAndCompress({ img, natural, baseScale, zoom, offset, viewport, maxBytes = TARGET_MAX_BYTES }) {
  const dw = natural.w * baseScale * zoom;
  const dh = natural.h * baseScale * zoom;
  const imgLeft = (viewport - dw) / 2 + offset.x;
  const imgTop = (viewport - dh) / 2 + offset.y;
  const sourceScale = 1 / (baseScale * zoom);

  let srcX = -imgLeft * sourceScale;
  let srcY = -imgTop * sourceScale;
  let srcW = viewport * sourceScale;
  let srcH = viewport * sourceScale;

  // Guard against floating-point drift pushing the source rect a hair
  // outside the actual image bounds.
  srcX = Math.max(0, Math.min(srcX, Math.max(0, natural.w - srcW)));
  srcY = Math.max(0, Math.min(srcY, Math.max(0, natural.h - srcH)));
  srcW = Math.min(srcW, natural.w - srcX);
  srcH = Math.min(srcH, natural.h - srcY);

  const sizes = [PREFERRED_OUTPUT_SIZE, ...FALLBACK_SIZES];
  let lastBlob = null;

  for (let i = 0; i < sizes.length; i++) {
    const size = sizes[i];
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, size, size);

    const blob = await compressCanvas(canvas, maxBytes);
    if (!blob) continue;
    lastBlob = blob;
    // Good enough — either under the target size, or we're out of smaller
    // sizes to fall back to, so use whatever the quality ladder produced.
    if (blob.size <= maxBytes || i === sizes.length - 1) break;
  }

  if (!lastBlob) throw new Error('Could not process image');
  return blobToDataUrl(lastBlob);
}

// Walks a descending JPEG quality ladder (canvas.toBlob is async) and stops
// as soon as the encoded size fits under maxBytes, so quality is only
// reduced as far as actually necessary.
function compressCanvas(canvas, maxBytes) {
  return new Promise((resolve) => {
    let i = 0;
    const tryNext = () => {
      const q = QUALITY_STEPS[Math.min(i, QUALITY_STEPS.length - 1)];
      canvas.toBlob(
        (blob) => {
          if (!blob) return resolve(null);
          if (blob.size <= maxBytes || i >= QUALITY_STEPS.length - 1) return resolve(blob);
          i++;
          tryNext();
        },
        'image/jpeg',
        q
      );
    };
    tryNext();
  });
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
