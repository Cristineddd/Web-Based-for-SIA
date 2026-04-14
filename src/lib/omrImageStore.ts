/**
 * Module-level store for passing an uploaded image from ExamDetails to OMRScanner.
 * Using a module variable instead of sessionStorage avoids the ~5MB quota limit
 * that causes QuotaExceededError with real camera photos.
 */
let _pendingImage: string | null = null;

export function setPendingImage(dataUrl: string): void {
  _pendingImage = dataUrl;
}

export function consumePendingImage(): string | null {
  const img = _pendingImage;
  _pendingImage = null;
  return img;
}
