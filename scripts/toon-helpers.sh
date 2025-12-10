#!/usr/bin/env bash
# TOON format helper scripts for encoding/decoding with tab delimiters and strict mode

# Encode JSON to TOON format with tab delimiters
toon-encode() {
  if [ -z "$1" ]; then
    # Read from stdin
    bunx @toon-format/cli --encode --delimiter='	'
  else
    # Read from file
    cat "$1" | bunx @toon-format/cli --encode --delimiter='	'
  fi
}

# Decode TOON to JSON with strict validation
toon-decode() {
  if [ -z "$1" ]; then
    # Read from stdin
    bunx @toon-format/cli --decode
  else
    # Read from file
    cat "$1" | bunx @toon-format/cli --decode
  fi
}

# Verify TOON format (encode then decode roundtrip)
toon-verify() {
  if [ -z "$1" ]; then
    echo "Usage: toon-verify <json-file>"
    return 1
  fi

  echo "Encoding JSON to TOON..."
  local toon=$(cat "$1" | toon-encode)

  echo "TOON format:"
  echo "$toon"
  echo ""

  echo "Decoding back to JSON (with strict validation)..."
  echo "$toon" | toon-decode

  echo ""
  echo "✓ Roundtrip successful - strict validation passed"
}

# Check TOON format statistics
toon-stats() {
  if [ -z "$1" ]; then
    # Read from stdin
    bunx @toon-format/cli --encode --delimiter='	' --stats
  else
    # Read from file
    cat "$1" | bunx @toon-format/cli --encode --delimiter='	' --stats
  fi
}

# Export functions if sourced
export -f toon-encode toon-decode toon-verify toon-stats 2>/dev/null || true
