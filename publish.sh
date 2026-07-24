#!/bin/bash
# Publish all packages: Python (PyPI), JavaScript (CDN + npm), React (npm)

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
FAILED=()

echo "========================================="
echo "  Featrix Model Card — Publish All"
echo "========================================="
echo ""

run_step() {
    local name="$1"
    local dir="$2"
    local script="$3"
    echo "--- $name ---"
    if ! (cd "$dir" && bash "$script"); then
        echo "❌ $name failed — continuing with remaining steps"
        FAILED+=("$name")
    fi
    echo ""
}

# --- Python (PyPI) ---
run_step "Python (PyPI)" "$REPO_DIR/python" publish.sh

# --- JavaScript (CDN) --- no npm login required, so this runs before the npm steps
run_step "JavaScript (CDN)" "$REPO_DIR/javascript" publish-cdn.sh

# --- JavaScript (npm) ---
run_step "JavaScript (npm)" "$REPO_DIR/javascript" publish.sh

# --- React (npm) ---
run_step "React (npm)" "$REPO_DIR/react" publish.sh

echo "========================================="
if [ ${#FAILED[@]} -eq 0 ]; then
    echo "  All packages published!"
    echo "========================================="
else
    echo "  Done, but ${#FAILED[@]} step(s) failed:"
    for step in "${FAILED[@]}"; do
        echo "    - $step"
    done
    echo "========================================="
    exit 1
fi
