# Publish featrix-modelcard to PyPI (PowerShell version)

Write-Host "🚀 Publishing featrix-modelcard to PyPI..." -ForegroundColor Cyan

# Check if we're in the right directory
if (-not (Test-Path "setup.py")) {
    Write-Host "❌ Error: setup.py not found. Run this script from the python/ directory." -ForegroundColor Red
    exit 1
}

# Check if required tools are installed
try {
    python --version | Out-Null
} catch {
    Write-Host "❌ Error: python not found" -ForegroundColor Red
    exit 1
}

# Check for twine
try {
    twine --version | Out-Null
} catch {
    Write-Host "⚠️  twine not found. Installing..." -ForegroundColor Yellow
    pip install twine build
}

# Clean previous builds
Write-Host "🧹 Cleaning previous builds..." -ForegroundColor Yellow
Remove-Item -Recurse -Force -ErrorAction SilentlyContinue dist, build, *.egg-info

# Build the package
Write-Host "📦 Building package..." -ForegroundColor Cyan
python -m build

# Check if build was successful
if (-not (Test-Path "dist")) {
    Write-Host "❌ Error: Build failed - dist/ directory not created" -ForegroundColor Red
    exit 1
}

# Show what will be uploaded
Write-Host ""
Write-Host "📋 Files to be uploaded:" -ForegroundColor Cyan
Get-ChildItem dist | Format-Table

# Ask for confirmation
$confirmation = Read-Host "Continue with upload to PyPI? (y/N)"
if ($confirmation -ne 'y' -and $confirmation -ne 'Y') {
    Write-Host "❌ Upload cancelled" -ForegroundColor Red
    exit 1
}

# Upload to PyPI
Write-Host "⬆️  Uploading to PyPI..." -ForegroundColor Cyan
python -m twine upload dist/*

Write-Host "✅ Successfully published featrix-modelcard to PyPI!" -ForegroundColor Green
Write-Host ""
Write-Host "Install with: pip install featrix-modelcard" -ForegroundColor Cyan

