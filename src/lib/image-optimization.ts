interface ImageParams {
  url: string;
  width: number;
  quality?: number;
}

/**
 * Generate Vercel-optimized image URL for production, original URL for development
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

  // In production on Vercel, use Image Optimization API
  const params = new URLSearchParams({
    url,
    w: width.toString(),
    q: quality.toString(),
  });

  return `/_vercel/image?${params.toString()}`;
}

/**
 * Generate srcset for responsive images with multiple widths
 */
export function generateSrcSet(url: string, widths: number[]): string {
  return widths
    .map(w => `${getOptimizedImageUrl({ url, width: w })} ${w}w`)
    .join(", ");
}

/**
 * Card width breakpoints matching CSS variables
 */
export const CARD_WIDTHS = {
  small: [150, 200, 300],
  medium: [200, 300, 400],
  large: [300, 400, 600],
} as const;
