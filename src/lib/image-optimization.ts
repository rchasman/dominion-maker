interface ImageParams {
  url: string;
  width: number;
  quality?: number;
}

/**
 * Generate Vercel-optimized image URL for production, original URL for development
 * Uses Vercel's global CDN cache for optimal delivery
 */
export function getOptimizedImageUrl({
  url,
  width,
  quality = 75,
}: ImageParams): string {
  // In development, serve images directly
  if (import.meta.env.DEV) {
    return url;
  }

  // In production, use Vercel Image Optimization for CDN caching
  // Use relative URLs for same-origin images (Vercel static files)
  const params = new URLSearchParams({
    url, // Relative URL like /cards/Gold.webp
    w: width.toString(),
    q: quality.toString(),
  });

  return `/_vercel/image?${params.toString()}`;
}

/**
 * Generate srcset for responsive images with multiple widths
 * Vercel Image Optimization creates optimized variants for each width
 */
export function generateSrcSet(url: string, widths: number[]): string {
  return widths
    .map(w => `${getOptimizedImageUrl({ url, width: w })} ${w}w`)
    .join(", ");
}

/**
 * Card width breakpoints optimized for actual display sizes
 * Accounts for 1x and 2x pixel density displays
 */
export const CARD_WIDTHS = {
  small: [128, 256], // ~56px display = 128px for 2x DPI
  medium: [160, 320], // ~68px display = 160px for 2x DPI
  large: [200, 400], // ~90px display = 200px for 2x DPI
} as const;
