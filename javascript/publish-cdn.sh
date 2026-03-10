#!/bin/bash
# Publish JavaScript renderer to bits.featrix.com CDN

set -e

echo "🚀 Publishing to bits.featrix.com CDN..."

# Check if we're in the right directory
if [ ! -f "model-card.js" ]; then
    echo "❌ Error: model-card.js not found. Run this script from the javascript/ directory."
    exit 1
fi

# Check if scp is available
if ! command -v scp &> /dev/null; then
    echo "❌ Error: scp not found"
    exit 1
fi

# Get version from package.json if it exists, otherwise use "latest"
if [ -f "package.json" ]; then
    VERSION=$(node -p "require('./package.json').version" 2>/dev/null || echo "latest")
else
    VERSION="latest"
fi

echo "📦 Version: $VERSION"
echo "📁 Target: bits:/var/www/html/js/featrix-modelcard/"

# Create a temporary directory for files to upload
TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

# Stamp build hash into the JS file
BUILD_HASH=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
echo "🔖 Build: $BUILD_HASH"

# Copy files to temp directory and inject build hash
echo "📋 Preparing files..."
sed "s/BUILD: 'dev'/BUILD: '$BUILD_HASH'/" model-card.js > "$TEMP_DIR/model-card.js"
if [ -f "README.md" ]; then
    cp README.md "$TEMP_DIR/"
fi

# Upload to CDN
echo "⬆️  Uploading to bits.featrix.com..."
scp -r "$TEMP_DIR"/* bits:/var/www/html/js/featrix-modelcard/

echo "✅ Successfully published to CDN!"
echo ""
echo "Users can now use it via:"
echo "  https://bits.featrix.com/js/featrix-modelcard/model-card.js"
echo ""
echo "Example usage:"
echo '  <script src="https://bits.featrix.com/js/featrix-modelcard/model-card.js"></script>'

