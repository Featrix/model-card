#!/bin/bash
# Publish all packages: Python (PyPI), JavaScript (npm + CDN), React (npm)
set -e

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "========================================="
echo "  Featrix Model Card — Publish All"
echo "========================================="
echo ""

# --- Python (PyPI) ---
echo "--- Python (PyPI) ---"
(cd "$REPO_DIR/python" && bash publish.sh)
echo ""

# --- JavaScript (npm) ---
echo "--- JavaScript (npm) ---"
(cd "$REPO_DIR/javascript" && bash publish.sh)
echo ""

# --- JavaScript (CDN) ---
echo "--- JavaScript (CDN) ---"
(cd "$REPO_DIR/javascript" && bash publish-cdn.sh)
echo ""

# --- React (npm) ---
echo "--- React (npm) ---"
(cd "$REPO_DIR/react" && bash publish.sh)
echo ""

echo "========================================="
echo "  All packages published!"
echo "========================================="
