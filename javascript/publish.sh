#!/bin/bash
# Publish @featrix/modelcard-js to npm

set -e

echo "🚀 Publishing @featrix/modelcard-js to npm..."

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Run this script from the javascript/ directory."
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ Error: npm not found"
    exit 1
fi

# Check if logged in to npm
if ! npm whoami &> /dev/null; then
    echo "⚠️  Not logged in to npm. Please run: npm login"
    exit 1
fi

# Get current version
CURRENT_VERSION=$(node -p "require('./package.json').version")
echo "📦 Current version: $CURRENT_VERSION"

# Check if package.json has the correct name
PACKAGE_NAME=$(node -p "require('./package.json').name")
if [ "$PACKAGE_NAME" != "@featrix/modelcard-js" ]; then
    echo "⚠️  Warning: package.json name is '$PACKAGE_NAME', expected '@featrix/modelcard-js'"
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ Publish cancelled"
        exit 1
    fi
fi

# Show what will be published
echo ""
echo "📋 Package details:"
echo "  Name: $PACKAGE_NAME"
echo "  Version: $CURRENT_VERSION"
echo "  Files to publish:"
npm pack --dry-run 2>&1 | grep -A 100 "npm notice === Tarball Contents ===" | head -20

# Ask for confirmation
read -p "Continue with publish to npm? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Publish cancelled"
    exit 1
fi

# Publish to npm
echo "⬆️  Publishing to npm..."
npm publish --access public

echo "✅ Successfully published @featrix/modelcard-js to npm!"
echo ""
echo "Users can now use it via CDN:"
echo "  - unpkg: https://unpkg.com/@featrix/modelcard-js/model-card.js"
echo "  - jsDelivr: https://cdn.jsdelivr.net/npm/@featrix/modelcard-js/model-card.js"
echo ""
echo "Or install with: npm install @featrix/modelcard-js"

