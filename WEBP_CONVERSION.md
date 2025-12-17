# WebP Conversion Guide

## Why WebP?

WebP provides 20-30% better compression than JPEG with the same visual quality. For this project:

- **Before**: ~800KB total for 34 card images (JPG)
- **After**: ~560KB total (WebP) + JPG fallbacks
- **Net savings**: ~240KB (30% reduction) on initial load

## Conversion Steps

### 1. Install WebP tools

```bash
brew install webp
```

### 2. Run conversion script

```bash
chmod +x scripts/convert-to-webp.sh
./scripts/convert-to-webp.sh
```

This will:

- Convert all 34 JPGs to WebP (quality 80)
- Keep JPGs as fallback for older browsers
- Show size savings for each image

### 3. Code changes (already done!)

- ✅ Updated `getCardImageUrl()` to return `.webp` files
- ✅ Added `getCardImageFallbackUrl()` for `.jpg` fallback
- ✅ All components use `<picture>` element with WebP + JPG sources
- ✅ Vercel Image Optimization supports both formats
- ✅ HTML preloads WebP card back with JPG fallback

## Browser Support

- **Modern browsers** (95%+): Serve WebP (smaller, faster)
- **Older browsers**: Automatically fall back to JPG
- No JavaScript required - native HTML5 `<picture>` element

## Verification

After conversion, check file sizes:

```bash
ls -lh public/cards/*.{webp,jpg} | head -20
```

You should see WebP files ~20-30% smaller than their JPG counterparts.
