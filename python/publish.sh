#!/bin/bash
# Publish featrix-modelcard to PyPI

set -e

echo "🚀 Publishing featrix-modelcard to PyPI..."

# Check if we're in the right directory
if [ ! -f "setup.py" ]; then
    echo "❌ Error: setup.py not found. Run this script from the python/ directory."
    exit 1
fi

# Check if required tools are installed
if ! command -v python3 &> /dev/null; then
    echo "❌ Error: python3 not found"
    exit 1
fi

if ! command -v twine &> /dev/null; then
    echo "⚠️  twine not found. Installing..."
    pip install twine build
fi

# Clean previous builds
echo "🧹 Cleaning previous builds..."
rm -rf dist/ build/ *.egg-info/

# Build the package
echo "📦 Building package..."
python3 -m build

# Check if build was successful
if [ ! -d "dist" ]; then
    echo "❌ Error: Build failed - dist/ directory not created"
    exit 1
fi

# Upload to PyPI
echo "⬆️  Uploading to PyPI..."
python3 -m twine upload dist/*

echo "✅ Successfully published featrix-modelcard to PyPI!"
echo ""
echo "Install with: pip install featrix-modelcard"

