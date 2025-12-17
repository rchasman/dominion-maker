interface ImageParams {
  url: string;
  width: number;
  quality?: number;
}

/**
 * Generate optimized image URL (serves WebP directly, already optimized at quality 85)
 * Vercel automatically compresses static assets with Brotli/Gzip
 */
export function getOptimizedImageUrl({ url }: ImageParams): string {
  // Serve WebP files directly - they're already optimized
  // No need for Vercel Image Optimization with static files
  return url;
}

/**
 * Generate srcset for responsive images with multiple widths
 * Browser picks the best size based on viewport and pixel density
 */
export function generateSrcSet(url: string, widths: number[]): string {
  // Serve same WebP file for all sizes (already optimized at 85 quality)
  // Browser handles resizing efficiently
  return widths.map(w => `${url} ${w}w`).join(", ");
}

/**
 * Card width breakpoints matching CSS variables
 */
export const CARD_WIDTHS = {
  small: [150, 200, 300],
  medium: [200, 300, 400],
  large: [300, 400, 600],
} as const;
