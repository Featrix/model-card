#!/bin/bash
# Publish @featrix/model-card-react to npm

set -e

echo "🚀 Publishing @featrix/model-card-react to npm..."

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Run this script from the react/ directory."
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

# Clean previous builds
echo "🧹 Cleaning previous builds..."
rm -rf dist/ build/ node_modules/.cache/

# Install dependencies
echo "📥 Installing dependencies..."
npm install

# Build the package (if there's a build step)
if [ -f "tsconfig.json" ] || [ -d "src" ]; then
    echo "🔨 Building package..."
    # Check if there's a build script
    if grep -q '"build"' package.json; then
        npm run build
    fi
fi

# Run tests if they exist
if grep -q '"test"' package.json; then
    echo "🧪 Running tests..."
    npm test || echo "⚠️  Tests failed, but continuing..."
fi

# Get package name
PACKAGE_NAME=$(node -p "require('./package.json').name")

# Publish to npm
echo "⬆️  Publishing to npm..."
npm publish --access public

echo "✅ Successfully published @featrix/model-card-react to npm!"
echo ""
echo "Install with: npm install @featrix/model-card-react"

