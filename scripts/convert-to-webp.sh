#!/bin/bash
# Convert ALL card images to WebP for 20-30% better compression
# Run: chmod +x scripts/convert-to-webp.sh && ./scripts/convert-to-webp.sh

CARDS_DIR="public/cards"

echo "Converting all card images to WebP..."

# Check if cwebp is installed
if ! command -v cwebp &> /dev/null; then
    echo "Error: cwebp not found. Install with: brew install webp"
    exit 1
fi

count=0
for jpg in "$CARDS_DIR"/*.jpg; do
  if [ -f "$jpg" ]; then
    filename=$(basename "$jpg" .jpg)
    webp="$CARDS_DIR/${filename}.webp"

    echo "Converting ${filename}.jpg..."
    # Quality 85 for optimal balance of visual quality and file size
    cwebp -q 85 "$jpg" -o "$webp"

    # Show size comparison
    jpg_size=$(stat -f%z "$jpg" 2>/dev/null || stat -c%s "$jpg" 2>/dev/null)
    webp_size=$(stat -f%z "$webp" 2>/dev/null || stat -c%s "$webp" 2>/dev/null)
    savings=$((100 - (webp_size * 100 / jpg_size)))
    echo "  ${filename}: ${savings}% smaller"

    ((count++))
  fi
done

echo ""
echo "✓ Converted $count images to WebP"
echo "✓ JPEGs kept as fallback for older browsers"
echo ""
echo "Next: Update getCardImageUrl() to use .webp with .jpg fallback"
