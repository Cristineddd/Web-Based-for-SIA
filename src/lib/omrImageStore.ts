/**
 * Module-level store for passing an uploaded image from ExamDetails to OMRScanner.
 * Using a module variable instead of sessionStorage avoids the ~5MB quota limit
 * that causes QuotaExceededError with real camera photos.
 */
let _pendingImage: string | null = null;
let _pendingPage: 1 | 2 | null = null;

export function setPendingImage(dataUrl: string): void {
  _pendingImage = dataUrl;
}

export function consumePendingImage(): string | null {
  const img = _pendingImage;
  _pendingImage = null;
  return img;
}

export function setPendingPage(page: 1 | 2): void {
  _pendingPage = page;
}

export function consumePendingPage(): 1 | 2 | null {
  const page = _pendingPage;
  _pendingPage = null;
  return page;
}
