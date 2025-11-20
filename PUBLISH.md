# Publishing Instructions

## Python Package (PyPI)

### Prerequisites

1. Install build tools:
```bash
pip install build twine
```

2. Create a PyPI account at https://pypi.org
3. Create an API token at https://pypi.org/manage/account/token/
4. Configure credentials (one of):
   - Use `~/.pypirc` file (see `python/.pypirc.example`)
   - Or use environment variables: `TWINE_USERNAME` and `TWINE_PASSWORD`

### Publishing

```bash
cd python
./publish.sh
```

Or on Windows:
```powershell
cd python
.\publish.ps1
```

### Manual Steps

```bash
cd python

# Clean previous builds
rm -rf dist/ build/ *.egg-info/

# Build
python3 -m build

# Upload to PyPI
python3 -m twine upload dist/*
```

### Testing on TestPyPI

```bash
python3 -m twine upload --repository testpypi dist/*
```

Install from TestPyPI:
```bash
pip install -i https://test.pypi.org/simple/ featrix-modelcard
```

## NPM Packages

### React Component

#### Prerequisites

1. Create an npm account at https://www.npmjs.com
2. Login to npm:
```bash
npm login
```

3. Ensure you have access to the `@featrix` scope (or publish as unscoped)

#### Publishing

```bash
cd react
./publish.sh
```

### Standalone JavaScript

#### Prerequisites

1. Create an npm account at https://www.npmjs.com
2. Login to npm:
```bash
npm login
```

3. Ensure you have access to the `@featrix` scope (or publish as unscoped)

#### Publishing

```bash
cd javascript
./publish.sh
```

After publishing, users can use it via CDN:
- **Featrix CDN**: `https://bits.featrix.com/js/featrix-modelcard/model-card.js`
- **unpkg**: `https://unpkg.com/@featrix/modelcard-js/model-card.js`
- **jsDelivr**: `https://cdn.jsdelivr.net/npm/@featrix/modelcard-js/model-card.js`

#### Publishing to Featrix CDN

```bash
cd javascript
./publish-cdn.sh
```

This will upload files to `bits:/var/www/html/js/featrix-modelcard/` via scp.

#### Publishing to npm

```bash
cd javascript
./publish.sh
```

Or on Windows:
```powershell
cd react
.\publish.ps1
```

### Manual Steps

```bash
cd react

# Install dependencies
npm install

# Build (if needed)
npm run build

# Publish
npm publish --access public
```

### Testing

Test locally before publishing:
```bash
npm pack
# Creates a .tgz file you can test install
```

## Version Bumping

### Python

Edit `python/featrix_model_card/__init__.py`:
```python
__version__ = "1.0.1"
```

And `python/setup.py`:
```python
version="1.0.1",
```

### NPM

```bash
cd react
npm version patch  # or minor, major
```

Or edit `react/package.json` manually.

## Package Names

- **PyPI**: `featrix-modelcard`
- **NPM (React)**: `@featrix/modelcard`
- **NPM (Standalone JS)**: `@featrix/modelcard-js`

