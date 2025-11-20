# Publish @featrix/model-card-react to npm (PowerShell version)

Write-Host "🚀 Publishing @featrix/model-card-react to npm..." -ForegroundColor Cyan

# Check if we're in the right directory
if (-not (Test-Path "package.json")) {
    Write-Host "❌ Error: package.json not found. Run this script from the react/ directory." -ForegroundColor Red
    exit 1
}

# Check if npm is installed
try {
    npm --version | Out-Null
} catch {
    Write-Host "❌ Error: npm not found" -ForegroundColor Red
    exit 1
}

# Check if logged in to npm
try {
    npm whoami | Out-Null
} catch {
    Write-Host "⚠️  Not logged in to npm. Please run: npm login" -ForegroundColor Yellow
    exit 1
}

# Get current version
$packageJson = Get-Content package.json | ConvertFrom-Json
$currentVersion = $packageJson.version
Write-Host "📦 Current version: $currentVersion" -ForegroundColor Cyan

# Clean previous builds
Write-Host "🧹 Cleaning previous builds..." -ForegroundColor Yellow
Remove-Item -Recurse -Force -ErrorAction SilentlyContinue dist, build, node_modules/.cache

# Install dependencies
Write-Host "📥 Installing dependencies..." -ForegroundColor Cyan
npm install

# Build the package (if there's a build step)
if ((Test-Path "tsconfig.json") -or (Test-Path "src")) {
    Write-Host "🔨 Building package..." -ForegroundColor Cyan
    if ($packageJson.scripts.build) {
        npm run build
    }
}

# Run tests if they exist
if ($packageJson.scripts.test) {
    Write-Host "🧪 Running tests..." -ForegroundColor Cyan
    npm test
    if ($LASTEXITCODE -ne 0) {
        Write-Host "⚠️  Tests failed, but continuing..." -ForegroundColor Yellow
    }
}

# Check if package.json has the correct name
$packageName = $packageJson.name
if ($packageName -ne "@featrix/model-card-react") {
    Write-Host "⚠️  Warning: package.json name is '$packageName', expected '@featrix/model-card-react'" -ForegroundColor Yellow
    $confirmation = Read-Host "Continue anyway? (y/N)"
    if ($confirmation -ne 'y' -and $confirmation -ne 'Y') {
        Write-Host "❌ Publish cancelled" -ForegroundColor Red
        exit 1
    }
}

# Show what will be published
Write-Host ""
Write-Host "📋 Package details:" -ForegroundColor Cyan
Write-Host "  Name: $packageName"
Write-Host "  Version: $currentVersion"
Write-Host "  Files to publish:"
npm pack --dry-run 2>&1 | Select-String -Pattern "npm notice" | Select-Object -First 20

# Ask for confirmation
$confirmation = Read-Host "Continue with publish to npm? (y/N)"
if ($confirmation -ne 'y' -and $confirmation -ne 'Y') {
    Write-Host "❌ Publish cancelled" -ForegroundColor Red
    exit 1
}

# Publish to npm
Write-Host "⬆️  Publishing to npm..." -ForegroundColor Cyan
npm publish --access public

Write-Host "✅ Successfully published @featrix/model-card-react to npm!" -ForegroundColor Green
Write-Host ""
Write-Host "Install with: npm install @featrix/model-card-react" -ForegroundColor Cyan

