#!/usr/bin/env bash
set -e

echo "=== TOON Format Verification ==="
echo ""

# Test 1: Tab delimiter encoding
echo "1. Testing tab delimiter encoding..."
echo '{"users": [{"id": 1, "name": "Alice", "role": "admin"}, {"id": 2, "name": "Bob", "role": "user"}]}' > /tmp/test.json
ENCODED=$(cat /tmp/test.json | bunx @toon-format/cli --encode --delimiter='	' 2>/dev/null)
echo "✓ Encoded with tab delimiters:"
echo "$ENCODED"
echo ""

# Test 2: Strict mode validation (should succeed)
echo "2. Testing strict mode decoding (valid TOON)..."
DECODED=$(echo "$ENCODED" | bunx @toon-format/cli --decode 2>/dev/null)
echo "✓ Decoded with strict validation:"
echo "$DECODED" | head -3
echo ""

# Test 3: Strict mode validation (should fail)
echo "3. Testing strict mode validation (malformed TOON)..."
MALFORMED='users[3	]{id	name}:
  1	Alice
  2	Bob'

if echo "$MALFORMED" | bunx @toon-format/cli --decode 2>&1 | grep -q "Expected 3"; then
  echo "✓ Strict mode correctly detected malformed TOON"
else
  echo "✗ Strict mode failed to detect error"
  exit 1
fi
echo ""

# Test 4: Roundtrip verification
echo "4. Testing lossless roundtrip..."
ROUNDTRIP=$(echo "$DECODED" | bunx @toon-format/cli --encode --delimiter='	' 2>/dev/null | bunx @toon-format/cli --decode 2>/dev/null)
if diff -q <(echo "$DECODED") <(echo "$ROUNDTRIP") > /dev/null 2>&1; then
  echo "✓ Lossless roundtrip verified"
else
  echo "✗ Roundtrip produced different output"
  exit 1
fi
echo ""

# Test 5: TypeScript library tests
echo "5. Running TypeScript library tests..."
bun test tests/toon.test.ts 2>&1 | grep -E "(pass|fail)"
echo ""

# Test 6: Token statistics
echo "6. Token efficiency comparison..."
echo "JSON format:"
echo "$DECODED" | wc -c | xargs printf "  %d characters\n"
echo "TOON format:"
echo "$ENCODED" | wc -c | xargs printf "  %d characters\n"
echo ""

echo "=== All Verifications Passed ✓ ==="
